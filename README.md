# Production-Grade Microservices System

A production-ready microservices architecture consisting of **User Service**, **Notification Service**, and an **API Gateway**, communicating asynchronously through **NATS JetStream** without REST APIs or WebSockets for inter-service communication.

---

## 🏛️ System Architecture

```
Client (HTTP) ──> [API Gateway :8000] ──> [User Service :8001]
                                              │ (Publishes Events)
                                              ▼
                                    [NATS JetStream :4222]
                                              │ (Durable Consumer)
                                              ▼
                                 [Notification Service :8002]
```

### Key Components

1. **API Gateway (`:8000`)**
   - Central entry point and reverse proxy.
   - Rate limiting (IP/endpoint throttling).
   - JWT authentication verification and claim forwarding.
   - Distributed correlation ID tracking (`x-request-id`).
   - Interactive OpenAPI/Swagger documentation (`/docs`).
   - Aggregated multi-service health checks (`/health`).

2. **User Service (`:8001`)**
   - User registration and authentication.
   - Salted password hashing via Bcrypt.
   - Domain event publishing to NATS JetStream (`user.created`, `user.updated`, `user.password_reset`).
   - Profile management and transactional data store (SQLite/PostgreSQL compatible).

3. **Notification Service (`:8002`)**
   - Durable JetStream pull-consumer group.
   - **Idempotent processing**: Deduplication by unique `eventId` preventing duplicate delivery.
   - Multi-channel notification dispatcher simulation (Email, SMS, Push).
   - Retries with exponential backoff & Dead Letter Queue (DLQ) support.
   - Queryable delivery audit trail and delivery metrics (`/notifications/audit-logs`, `/notifications/metrics`).

4. **NATS JetStream Message Broker (`:4222`)**
   - Secure token-based authentication.
   - Stream persistence with at-least-once delivery guarantees.
   - Explicit message acknowledgements (`ack`, `nak`, `term`).

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ (tested on Node 22+)
- [Docker](https://www.docker.com/) & Docker Compose (optional, for containerized run)

---

### Option A: Run with Docker Compose (Recommended - 1 Command)

Start all services and NATS JetStream simultaneously:

```bash
docker compose up --build
```

- **API Gateway**: [http://localhost:8000](http://localhost:8000)
- **Swagger Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

### Option B: Run Locally (Without Docker)

1. **Install Dependencies & Build Shared Packages**:
   ```bash
   npm install
   npm run build --workspace=@app/common
   ```

2. **Start NATS Server**:
   If you have NATS installed locally or via Docker:
   ```bash
   docker run -d --name nats-broker -p 4222:4222 -p 8222:8222 nats:alpine -js --auth microservices-secure-nats-token-2026
   ```

3. **Start All Services in Development Mode**:
   ```bash
   npm run dev
   ```

---

## 🧪 Automated Testing

Run unit and integration test suites across all packages:

```bash
npm test
```

---

## 📖 API Documentation & Example Requests

### 1. Register a User
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.doe@example.com",
    "password": "SecurePassword123!",
    "name": "Jane Doe"
  }'
```
*Note: This automatically publishes a `user.created` event to NATS. The Notification Service consumes it and sends a simulated welcome email.*

### 2. Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.doe@example.com",
    "password": "SecurePassword123!"
  }'
```

### 3. Get User Profile (Protected)
```bash
curl -X GET http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### 4. Update Profile (Triggers `user.updated` Event)
```bash
curl -X PATCH http://localhost:8000/api/v1/users/me \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Jane Smith"}'
```

### 5. Forgot Password (Triggers `user.password_reset` Event)
```bash
curl -X POST http://localhost:8000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "jane.doe@example.com"}'
```

### 6. View Notification Audit Logs
```bash
curl -X GET http://localhost:8000/api/v1/notifications/audit-logs \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

---

## 🛡️ Security & Scalability Features

- **Secure Message Broker**: NATS requires authenticated tokens; unauthenticated services cannot inject or snoop on events.
- **Durable JetStream Storage**: Events survive service restarts and broker restarts.
- **Idempotency**: Prevents double-notification dispatch during network partitions or redeliveries.
- **Graceful Shutdown**: All services handle `SIGINT` / `SIGTERM` signals and cleanly drain connections.
- **Rate Limiting & Correlation IDs**: Built-in edge protection and full observability across distributed logs.

---

## 📁 Repository Structure

```
├── config/
│   └── nats.conf                 # Secure NATS JetStream broker configuration
├── docs/
│   ├── architecture.md           # Distributed architecture diagrams & deep dive
│   └── api-requests.http         # Ready-to-run HTTP requests file for IDEs
├── packages/
│   └── common/                   # Shared TypeScript schemas, events & interfaces
├── services/
│   ├── api-gateway/              # Express API Gateway, Rate Limiter, Swagger, Auth Proxy
│   ├── user-service/             # User Management, Auth, Bcrypt, JetStream Event Publisher
│   └── notification-service/     # JetStream Consumer, Idempotency DB, Dispatcher
├── docker-compose.yml            # Multi-service container orchestration
├── package.json                  # Workspace monorepo root
└── README.md                     # Setup instructions and documentation
```
