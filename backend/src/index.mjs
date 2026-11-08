import { S3Service } from "./services/s3-service.mjs";
import { TextExtractor } from "./services/text-extractor.mjs";
import { TextChunker } from "./services/text-chunker.mjs";
import { EmbeddingService } from "./services/embedding-service.mjs";
import { DatabaseRepository } from "./repositories/database-repository.mjs";
import { MetadataExtractor } from "./services/metadata-extractor.mjs";

const s3Service = new S3Service();
const textExtractor = new TextExtractor();
const textChunker = new TextChunker();
const embeddingService = new EmbeddingService();
const databaseRepository = new DatabaseRepository();
const metadataExtractor = new MetadataExtractor();

export const handler = async (event) => {
  console.log("Lambda handler invoked", {
    records: event.Records?.length || 0,
  });
  const results = [];

  try {
    for (const record of event?.Records || []) {
      try {
        const result = await processRecord(record);
        results.push(result);
      } catch (error) {
        console.error("Record processing failed", { error: error.message });
        results.push({ success: false, error: error.message });
      }
    }
  } catch (error) {
    console.error("Unexpected error in handler", { error: error.message });
    return formatResponse([
      { success: false, error: "Handler failed: " + error.message },
    ]);
  }

  console.log("Lambda handler completed", {
    total: results.length,
    succeeded: results.filter((r) => r.success).length,
  });

  return formatResponse(results);
};

const processRecord = async (record) => {
  console.log("Processing S3 record", { eventName: record.eventName });

  const { bucket, key, versionId } = extractS3Data(record);

  // Extract metadata from S3 key
  const { customerId, contractId, fileName } =
    metadataExtractor.extractFromS3Key(key);

  // Download file from S3
  const fileBuffer = await s3Service.downloadFile(bucket, key, versionId);
  const etag = record.s3.object.eTag || null;

  // Extract document metadata
  const documentId = await databaseRepository.upsertDocument(
    customerId,
    contractId,
    bucket,
    key,
    versionId,
    etag,
    fileName,
  );

  // Extract text from file
  const pages = await textExtractor.extractFromPDF(fileBuffer);

  if (pages.length === 0) {
    throw new Error("No text extracted from document");
  }

  // Chunk text into smaller segments
  const chunks = textChunker.chunk(pages);

  if (chunks.length === 0) {
    throw new Error("No chunks created from document");
  }

  // Generate embeddings for each chunk
  const chunkTexts = chunks.map((c) => c.content);
  const embeddings = await embeddingService.generateEmbeddings(chunkTexts);

  console.log("Generated embeddings for chunks", { count: embeddings.length });

  // Save chunks and embeddings to database
  await databaseRepository.saveChunks(
    documentId,
    customerId,
    contractId,
    chunks,
    embeddings,
  );

  console.log("Record processed successfully", {
    documentId,
    chunks: chunks.length,
  });

  return { success: true, documentId, fileName, chunks: chunks.length };
};

const formatResponse = (results) => {
  const summary = {
    total: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
  };

  return {
    statusCode: summary.failed > 0 ? 207 : 200,
    body: JSON.stringify({ summary, results }),
  };
};

const extractS3Data = (record) => {
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  const versionId = record.s3.object.versionId || null;

  return { bucket, key, versionId };
};
