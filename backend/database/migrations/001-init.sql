

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    contract_id TEXT,
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL,
    version_id TEXT,
    etag TEXT,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (bucket, object_key, version_id)
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    customer_id TEXT NOT NULL,
    contract_id TEXT,
    page_number INTEGER,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_chunks_customer_idx
    ON document_chunks(customer_id);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    recommendation_type TEXT NOT NULL,
    priority TEXT NOT NULL,
    confidence NUMERIC(5,2),
    explanation TEXT NOT NULL,
    annual_revenue_potential NUMERIC(14,2),
    status TEXT DEFAULT 'GENERATED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendation_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES recommendations(id),
    document_id UUID REFERENCES documents(id),
    chunk_id UUID REFERENCES document_chunks(id),
    evidence_text TEXT,
    page_number INTEGER
);

ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_bucket_object_key_version_id_key;

ALTER TABLE documents
ADD CONSTRAINT documents_bucket_object_key_version_id_key
UNIQUE NULLS NOT DISTINCT (bucket, object_key, version_id);


CREATE INDEX IF NOT EXISTS document_chunks_contract_idx
ON document_chunks(customer_id, contract_id);

CREATE INDEX IF NOT EXISTS documents_customer_idx
ON documents(customer_id);

CREATE INDEX IF NOT EXISTS documents_status_idx
ON documents(status);