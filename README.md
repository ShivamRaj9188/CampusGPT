# CampusGPT

CampusGPT is an intelligent academic operating system designed for educational institutions. The application leverages a Retrieval-Augmented Generation (RAG) pipeline allowing students and faculty to upload academic documents (PDfs) and query them through advanced localized language models. 

Built around a robust Spring Boot microservice architecture and a reactive React frontend, it features streaming text generation, localized semantic search, and multiple context-aware instructional modes.

## Architectural Overview

*   **Frontend**: React 18, TypeScript, Tailwind CSS, Framer Motion
*   **Backend**: Java 17, Spring Boot 3.2, Spring Security (JWT)
*   **Database**: PostgreSQL 15+ equipped with the `pgvector` extension
*   **AI Stack**: Ollama (Llama 3 for text generation, Nomic for dense vector embeddings)
*   **Processing**: Apache PDFBox for extraction, algorithmic document chunking

## Primary Features

*   **RAG-Powered Chat**: Streamed, token-by-token responses using Server-Sent Events (SSE) based on document context.
*   **Knowledge Base Management**: PDF upload, extraction, and automated vectorization.
*   **Smart Instructional Modes**: Contextual prompts (e.g., Explain Concept, 10-Mark Answer, Revision Blast, Viva Questions) altering the LLM's response structure.
*   **Security Foundation**: Hardened with JWT authentication, IP-based rate limiting (Bucket4J), strict input sanitization, and OWASP-recommended HTTP headers.
*   **Premium Interface**: A modern aesthetic featuring a neo-glass design system with layered blurring, micro-animations, and dynamic data visualization components.

## Prerequisites

Ensure the following dependencies are installed prior to proceeding:

1.  **Java Standard Edition (JDK) 17** or higher
2.  **Node.js (LTS)** and `npm`
3.  **Maven** (optional, recommended if you aren't using the embedded wrapper)
4.  **PostgreSQL** with the `pgvector` extension installed
5.  **Ollama** framework for running inference locally

## Local Installation Guide

### 1. Model Provisioning (Ollama)

CampusGPT defaults to utilizing the `llama3` instruct model, and `nomic-embed-text` for vectorization. 

Start the Ollama daemon and fetch the required models:

```bash
ollama run llama3
ollama pull nomic-embed-text
```

### 2. Database Configuration

Initialize a PostgreSQL instance and install the vector extension:

```sql
CREATE DATABASE campusgpt;
\c campusgpt
CREATE EXTENSION vector;
```

### 3. Backend Setup

Navigate to the `backend` directory.

Establish your environmental variables based on the template:

```bash
cp .env.example .env
```

Configure the `.env` file with your database credentials. Ensure you replace `JWT_SECRET` with a robust 256-bit secure key. 

Clean, package, and execute the application:

```bash
./mvnw clean install
./mvnw spring-boot:run
```

The server binds to `http://localhost:8080/`. Note: Spring Data JPA will automatically build your schema utilizing `hibernate/ddl-auto: update`.

### 4. Frontend Setup 

Navigate to the `frontend` directory.

```bash
npm install
npm run dev
```

The Vite development server will start the application at `http://localhost:5173/`. 

## Project Structure

### Backend Core Layout (`com.campusgpt`)

*   `auth`: Authentication flow, security configuration, and JWT lifecycle management.
*   `chat`: Asynchronous SSE streaming controllers and the primary prompt engineering logic.
*   `document`: Multipart PDF handling, extraction boundaries, and metadata management.
*   `embedding`: Vectorization mechanics communicating with Ollama's local HTTP APIs.
*   `security`: Hardening filters including `RateLimitFilter`, `SecurityHeadersFilter`, and input sanitization layers.

### Frontend Application Layout (`/src`)

*   `components`: Layout boundaries, layout shells (`AppLayout`), and UI primitives.
*   `pages`: The foundational route handlers (`ChatPage`, `DashboardPage`, `SmartModesPage`).
*   `services`: Axiom-based REST communication and fetch-based stream endpoints handling tokens.
*   `context`: Application state boundary (authentication).
*   `index.css`: The central CSS root enforcing the neo-glass styling paradigms.

## Security Overview

This project implements standard security mitigation requirements.

*   **Input Handling Constraint**: Centralized parameter sanitization rejecting specific control characters and enforcing boundary limits, averting payload exhaustion and XSS patterns.
*   **Abuse Prevention**: Distributed, in-memory Token Buckets implemented via `bucket4j`. Restricts repeated programmatic requests over critical endpoints.
*   **Authentication Flow**: Standard Stateless JWT exchange using BCrypt password hashing.
*   **Data Transport**: Headers hardened dynamically against MIME-type sniffing, Clickjacking, and Cross-Site Request Forgery paths.

## Deployment Notes

CampusGPT is built for an architecture involving discrete execution zones:

1.  **AI Layer**: Requires GPU/Heavy compute. Suitable for EC2 Instances or Bare-metal setups capable of handling Ollama inference payloads.
2.  **State Layer**: Requirements encompass a PostgreSQL instance capable of the `pgvector` extension. Managed instances like Supabase, AWS RDS, or Render are adequate. 
3.  **Application Layer (Backend)**: Executable via containerization or PaaS platforms like Railway or Render, pointing back toward the State and AI layers. 
4.  **Presentation Layer (Frontend)**: Standard static builds, suitable for execution on Vercel, Netlify, or standard CDN configurations. 

When deploying, alter the `allowCredentials` and `allowedOrigins` parameters within `SecurityConfig.java` to match your production domain, and assign rigorous cryptographic strings within your `.env` configuration.

## License

This application is provided as-is without warranty for academic and open-source operations. Codebase configuration may vary per environment deployment. 
