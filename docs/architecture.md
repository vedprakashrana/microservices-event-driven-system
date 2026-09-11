# Distributed Microservices Architecture Specification

## 1. System Overview

This system is an enterprise-grade distributed microservices architecture consisting of **API Gateway**, **User Service**, and **Notification Service**, powered by **NATS JetStream** for non-REST, non-WebSocket asynchronous message streaming.

```
                  +-----------------------------------+
                  |        Client Application         |
                  |     (Web / Mobile / Third Party)  |
                  +-----------------+-----------------+
                                    |
                                    | HTTPS / REST
                                    v
                  +-----------------------------------+
                  |            API GATEWAY            |
                  |         (Port: 8000, Express)     |
                  |                                   |
                  |  * Rate Limiting (100 req/min)    |
                  |  * Correlation ID (X-Request-Id)  |
                  |  * JWT Auth & Claims Forwarding   |
                  |  * Reverse Proxy Routing          |
                  |  * OpenAPI / Swagger Documentation|
                  +--------+-----------------+--------+
                           |                 |
            HTTP / Internal|                 |HTTP / Read-only Audit
                           v                 v
+----------------------------+     +-------------------------------+
|        USER SERVICE        |     |     NOTIFICATION SERVICE      |
|    (Port: 8001, Express)   |     |     (Port: 8002, Express)     |
|                            |     |                               |
|  * User Register & Login   |     |  * Durable JetStream Consumer |
|  * Password Hashing        |     |  * Idempotent Deduplication   |
|  * JWT Issuer & Validator  |     |  * Multi-Channel Dispatcher   |
|  * SQLite / Postgres DB    |     |  * Notification Audit Logs    |
|  * JetStream Event Pub     |     |  * Failure & DLQ Handler      |
+--------------+-------------+     +---------------+---------------+
               |                                   ^
               | JetStream Publish                 | JetStream Ack/Pull
               | (user.* subjects)                 | Consumer Group
               +-----------------+-----------------+
                                 |
                                 v
               +-----------------------------------+
               |        NATS JETSTREAM BROKER      |
               |        (Port: 4222, Secure Auth)  |
               |                                   |
               |  * Stream: USER_EVENTS_STREAM     |
               |  * Subjects: user.created,        |
               |    user.updated,                  |
               |    user.password_reset            |
               |  * Durable Consumer Groups        |
               |  * At-Least-Once Delivery Guarantees|
               +-----------------------------------+
```

---

## 2. Asynchronous Event-Driven Architecture (No REST/WS Inter-Service)

### Why NATS JetStream?
1. **Zero HTTP/REST Coupling**: Services do not know each other's network addresses or availability.
2. **Guaranteed Delivery (At-Least-Once)**: Messages are committed to the JetStream file/memory engine and require explicit acknowledgement (`msg.ack()`).
3. **Durable Consumers**: If the Notification Service goes offline during high load or crashes, NATS retains messages until the worker group comes back online.
4. **Built-in Dead Letter Queue (DLQ)**: Configured with `max_deliver: 5`. Messages that repeatedly fail will be terminated (`msg.term()`) or routed to DLQ.
5. **Idempotent Handling**: The Notification Service enforces event deduplication through unique UUID keys stored in the database.

---

## 3. Security Considerations

1. **Edge-to-Core Security**: API Gateway validates JWT tokens using HMAC-SHA256, injects authenticated user headers (`x-user-id`, `x-user-email`), and rejects unauthorized calls before they reach internal microservices.
2. **Broker Security**: NATS is configured with custom authorization tokens (`microservices-secure-nats-token-2026`). Unauthenticated clients cannot subscribe or publish to message streams.
3. **Password Hashing**: Salted bcrypt hashing with 10 cost factor rounds.
4. **Traceability**: All requests propagate `x-request-id` headers through HTTP proxying and NATS message envelopes.
