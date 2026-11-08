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

  async findSimilarChunks(customerId, contractId, embedding, limit = 10) {
    console.log("Finding similar chunks", {
      customerId,
      contractId,
      limit,
    });

    const vector = `[${embedding.join(",")}]`;

    const result = await this.pool.query(
      `SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.page_number,
        dc.chunk_index,
        d.file_name,
        d.object_key,
        (1 - (dc.embedding <=> $3::vector)) as similarity
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE dc.customer_id = $1 
         AND dc.contract_id = $2
       ORDER BY dc.embedding <=> $3::vector
       LIMIT $4`,
      [customerId, contractId, vector, limit],
    );

    console.log("Found similar chunks", {
      count: result.rows.length,
    });

    return result.rows;
  }

  async searchByKeywords(customerId, contractId, keyword, limit = 10) {
    console.log("Searching chunks by keyword", {
      customerId,
      contractId,
      keyword,
      limit,
    });

    const result = await this.pool.query(
      `SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.page_number,
        dc.chunk_index,
        d.file_name,
        d.object_key
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE dc.customer_id = $1 
         AND dc.contract_id = $2
         AND dc.content ILIKE $3
       LIMIT $4`,
      [customerId, contractId, `%${keyword}%`, limit],
    );

    console.log("Found keyword matches", { count: result.rows.length });
    return result.rows;
  }

  async searchByEmbedding(customerId, contractId, embedding, limit = 10) {
    console.log("Searching chunks by embedding similarity", {
      customerId,
      contractId,
      limit,
    });

    const vector = `[${embedding.join(",")}]`;

    const result = await this.pool.query(
      `SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.page_number,
        dc.chunk_index,
        d.file_name,
        d.object_key,
        (1 - (dc.embedding <=> $3::vector)) as similarity
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE dc.customer_id = $1 
         AND dc.contract_id = $2
       ORDER BY dc.embedding <=> $3::vector
       LIMIT $4`,
      [customerId, contractId, vector, limit],
    );

    console.log("Found embedding matches", { count: result.rows.length });
    return result.rows;
  }

  async close() {
    console.log("Closing database pool");
    await this.pool.end();
  }
}
