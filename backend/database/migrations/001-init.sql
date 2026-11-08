
-- ============================================================================
-- Database Schema: Contract Intelligence Upsell Engine
-- Description: Schema for storing documents, chunks, embeddings, and recommendations
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- Core Tables
-- ============================================================================

-- Store uploaded contracts and documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    contract_id TEXT,
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL,
    version_id TEXT,
    etag TEXT,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'INDEXED', 'FAILED')),
    indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT documents_bucket_object_key_version_id_key 
        UNIQUE NULLS NOT DISTINCT (bucket, object_key, version_id)
);

-- Store document chunks with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL,
    contract_id TEXT,
    page_number INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(768),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store AI-generated recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('RENEWAL', 'UPSELL', 'CROSS_SELL', 'RENEWAL_RISK')),
    priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    confidence NUMERIC(5, 2) NOT NULL CHECK (confidence BETWEEN 0 AND 100),
    explanation TEXT NOT NULL,
    annual_revenue_potential NUMERIC(14, 2),
    status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'REVIEWED', 'ACTIONED', 'DISMISSED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link recommendations to source evidence
CREATE TABLE IF NOT EXISTS recommendation_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    evidence_text TEXT,
    page_number INTEGER
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Indexes for document searches
CREATE INDEX IF NOT EXISTS documents_customer_idx
    ON documents(customer_id);

CREATE INDEX IF NOT EXISTS documents_status_idx
    ON documents(status);

CREATE INDEX IF NOT EXISTS documents_contract_idx
    ON documents(customer_id, contract_id);

-- Indexes for chunk searches and vector similarity
CREATE INDEX IF NOT EXISTS document_chunks_customer_idx
    ON document_chunks(customer_id);

CREATE INDEX IF NOT EXISTS document_chunks_contract_idx
    ON document_chunks(customer_id, contract_id);

CREATE INDEX IF NOT EXISTS document_chunks_document_idx
    ON document_chunks(document_id);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON document_chunks
    USING hnsw (embedding vector_cosine_ops);

-- Indexes for recommendation queries
CREATE INDEX IF NOT EXISTS recommendations_customer_idx
    ON recommendations(customer_id);

CREATE INDEX IF NOT EXISTS recommendations_status_idx
    ON recommendations(status);

CREATE INDEX IF NOT EXISTS recommendations_priority_idx
    ON recommendations(priority);

-- Indexes for recommendation evidence
CREATE INDEX IF NOT EXISTS recommendation_evidence_recommendation_idx
    ON recommendation_evidence(recommendation_id);

CREATE INDEX IF NOT EXISTS recommendation_evidence_document_idx
    ON recommendation_evidence(document_id);
