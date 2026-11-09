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
    const params = [customerId];
    let paramIndex = 2;

    let query = `SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.page_number,
        dc.chunk_index,
        dc.contract_id,
        d.file_name,
        d.object_key,
        (1 - (dc.embedding <=> $${paramIndex}::vector)) as similarity
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE dc.customer_id = $1`;

    if (contractId) {
      query += ` AND dc.contract_id = $${paramIndex + 1}`;
      params.push(vector);
      params.push(contractId);
      paramIndex += 2;
    } else {
      params.push(vector);
      paramIndex += 1;
    }

    query += ` ORDER BY dc.embedding <=> $2::vector
       LIMIT $${paramIndex}`;
    
    params.push(limit);

    const result = await this.pool.query(query, params);

    console.log("Found similar chunks", {
      count: result.rows.length,
      fromContracts: contractId ? [contractId] : "all",
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

    let query = `SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.page_number,
        dc.chunk_index,
        dc.contract_id,
        d.file_name,
        d.object_key
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE dc.customer_id = $1`;

    const params = [customerId];

    if (contractId) {
      query += ` AND dc.contract_id = $2`;
      params.push(contractId);
      params.push(`%${keyword}%`);
      params.push(limit);
    } else {
      params.push(`%${keyword}%`);
      params.push(limit);
    }

    query += ` AND dc.content ILIKE $${contractId ? 3 : 2}
       LIMIT $${contractId ? 4 : 3}`;

    const result = await this.pool.query(query, params);

    console.log("Found keyword matches", {
      count: result.rows.length,
      fromContracts: contractId ? [contractId] : "all",
    });

    return result.rows;
  }

  async searchByEmbedding(customerId, contractId, embedding, limit = 10) {
    console.log("Searching chunks by embedding similarity", {
      customerId,
      contractId,
      limit,
    });

    const vector = `[${embedding.join(",")}]`;
    const params = [customerId];
    let paramIndex = 2;

    let query = `SELECT 
        dc.id,
        dc.document_id,
        dc.content,
        dc.page_number,
        dc.chunk_index,
        dc.contract_id,
        d.file_name,
        d.object_key,
        (1 - (dc.embedding <=> $${paramIndex}::vector)) as similarity
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE dc.customer_id = $1`;

    if (contractId) {
      query += ` AND dc.contract_id = $${paramIndex + 1}`;
      params.push(vector);
      params.push(contractId);
      paramIndex += 2;
    } else {
      params.push(vector);
      paramIndex += 1;
    }

    query += ` ORDER BY dc.embedding <=> $2::vector
       LIMIT $${paramIndex}`;
    
    params.push(limit);

    const result = await this.pool.query(query, params);

    console.log("Found embedding matches", {
      count: result.rows.length,
      fromContracts: contractId ? [contractId] : "all",
    });

    return result.rows;
  }

  async close() {
    console.log("Closing database pool");
    await this.pool.end();
  }
}
