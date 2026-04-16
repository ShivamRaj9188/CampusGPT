/**
 * CampusGPT — Professional Project Structure
 * ============================================
 *
 * Root
 * ├── backend/                        Spring Boot (Java 17)
 * │   ├── apache-maven-3.9.6/         Bundled Maven (use for builds)
 * │   ├── src/
 * │   │   └── main/java/com/campusgpt/
 * │   │       ├── CampusGptApplication.java   Entry point
 * │   │       ├── auth/                       Auth domain
 * │   │       │   ├── AuthController.java     POST /api/auth/signup, /login
 * │   │       │   ├── AuthService.java        Business logic + streak tracking
 * │   │       │   ├── dto/                    Request/Response DTOs
 * │   │       │   ├── entity/UserEntity.java  JPA entity + streak fields
 * │   │       │   ├── jwt/                    JwtUtil + JwtFilter
 * │   │       │   └── repository/             UserRepository (JPA)
 * │   │       ├── chat/                       Chat / RAG domain
 * │   │       │   ├── ChatController.java     GET /api/chat/stream (SSE)
 * │   │       │   ├── ChatService.java        Full RAG pipeline + activity tracking
 * │   │       │   └── dto/                    ChatRequest, ChatMode enum
 * │   │       ├── config/                     AppConfig, SecurityConfig
 * │   │       ├── document/                   Document upload domain
 * │   │       │   ├── DocumentController.java POST /api/documents
 * │   │       │   ├── DocumentService.java    PDF parse → chunk → embed
 * │   │       │   ├── dto/                    DocumentResponse
 * │   │       │   ├── entity/                 DocumentEntity, ChunkEntity
 * │   │       │   └── repository/             DocumentRepo, ChunkRepo (pgvector)
 * │   │       ├── embedding/                  OllamaEmbeddingService
 * │   │       ├── security/                   GlobalExceptionHandler, InputSanitizer
 * │   │       │                               RateLimitFilter, SecurityHeadersFilter
 * │   │       └── user/                       User settings domain
 * │   │           ├── UserController.java     PUT /api/user/profile, /password
 * │   │           └── dto/                    UpdateProfileRequest, UpdatePasswordRequest
 * │   ├── src/main/resources/
 * │   │   └── application.properties          DB, JWT, Ollama config
 * │   ├── .env.example                        ← Copy to .env and fill secrets
 * │   └── pom.xml
 * │
 * └── frontend/                       React 18 + TypeScript + Vite
 *     ├── public/
 *     │   └── favicon.svg
 *     ├── src/
 *     │   ├── components/
 *     │   │   ├── layout/             Layout components (AppLayout)
 *     │   │   └── ui/
 *     │   │       └── StatCard.tsx    Reusable metric card
 *     │   ├── context/
 *     │   │   └── AuthContext.tsx     JWT auth state + streakCount
 *     │   ├── hooks/
 *     │   │   └── useDocuments.ts     Shared document fetching hook
 *     │   ├── pages/
 *     │   │   ├── ChatPage.tsx        SSE streaming chat + mode selector
 *     │   │   ├── DashboardPage.tsx   Live stats, sessions, quick actions
 *     │   │   ├── DocumentsPage.tsx   Knowledge base with category filters
 *     │   │   ├── LoginPage.tsx       Auth (login + signup)
 *     │   │   ├── SettingsPage.tsx    Profile + password management
 *     │   │   ├── SmartModesPage.tsx  6 exam answer mode cards
 *     │   │   └── UploadPage.tsx      PDF dropzone + indexing
 *     │   ├── services/
 *     │   │   ├── authService.ts      /api/auth endpoints
 *     │   │   ├── axiosInstance.ts    Shared Axios with auth header
 *     │   │   ├── chatService.ts      SSE streaming helper
 *     │   │   └── documentService.ts  /api/documents endpoints
 *     │   ├── utils/
 *     │   │   └── constants.ts        Brand colours, app metadata
 *     │   ├── App.tsx                 Router setup
 *     │   ├── main.tsx                Entry point
 *     │   └── types.ts                All TypeScript interfaces
 *     ├── .env.example                ← Copy to .env and fill VITE_API_BASE_URL
 *     ├── index.html
 *     └── vite.config.ts
 */
