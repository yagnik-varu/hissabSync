# HisaabSync - Coding Standards & Best Practices v1

## 1. Core Engineering Principles

All code written for HisaabSync must adhere to:
- **SOLID Principles**: Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, Dependency Inversion.
- **Clean Code**: Self-explanatory naming, small focused functions, minimal nesting.
- **DRY (Don't Repeat Yourself)** & **KISS (Keep It Simple, Stupid)**.
- **Defensive Financial Programming**: Every financial calculation and state mutation must be idempotent and mathematically exact.

---

## 2. Naming & File Conventions

| Item | Convention | Examples |
|---|---|---|
| **Files & Directories** | `kebab-case` | `expense.service.ts`, `create-expense.dto.ts`, `room-member.guard.ts` |
| **Classes & Interfaces**| `PascalCase` | `ExpenseService`, `CreateExpenseDto`, `IRoomRepository` |
| **Methods & Variables** | `camelCase` | `calculateTreasuryBalance()`, `roomId`, `currentBalance` |
| **Constants & Enums**   | `UPPER_SNAKE_CASE` | `MAX_ROOM_MEMBERS`, `DEFAULT_PAGE_SIZE`, `Role.ADMIN` |
| **Event Names**         | `dot.notation` | `expense.approved`, `contribution.approved`, `room.created` |

---

## 3. Financial Precision & Money Calculations

> [!CAUTION]
> **Zero Floating-Point Math**: Never use JavaScript's primitive `number` (`+`, `-`, `*`, `/`) for calculating money amounts or account balances. JavaScript floating-point errors (e.g. `0.1 + 0.2 = 0.30000000000000004`) lead to ledger discrepancies.

### Financial Rules:
1. Always use **`Prisma.Decimal`** (or `Decimal.js`) for all monetary calculations:
   ```ts
   import { Decimal } from '@prisma/client/runtime/library';

   // ✅ CORRECT:
   const newBalance = currentBalance.plus(contributionAmount);
   if (newBalance.lessThan(0)) {
     throw new BadRequestException('TREASURY_INSUFFICIENT_BALANCE');
   }

   // ❌ FORBIDDEN:
   const newBalance = Number(currentBalance) + Number(contributionAmount);
   ```
2. Database columns for money must always be `DECIMAL(12, 2)`.
3. In DTOs, validate monetary inputs with `@IsNumberString()` or `@Type(() => Number)` with `@IsPositive()`.

---

## 4. Database Transactions & Atomic Operations

> [!IMPORTANT]
> Any business operation that alters more than one database table or impacts the financial ledger **must be wrapped inside an interactive database transaction (`prisma.$transaction`)**.

```ts
// Example: Safe ledger mutation inside ACID transaction
await this.prisma.$transaction(async (tx) => {
  // 1. Pessimistic check / lock
  const treasury = await tx.treasuryAccount.findUniqueOrThrow({ where: { roomId } });
  
  // 2. Perform state updates
  await tx.reimbursement.update({ where: { id: reimbId }, data: { status: 'PAID' } });
  
  // 3. Write immutable ledger record
  await tx.treasuryTransaction.create({
    data: {
      roomId,
      transactionType: 'DEBIT',
      referenceType: 'REIMBURSEMENT',
      referenceId: reimbId,
      amount,
      description: 'Reimbursement payout',
      createdBy: adminId,
    }
  });

  // 4. Update materialized cache
  await tx.treasuryAccount.update({
    where: { roomId },
    data: { currentBalance: { decrement: amount } }
  });
});
```

---

## 5. TypeScript & NestJS Strictness

1. **TypeScript Strict Mode**: `tsconfig.json` must enforce `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`.
2. **No `any` Type**: Use `unknown`, generics, or explicit interfaces.
3. **DTO Validation**: Every controller request body must be a typed class decorated with `class-validator` decorators (`@IsUUID()`, `@IsString()`, `@IsNotEmpty()`, `@IsOptional()`).
4. **UTC Dates**: All dates stored in the database and serialized over HTTP must be ISO 8601 UTC strings (`new Date().toISOString()`).

---

## 6. Error Handling & Custom Domain Exceptions

1. Throw semantic domain exceptions instead of generic `Error` or ad-hoc strings:
   ```ts
   // ✅ GOOD:
   throw new NotFoundException('ROOM_NOT_FOUND');
   throw new BadRequestException('TREASURY_INSUFFICIENT_BALANCE');
   throw new ForbiddenException('ROOM_ACCESS_DENIED');

   // ❌ BAD:
   throw new Error('Room not found');
   ```
2. Sanitization: Never leak database stack traces, SQL queries, or internal file paths to API clients.

---

## 7. Logging & Security Standards

- **Log**: Administrative role changes, financial approvals, payout executions, authentication failures, and unhandled server errors.
- **Do Not Log**: User passwords, JWT refresh tokens, credit card details, or PII.
- **Swagger Documentation**: Every endpoint must be annotated with `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()`, and `@ApiBearerAuth()`.

---

## 8. Definition of Done (DoD) for Pull Requests

A feature branch is ready for merge only when:
- [ ] Code is fully implemented adhering to modular architecture rules.
- [ ] Unit tests (`*.spec.ts`) pass with ≥ 80% coverage on domain services.
- [ ] Multi-table financial operations execute inside `prisma.$transaction`.
- [ ] Swagger annotations are complete with sample request/response schemas.
- [ ] `class-validator` rules are defined on all request DTOs.
- [ ] RBAC guards and role permissions are verified.
- [ ] ESLint and Prettier checks pass with zero errors.
