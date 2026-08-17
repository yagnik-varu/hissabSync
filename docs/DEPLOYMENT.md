# HisaabSync Deployment Guide

This guide covers how to deploy HisaabSync in a production environment using the provided multi-stage Dockerfile and secure Docker Compose configuration.

## Required Environment Variables

Before deploying, ensure you have a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=production
API_PREFIX=api/v1
CORS_ORIGIN=https://your-frontend-domain.com

# PostgreSQL Database (Internal network URL for the API container)
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public

# Database Credentials
POSTGRES_USER=secure_user
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=hisaabsync_db

# JWT Authentication
JWT_SECRET=your_super_secret_access_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_super_secret_refresh_key
JWT_REFRESH_EXPIRES_IN=7d
```

## Building and Running the Application

HisaabSync uses a production-ready `docker-compose.prod.yml` that securely provisions a PostgreSQL database alongside the NestJS API.

### Security Note
Unlike the development compose file, the production configuration **does not expose the Postgres port (5432) to the host machine**. The database is completely isolated on the internal Docker network. The only way to interact with the system is through the API container, which is heavily fortified with rate-limiting, RBAC guards, and input validation.

### Start the Services

To build the images and run the containers in the background, run:

```bash
docker compose --env-file .env -f docker/docker-compose.prod.yml up -d --build
```

*Note: The `--env-file` flag is necessary because the compose file is located in a subdirectory (`docker/`), so it doesn't automatically detect the root `.env` file.*

## Running Production Database Migrations

Because the database port is not exposed to the host, you cannot run `npx prisma migrate deploy` directly from your host machine against the production database. 

Instead, execute the migrations from inside the running API container:

```bash
docker exec -it hisaabsync_api_prod npx prisma migrate deploy
```

This applies any pending migrations directly to the production database safely and internally.

## Uptime Monitoring & Health Checks

The API exposes a public, unauthenticated endpoint specifically designed for uptime monitoring tools, orchestrators, and load balancers:

**GET `/api/v1/health`**

This endpoint executes lightweight pings against the database and checks memory heap usage. The Docker container itself is configured with a native `HEALTHCHECK` directive that polls this endpoint, meaning orchestrators (like Docker Swarm or Kubernetes) can accurately track the container's readiness state and auto-restart it if it becomes unhealthy.
