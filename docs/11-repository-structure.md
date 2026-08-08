# HisaabSync - Repository Structure v1

## 1. Overview & Architectural Goals

The HisaabSync repository is organized to enforce:
- **Clean modular boundaries** with zero direct cross-module database coupling.
- **Single Responsibility Principle** across controllers, services, and repositories.
- **Seamless microservice extraction** (e.g. converting `modules/notification` or `modules/treasury` into independent services in V2).

---

## 2. Complete Repository Tree Layout

```text
HisaabSync/
├── docs/                        # Complete architectural and domain specifications
│   ├── 01-product-requirements.md
│   ├── 02-domain-model.md
│   ├── 03-event-storming.md
│   ├── 04-system-architecture.md
│   ├── 05-database-design.md
│   ├── 06-api-design.md
│   ├── 07-rbac-design.md
│   ├── 08-sequence-diagrams.md
│   ├── 09-error-handling-strategy.md
│   ├── 10-implementation-roadmap.md
│   ├── 11-repository-structure.md
│   └── 12-coding-standards.md
│
├── prisma/                      # Prisma ORM schema, migrations, and seed scripts
│   ├── schema.prisma            # Single source of database schema truth
│   ├── migrations/              # Auto-generated SQL migrations
│   └── seed.ts                  # Development & demo database seeder
│
├── src/
│   ├── main.ts                  # NestJS application bootstrap
│   ├── app.module.ts            # Root application module
│   │
│   ├── config/                  # Environment & module configuration loaders
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── jwt.config.ts
│   │   ├── swagger.config.ts
│   │   └── throttler.config.ts
│   │
│   ├── common/                  # Shared cross-cutting components
│   │   ├── constants/           # Global system constants
│   │   ├── decorators/          # @CurrentUser(), @CurrentRoom(), @Roles(), @Public()
│   │   ├── dto/                 # PaginationDto, BaseResponseDto
│   │   ├── enums/               # Role, MembershipStatus, TransactionType
│   │   ├── exceptions/          # Domain-specific custom exceptions
│   │   ├── filters/             # AllExceptionsFilter
│   │   ├── guards/              # JwtAuthGuard, RoomMemberGuard, RolesGuard
│   │   ├── interceptors/        # LoggingInterceptor, TransformResponseInterceptor
│   │   ├── pipes/               # ParseUUIDPipe, ValidationPipe
│   │   └── types/               # UserPayload, RoomContext
│   │
│   ├── database/                # Database connection & Prisma service wrapper
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   │
│   ├── events/                  # Application-wide domain event infrastructure
│   │   ├── event-bus.module.ts
│   │   ├── event-names.ts       # Enum of all event names
│   │   └── payloads/            # Typed event payload interfaces
│   │
│   ├── modules/                 # Isolated domain business modules
│   │   ├── auth/                # Authentication & JWT token rotation
│   │   ├── room/                # Rooms, memberships & join/leave requests
│   │   ├── category/            # Room expense categories
│   │   ├── treasury/            # Treasury accounts, contributions & ledger
│   │   ├── expense/             # Shared expenses & receipt proofs
│   │   ├── reimbursement/       # Automated reimbursement debt & payout
│   │   ├── notification/        # In-app user notifications & event handlers
│   │   └── audit/               # Activity feed & compliance audit logs
│   │
│   └── shared/                  # Generic utilities (money math, date helpers)
│       └── utils/
│           ├── decimal.util.ts
│           └── date.util.ts
│
├── test/                        # Automated test suites
│   ├── unit/                    # Isolated service unit tests (*.spec.ts)
│   ├── integration/             # Repository & database integration tests
│   └── e2e/                     # Supertest HTTP end-to-end API test suites
│
├── docker/                      # Docker configurations
│   ├── Dockerfile
│   ├── docker-compose.dev.yml
│   └── docker-compose.prod.yml
│
├── .github/
│   └── workflows/
│       └── ci.yml               # Linting, testing & build verification
│
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Standard Feature Module Directory Structure

Every domain module under `src/modules/<name>/` follows this standardized internal layout:

```text
expense/
├── controllers/          # HTTP Controllers (route decorators, Swagger annotations)
│   └── expense.controller.ts
├── services/             # Core Business Logic & Domain Orchestration
│   └── expense.service.ts
├── repositories/         # Prisma Database Access Layer
│   └── expense.repository.ts
├── dto/                  # Request & Response Data Transfer Objects
│   ├── submit-expense.dto.ts
│   ├── reject-expense.dto.ts
│   └── expense-response.dto.ts
├── entities/             # TypeScript Domain Entity Interfaces
│   └── expense.entity.ts
├── events/               # Module-specific event definitions & handlers
│   ├── expense-submitted.event.ts
│   └── expense-approved.event.ts
├── tests/                # Module unit & integration tests
│   ├── expense.controller.spec.ts
│   └── expense.service.spec.ts
└── expense.module.ts     # NestJS module definition exporting services
```

---

## 4. Architectural Boundaries & Rules

1. **Controllers Contain No Business Logic**: Controllers only validate input, call the service layer, and map responses.
2. **Services Contain All Domain Logic**: Services coordinate transactions, execute business decisions, and emit domain events.
3. **Repositories Abstract Database Queries**: Services never use `PrismaClient` directly; they query through dedicated repositories.
4. **No Cross-Module Database Joins**: If the `ExpenseModule` needs room details, it queries `RoomService` via dependency injection or listens to domain events.
5. **No Circular Dependencies**: NestJS `forwardRef()` is prohibited. Cross-module side-effects must use event-driven messaging (`EventEmitter2`).
6. **All Endpoints Must Be Documented**: Every controller method must include OpenAPI `@ApiTags()`, `@ApiOperation()`, and `@ApiResponse()` annotations.
