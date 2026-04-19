package com.campusgpt.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * Initializes the database schema for pgvector.
 * Ensures the extension is loaded, the column is strictly typed, and the HNSW index is built.
 */
@Component
@Slf4j
public class DatabaseInitializer implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        log.info("Running DatabaseInitializer to set up pgvector and HNSW indexing...");
        try {
            // 1. Ensure the pgvector extension is available
            jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector;");
            
            // 2. Ensure table exists before altering
            // By wrapping with an IF EXISTS check or simply executing and catching, we prevent errors on an empty DB
            jdbcTemplate.execute(
                "DO $$ BEGIN " +
                "  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chunks') THEN " +
                "    ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(768) USING embedding::vector; " +
                "    CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops); " +
                "  END IF; " +
                "END $$;"
            );

            log.info("Successfully configured pgvector extension and chunk embedding indexing.");
        } catch (Exception e) {
            log.error("Failed to initialize vector database schema. Note: If the DB is completely empty, Hibernate will create the table shortly. Error: {}", e.getMessage());
        }
    }
}
