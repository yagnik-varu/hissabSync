# HisaabSync

## Project Overview
**HisaabSync** is a collaborative Room Treasury and Pool Expense Management System designed for shared living arrangements (hostel rooms, shared apartments/flats, trip groups, and student cohorts).

Unlike traditional peer-to-peer debt simplification tools, HisaabSync operates on a **shared treasury pool model**:
1. Members pool funds into a shared room treasury (`Contributions`).
2. When a member pays for a shared room expense out-of-pocket, the system automatically creates a debt owed by the room treasury to that member (`Reimbursements`).
3. When the treasury reimburses the member, the shared treasury balance is debited and recorded in an immutable ledger.

This ensures 100% financial transparency, eliminates messy cross-member peer debts, and provides real-time visibility into the room's shared cash flow.

## Tech Stack
- **Backend Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT (Access & Refresh Tokens)
- **Infrastructure:** Docker & Docker Compose

## Local Development Setup

Follow these steps to run the application locally for development:

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Copy the example environment file and update if necessary.
   ```bash
   cp .env.example .env
   ```

3. **Start the Development Database:**
   Spin up the local PostgreSQL database using Docker Compose:
   ```bash
   docker compose -f docker/docker-compose.dev.yml up -d
   ```

4. **Run Database Migrations and Seed Data:**
   Initialize the database schema and populate it with seed data (test users, rooms, categories, and initial treasury balances):
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

5. **Start the Application:**
   ```bash
   # Development watch mode
   npm run start:dev
   ```

## Running Tests

The repository includes both unit tests for domain logic and comprehensive E2E test suites covering business journeys, RBAC, and ledger consistency.

```bash
# Run unit tests
npm run test

# Run end-to-end tests
npm run test:e2e
```

## API Documentation

HisaabSync provides an interactive OpenAPI (Swagger) documentation interface.
Once the application is running, navigate to:
**[http://localhost:3000/api/docs](http://localhost:3000/api/docs)**

---
For production deployment instructions, please refer to the [Deployment Guide](docs/DEPLOYMENT.md).
