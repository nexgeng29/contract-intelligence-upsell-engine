import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

import pg from "pg";
import path from "node:path";
import crypto from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const { Pool } = pg;

const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-central-1",
  ...(process.env.S3_ENDPOINT
    ? {
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
      }
    : {}),
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5000,
});

const OLLAMA_URL =
  process.env.OLLAMA_URL || "http://host.docker.internal:11434";

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;
const MAX_PDF_SIZE = 15 * 1024 * 1024;

// Expected S3 key:
// customers/CUST001/contract_001.pdf

function extractMetadata(key) {
  const match = key.match(/^customers\/([^/]+)\/(.+\.pdf)$/i);

  if (!match) {
    throw new Error(`Invalid contract S3 key: ${key}`);
  }

  return {
    customerId: match[1],
    contractId: match[2].replace(/\.pdf$/i, ""),
    fileName: path.posix.basename(key),
  };
}

function chunkText(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks = [];

  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    const chunk = clean.slice(start, end).trim();

    if (chunk.length > 30) {
      chunks.push(chunk);
    }

    if (end >= clean.length) break;

    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}

async function extractPdfPages(buffer) {
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (text.length > 0) {
        pages.push({
          pageNumber,
          text,
        });
      }

      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }

  return pages;
}

async function generateEmbedding(text) {
  const response = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(
      `Embedding request failed: ${response.status} ${await response.text()}`,
    );
  }

  const result = await response.json();
  const embedding = result.embeddings?.[0];

  if (!embedding || embedding.length !== 768) {
    throw new Error("Expected a 768-dimensional embedding");
  }

  return embedding;
}

async function createChunks(pages) {
  const chunks = [];

  for (const page of pages) {
    const pageChunks = chunkText(page.text);

    for (const content of pageChunks) {
      const embedding = await generateEmbedding(content);

      chunks.push({
        pageNumber: page.pageNumber,
        content,
        embedding,
      });
    }
  }

  return chunks;
}

async function downloadPdf(bucket, key, versionId) {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(versionId ? { VersionId: versionId } : {}),
    }),
  );

  if (!result.Body) {
    throw new Error("S3 returned an empty object");
  }

  if (result.ContentLength && result.ContentLength > MAX_PDF_SIZE) {
    throw new Error("PDF exceeds 15 MB limit");
  }

  const buffer = Buffer.from(await result.Body.transformToByteArray());

  if (buffer.length > MAX_PDF_SIZE) {
    throw new Error("PDF exceeds 15 MB limit");
  }

  return buffer;
}

async function markDocumentFailed(bucket, key, versionId, error) {
  try {
    await pool.query(
      `UPDATE documents
       SET status = 'FAILED'
       WHERE bucket = $1
         AND object_key = $2
         AND version_id IS NOT DISTINCT FROM $3`,
      [bucket, key, versionId],
    );
  } catch (dbError) {
    console.error("Could not mark document FAILED", dbError);
  }

  console.error("Contract processing failed", {
    bucket,
    key,
    error: error.message,
  });
}

async function processContract(record) {
  const bucket = record.s3.bucket.name;

  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  const versionId = record.s3.object.versionId || null;

  const eventEtag = (record.s3.object.eTag || "").replaceAll('"', "");

  const metadata = extractMetadata(key);

  console.log("Processing contract", {
    bucket,
    key,
    ...metadata,
    versionId,
  });

  try {
    // 1. Download PDF from S3.
    const buffer = await downloadPdf(bucket, key, versionId);

    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const etag = eventEtag || fileHash;

    // 2. Extract text page by page.
    const pages = await extractPdfPages(buffer);

    if (!pages.length) {
      throw new Error(
        "No extractable text found. OCR is required for scanned PDFs.",
      );
    }

    // 3. Generate chunks and embeddings.
    const chunks = await createChunks(pages);

    if (!chunks.length) {
      throw new Error("No document chunks generated");
    }

    // 4. Persist document and chunks atomically.
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Serialize concurrent notifications for this S3 object version.
      const lockKey = [bucket, key, versionId || ""].join("|");

      await client.query(
        `SELECT pg_advisory_xact_lock(
          hashtextextended($1, 0)
        )`,
        [lockKey],
      );

      const documentResult = await client.query(
        `INSERT INTO documents (
           customer_id,
           contract_id,
           bucket,
           object_key,
           version_id,
           etag,
           file_name,
           status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROCESSING')
         ON CONFLICT (bucket, object_key, version_id)
         DO UPDATE SET
           customer_id = EXCLUDED.customer_id,
           contract_id = EXCLUDED.contract_id,
           etag = EXCLUDED.etag,
           file_name = EXCLUDED.file_name,
           status = 'PROCESSING'
         RETURNING id`,
        [
          metadata.customerId,
          metadata.contractId,
          bucket,
          key,
          versionId,
          etag,
          metadata.fileName,
        ],
      );

      const documentId = documentResult.rows[0].id;

      // Re-indexing replaces the previous chunks.
      await client.query(
        `DELETE FROM document_chunks
         WHERE document_id = $1`,
        [documentId],
      );

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        const vector = `[${chunk.embedding.join(",")}]`;

        await client.query(
          `INSERT INTO document_chunks (
             document_id,
             customer_id,
             contract_id,
             page_number,
             chunk_index,
             content,
             embedding
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
          [
            documentId,
            metadata.customerId,
            metadata.contractId,
            chunk.pageNumber,
            i,
            chunk.content,
            vector,
          ],
        );
      }

      await client.query(
        `UPDATE documents
         SET status = 'INDEXED',
             indexed_at = NOW()
         WHERE id = $1`,
        [documentId],
      );

      await client.query("COMMIT");

      console.log("Contract indexed successfully", {
        documentId,
        customerId: metadata.customerId,
        contractId: metadata.contractId,
        pages: pages.length,
        chunks: chunks.length,
      });

      return {
        documentId,
        customerId: metadata.customerId,
        contractId: metadata.contractId,
        status: "INDEXED",
        pages: pages.length,
        chunks: chunks.length,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await markDocumentFailed(bucket, key, versionId, error);

    throw error;
  }
}

export const handler = async (event) => {
  const results = [];

  for (const record of event.Records || []) {
    if (
      record.eventSource !== "aws:s3" ||
      !record.eventName?.startsWith("ObjectCreated:")
    ) {
      continue;
    }

    results.push(await processContract(record));
  }

  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
};
