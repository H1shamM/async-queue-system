# Async Queue System

## Overview

This project is a simple asynchronous queue system with an API service, worker service, Redis, and RabbitMQ. It supports job processing, metrics tracking, and integration testing.

## Services

- **API Service**: Express.js server for job submission and monitoring.
- **Worker Service**: Consumes jobs from RabbitMQ and processes them.
- **Redis**: Stores job states and metrics.
- **RabbitMQ**: Message broker to handle the queue.

## Setup

### Requirements

- Node.js >= 18
- Docker & Docker Compose

### Run locally

1. Build and start all services:

```bash
docker-compose up --build
```

1. API will run on `http://localhost:3000`
2. RabbitMQ management UI on `http://localhost:15672`

### Environment Variables

- `.env` file should contain:

```dotenv
REDIS_HOST=redis
REDIS_PORT=6379
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
```

## API Endpoints

### Health Check

```
GET /health
```

Response:

```json
{
  "status": "ok",
  "rabbit": true
}
```

### Submit Job

```
POST /jobs
```

Body:

```json
{
  "type": "string",
  "payload": {...}
}
```

Response (202 Accepted):

```json
{
  "message": "Job accepted!",
  "jobId": "uuid"
}
```

### Job Status

```
GET /jobs/:id
```

Response:

```json
{
  "jobId": "uuid",
  "status": "NEW|PROCESSING|SUCCESS|FAILED"
}
```

### Metrics

```
GET /metrics
```

Response:

```json
{
  "jobs_created": 10,
  "jobs_processing": 2,
  "jobs_success": 5,
  "jobs_failed": 1,
  "jobs_retried": 0,
  "jobs_dlq": 0
}
```

## Graceful Shutdown

- API service closes server on SIGTERM.
- Worker stops consuming and closes RabbitMQ connection.
- Redis and RabbitMQ stop cleanly.

## Integration Tests

Run integration tests with:

```bash
docker-compose run tests
```

Tests wait for the API and RabbitMQ to be ready and clean up resources after execution.

## Docker Compose

Services:

- api
- worker
- redis
- rabbitmq
- tests

Example:

```yaml
version: '3'
services:
  api:
    build: ./api
    ports:
      - 3000:3000
  worker:
    build: ./worker
  redis:
    image: redis:7
  rabbitmq:
    image: rabbitmq:3-management
  tests:
    build: ./tests
    depends_on:
      - api
      - rabbitmq
```

## Notes

- Use UUIDs for job IDs to maintain consistency.
- Rate limiting is applied on API requests.
- Integration tests use `beforeAll` and `afterAll` hooks for setup and cleanup.
- Metrics are stored in Redis for monitoring job counts and statuses.
