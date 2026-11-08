-- Recommendations schema migration
-- Creates tables for storing and retrieving recommendations

-- Table: recommendations
-- Stores the main recommendation records with queries and overall relevance scores
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  query TEXT NOT NULL,
  relevance_score FLOAT NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes for fast lookups
  CONSTRAINT recommendations_customer_contract 
    UNIQUE(customer_id, contract_id, query, created_at)
);

CREATE INDEX IF NOT EXISTS idx_recommendations_customer_contract 
  ON recommendations(customer_id, contract_id);

CREATE INDEX IF NOT EXISTS idx_recommendations_created_at 
  ON recommendations(created_at DESC);

-- Table: recommendation_results
-- Stores individual recommendation results linked to main recommendations
CREATE TABLE IF NOT EXISTS recommendation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  document_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  recommendation_type VARCHAR(50) NOT NULL DEFAULT 'RELEVANT_CONTENT',
  relevance_score FLOAT NOT NULL DEFAULT 0.0,
  summary TEXT,
  top_chunks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Validate recommendation type
  CONSTRAINT valid_recommendation_type CHECK (
    recommendation_type IN (
      'RISK_ALERT',
      'RENEWAL_NOTICE',
      'UPSELL_OPPORTUNITY',
      'COMPLIANCE_CHECK',
      'RELEVANT_CONTENT'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_recommendation_results_recommendation_id 
  ON recommendation_results(recommendation_id);

CREATE INDEX IF NOT EXISTS idx_recommendation_results_type 
  ON recommendation_results(recommendation_type);

CREATE INDEX IF NOT EXISTS idx_recommendation_results_relevance 
  ON recommendation_results(relevance_score DESC);

-- Add columns to documents table if they don't exist (in case running separately)
-- This is optional - documents table should already exist from contract processor
ALTER TABLE IF EXISTS documents ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMP;

-- Grant permissions (adjust role names as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON recommendations TO lambda_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON recommendation_results TO lambda_role;
