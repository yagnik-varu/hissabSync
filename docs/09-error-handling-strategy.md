# HisaabSync - Error Handling & Exception Strategy v1

## 1. Global Error Architecture

HisaabSync enforces a predictable, standardized JSON response structure across all REST API endpoints. Internal infrastructure details and raw stack traces are sanitized in production.

### Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "TREASURY_INSUFFICIENT_BALANCE",
    "message": "Treasury balance is insufficient to process this reimbursement payout.",
    "details": []
  },
  "timestamp": "2026-08-08T12:00:00.000Z",
  "path": "/api/v1/rooms/r-1234/reimbursements/reimb-5678/pay"
}
```

### Validation Error Response Format (400 Bad Request)
When input validation fails via `class-validator` / `ValidationPipe`:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Input validation failed on one or more fields.",
    "details": [
      {
        "field": "amount",
        "value": -50,
        "constraint": "isPositive",
        "message": "amount must be a positive number"
      },
      {
        "field": "title",
        "value": "",
        "constraint": "isNotEmpty",
        "message": "title should not be empty"
      }
    ]
  },
  "timestamp": "2026-08-08T12:00:00.000Z",
  "path": "/api/v1/rooms/r-1234/expenses"
}
```

---

## 2. Standard Domain Error Codes Catalog

### Authentication (`AUTH_*`)
| Error Code | HTTP Status | Description |
|---|:---:|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | Email or password incorrect. |
| `AUTH_INVALID_TOKEN` | 401 | JWT access token is malformed or invalid. |
| `AUTH_EXPIRED_TOKEN` | 401 | JWT access token has expired. |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Refresh token is invalid or has been revoked. |
| `AUTH_EMAIL_ALREADY_EXISTS` | 409 | A user with this email is already registered. |

### Authorization & RBAC (`RBAC_*` / `ROOM_*`)
| Error Code | HTTP Status | Description |
|---|:---:|---|
| `ROOM_ACCESS_DENIED` | 403 | User is not an active member of the requested room. |
| `INSUFFICIENT_PERMISSION` | 403 | User's room role lacks permission to perform this action. |
| `ROOM_LAST_ADMIN_CANNOT_LEAVE`| 400 | The last Admin must transfer ownership before leaving or demoting. |
| `ROOM_MEMBER_NOT_ACTIVE` | 403 | Membership status is not ACTIVE (e.g. PENDING or LEFT). |

### Room & Category (`ROOM_*` / `CATEGORY_*`)
| Error Code | HTTP Status | Description |
|---|:---:|---|
| `ROOM_NOT_FOUND` | 404 | Room with given ID or roomCode does not exist. |
| `ROOM_ALREADY_ARCHIVED` | 400 | Operation blocked because the room is archived. |
| `JOIN_REQUEST_NOT_FOUND` | 404 | Join request does not exist. |
| `JOIN_REQUEST_ALREADY_PROCESSED` | 409 | Join request has already been approved or rejected. |
| `CATEGORY_NOT_FOUND` | 404 | Expense category does not exist in this room. |
| `CATEGORY_NAME_DUPLICATE` | 409 | A category with this name already exists in this room. |

### Treasury & Contributions (`TREASURY_*` / `CONTRIBUTION_*`)
| Error Code | HTTP Status | Description |
|---|:---:|---|
| `TREASURY_NOT_FOUND` | 404 | Treasury account not found for room. |
| `TREASURY_INSUFFICIENT_BALANCE`| 400 | Payout blocked because Strict Treasury balance would drop below ₹0. |
| `CONTRIBUTION_NOT_FOUND` | 404 | Contribution record does not exist. |
| `CONTRIBUTION_ALREADY_PROCESSED` | 409 | Contribution has already been approved or rejected. |
| `CONTRIBUTION_CANNOT_CANCEL` | 400 | Only PENDING contributions can be cancelled by the submitter. |

### Expenses & Reimbursements (`EXPENSE_*` / `REIMBURSEMENT_*`)
| Error Code | HTTP Status | Description |
|---|:---:|---|
| `EXPENSE_NOT_FOUND` | 404 | Expense record does not exist. |
| `EXPENSE_ALREADY_PROCESSED` | 409 | Expense has already been approved or rejected. |
| `EXPENSE_CANNOT_CANCEL` | 400 | Only PENDING expenses can be cancelled by the submitter. |
| `REIMBURSEMENT_NOT_FOUND` | 404 | Reimbursement record not found. |
| `REIMBURSEMENT_ALREADY_PAID` | 409 | Reimbursement has already been paid out. |

### Concurrency & System (`SYSTEM_*`)
| Error Code | HTTP Status | Description |
|---|:---:|---|
| `CONCURRENCY_CONFLICT` | 409 | Concurrent modification detected. Retry operation. |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled server exception. Details logged internally. |

---

## 3. NestJS Global Exception Filter Architecture

The system uses a unified `AllExceptionsFilter` implementing `ExceptionFilter`:

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: any[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      code = res.code || (status === 400 ? 'VALIDATION_FAILED' : 'HTTP_EXCEPTION');
      message = res.message || exception.message;
      details = res.details || [];
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'RESOURCE_ALREADY_EXISTS';
        message = 'Unique constraint violation';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'RESOURCE_NOT_FOUND';
        message = 'Requested record does not exist';
      }
    }

    this.logger.error(`[${request.method}] ${request.url} - Status: ${status} - Code: ${code} - Msg: ${message}`);

    response.status(status).json({
      success: false,
      error: { code, message, details },
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```
