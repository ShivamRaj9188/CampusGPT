-- ============================================================
-- CampusGPT Database Schema Initialization
-- This script runs at application startup (spring.sql.init.mode: always)
-- ============================================================

-- Enable the pgvector extension for vector similarity search
-- This must be run BEFORE Hibernate creates the tables.
-- Requires PostgreSQL >= 15 and pgvector installed:
--   sudo apt install postgresql-15-pgvector  (Ubuntu)
--   brew install pgvector                    (macOS via Homebrew)
--   CREATE EXTENSION vector;                 (manually in psql)
CREATE EXTENSION IF NOT EXISTS vector;

-- Note: The actual tables (users, documents, chunks) are created
-- and managed by Hibernate JPA (ddl-auto: update).
-- The chunks.embedding column is stored as TEXT in pgvector-compatible
-- format "[0.1, 0.2, ...]" and cast to vector at query time.
