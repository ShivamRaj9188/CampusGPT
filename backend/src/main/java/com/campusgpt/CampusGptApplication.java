package com.campusgpt;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * CampusGPT — AI-powered College Assistant
 *
 * Tech Stack:
 *  - Spring Boot 3.2.x (REST API)
 *  - Spring Security + JWT (authentication)
 *  - PostgreSQL + pgvector (vector similarity search)
 *  - Apache PDFBox (PDF text extraction)
 *  - Ollama LLM (llama3 for chat, nomic-embed-text for embeddings)
 *  - Retrieval-Augmented Generation (RAG) pipeline
 */
@SpringBootApplication
public class CampusGptApplication {

    public static void main(String[] args) {
        SpringApplication.run(CampusGptApplication.class, args);
    }
}
