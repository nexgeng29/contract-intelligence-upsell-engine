// database-repository.mjs
import pg from "pg";

const { Pool } = pg;

export class DatabaseRepository {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    console.log("Using connection string", connectionString);
    this.pool = new Pool({
      connectionString: connectionString,
      max: 2,
      connectionTimeoutMillis: 5000,
    });

    console.log("Database pool created", {
      connectionString: connectionString?.split("@")[1] || "unknown",
    });
  }

  async upsertDocument(
    customerId,
    contractId,
    bucket,
    key,
    versionId,
    etag,
    fileName,
  ) {
    console.log("Upserting document", { customerId, contractId, fileName });
    console.log("Connection string used for upsert", process.env.DATABASE_URL);
    const result = await this.pool.query(
      `INSERT INTO documents (customer_id, contract_id, bucket, object_key, version_id, etag, file_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROCESSING')
       ON CONFLICT (bucket, object_key, version_id)
       DO UPDATE SET 
         customer_id = EXCLUDED.customer_id,
         contract_id = EXCLUDED.contract_id,
         etag = EXCLUDED.etag,
         file_name = EXCLUDED.file_name,
         status = 'PROCESSING'
       RETURNING id`,
      [customerId, contractId, bucket, key, versionId, etag, fileName],
    );

    const documentId = result.rows[0].id;
    console.log("Document upserted", { documentId });

    return documentId;
  }

  async saveChunks(documentId, customerId, contractId, chunks, embeddings) {
    console.log("Saving chunks to database", {
      documentId,
      chunks: chunks.length,
    });

    if (chunks.length !== embeddings.length) {
      throw new Error(
        `Chunks (${chunks.length}) and embeddings (${embeddings.length}) count mismatch`,
      );
    }

    const client = await this.pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;

      // Delete existing chunks for re-indexing
      await client.query("DELETE FROM document_chunks WHERE document_id = $1", [
        documentId,
      ]);

      // Insert new chunks with embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        const vector = `[${embedding.join(",")}]`;

        await client.query(
          `INSERT INTO document_chunks (document_id, customer_id, contract_id, page_number, chunk_index, content, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
          [
            documentId,
            customerId,
            contractId,
            chunk.pageNumber,
            chunk.chunkIndex,
            chunk.content,
            vector,
          ],
        );
      }

      // Mark document as indexed
      await client.query(
        "UPDATE documents SET status = $1, indexed_at = NOW() WHERE id = $2",
        ["INDEXED", documentId],
      );

      await client.query("COMMIT");
      transactionOpen = false;

      console.log("Chunks saved successfully", {
        documentId,
        chunks: chunks.length,
      });
    } catch (error) {
      if (transactionOpen) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Error saving chunks", { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  async markDocumentFailed(documentId, error) {
    console.error("Marking document as FAILED", {
      documentId,
      error: error.message,
    });

    await this.pool.query("UPDATE documents SET status = $1 WHERE id = $2", [
      "FAILED",
      documentId,
    ]);
  }

  async close() {
    console.log("Closing database pool");
    await this.pool.end();
  }
}
