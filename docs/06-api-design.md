# HisaabSync - REST API Specification v1

## 1. Global Standards & Conventions

- **Base URL**: `/api/v1`
- **Protocol**: HTTPS / REST
- **Content Type**: `application/json`
- **Authentication**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`

### Standard Success Response Wrapper
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

### Standard Paginated Response Wrapper
```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 45,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### Standard Error Response Wrapper
```json
{
  "success": false,
  "error": {
    "code": "TREASURY_INSUFFICIENT_BALANCE",
    "message": "Treasury balance is insufficient for this reimbursement.",
    "details": []
  }
}
```

---

## 2. Authentication Module (`/auth`)

### 1. Register User
- **Method**: `POST /auth/register`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "fullName": "Yagnik Varu",
    "email": "yagnik@example.com",
    "password": "StrongPassword123!",
    "phone": "+919876543210"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": {
      "user": {
        "id": "u-1234-uuid",
        "fullName": "Yagnik Varu",
        "email": "yagnik@example.com"
      },
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi..."
    }
  }
  ```

### 2. Login User
- **Method**: `POST /auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "yagnik@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response (200 OK)**: Access & Refresh tokens.

### 3. Refresh Access Token
- **Method**: `POST /auth/refresh`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Response (200 OK)**: New `accessToken` and rotated `refreshToken`.

### 4. Logout
- **Method**: `POST /auth/logout`
- **Access**: Authenticated
- **Request Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```
- **Response (200 OK)**: Invalidation confirmation.

### 5. Get Current Profile
- **Method**: `GET /auth/me`
- **Access**: Authenticated
- **Response (200 OK)**: User profile details.

### 6. Update Profile
- **Method**: `PATCH /auth/profile`
- **Access**: Authenticated
- **Request Body**:
  ```json
  {
    "fullName": "Yagnik Varu",
    "phone": "+919876543210",
    "profileImageUrl": "https://cdn.example.com/avatar.png"
  }
  ```
- **Response (200 OK)**: Updated user profile.

### 7. Change Password
- **Method**: `PATCH /auth/change-password`
- **Access**: Authenticated
- **Request Body**:
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewStrongPassword123!"
  }
  ```

---

## 3. Room Management Module (`/rooms`)

### 1. Create Room
- **Method**: `POST /rooms`
- **Access**: Authenticated
- **Request Body**:
  ```json
  {
    "name": "Flat 402 Boys",
    "description": "Shared apartment expense pool",
    "currencyCode": "INR",
    "allowNegativeTreasury": false
  }
  ```
- **Response (201 Created)**: Created room details with generated `roomCode`.

### 2. List My Rooms
- **Method**: `GET /rooms`
- **Access**: Authenticated
- **Query Params**: `status` (`ACTIVE`|`ARCHIVED`), `page`, `limit`
- **Response (200 OK)**: List of rooms the user belongs to.

### 3. Get Room Details
- **Method**: `GET /rooms/:roomId`
- **Access**: Room Member
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "r-1234-uuid",
      "name": "Flat 402 Boys",
      "roomCode": "FLAT402",
      "myRole": "ADMIN",
      "memberCount": 4,
      "treasuryBalance": "7500.00",
      "pendingExpensesCount": 2,
      "pendingContributionsCount": 1,
      "settings": {
        "allowNegativeTreasury": false,
        "currencyCode": "INR"
      }
    }
  }
  ```

### 4. Update Room Details & Settings
- **Method**: `PATCH /rooms/:roomId`
- **Access**: Room Admin
- **Request Body**:
  ```json
  {
    "name": "Flat 402 - 2026",
    "description": "Updated description",
    "allowNegativeTreasury": true
  }
  ```

### 5. Join Room via Code
- **Method**: `POST /rooms/join`
- **Access**: Authenticated
- **Request Body**:
  ```json
  {
    "roomCode": "FLAT402"
  }
  ```
- **Response (201 Created)**: Join request confirmation in `PENDING` status.

### 6. List Join Requests
- **Method**: `GET /rooms/:roomId/join-requests`
- **Access**: Admin / Accountant
- **Query Params**: `status` (`PENDING`|`APPROVED`|`REJECTED`)

### 7. Approve / Reject Join Request
- **Method**: `PATCH /rooms/:roomId/join-requests/:requestId/approve`
- **Access**: Room Admin
- **Method**: `PATCH /rooms/:roomId/join-requests/:requestId/reject`
- **Access**: Room Admin
- **Request Body (Reject)**:
  ```json
  {
    "rejectionReason": "You are not a member of Flat 402."
  }
  ```

### 8. List Room Members
- **Method**: `GET /rooms/:roomId/members`
- **Access**: Room Member

### 9. Change Member Role
- **Method**: `PATCH /rooms/:roomId/members/:userId/role`
- **Access**: Room Admin
- **Request Body**:
  ```json
  {
    "role": "ACCOUNTANT"
  }
  ```

### 10. Remove / Kick Member
- **Method**: `DELETE /rooms/:roomId/members/:userId`
- **Access**: Room Admin

### 11. Request Leave Room
- **Method**: `POST /rooms/:roomId/leave-request`
- **Access**: Room Member

### 12. Approve / Reject Leave Request
- **Method**: `PATCH /rooms/:roomId/leave-requests/:requestId/approve`
- **Method**: `PATCH /rooms/:roomId/leave-requests/:requestId/reject`
- **Access**: Room Admin

---

## 4. Expense Categories Module (`/rooms/:roomId/categories`)

### 1. List Categories
- **Method**: `GET /rooms/:roomId/categories`
- **Access**: Room Member

### 2. Create Category
- **Method**: `POST /rooms/:roomId/categories`
- **Access**: Admin / Accountant
- **Request Body**:
  ```json
  {
    "name": "Groceries"
  }
  ```

### 3. Delete Category
- **Method**: `DELETE /rooms/:roomId/categories/:categoryId`
- **Access**: Room Admin

---

## 5. Treasury Module (`/rooms/:roomId/treasury`)

### 1. Get Treasury Summary
- **Method**: `GET /rooms/:roomId/treasury`
- **Access**: Room Member
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "currentBalance": "7500.00",
      "totalContributions": "25000.00",
      "totalReimbursements": "17500.00",
      "currencyCode": "INR"
    }
  }
  ```

### 2. Submit Contribution
- **Method**: `POST /rooms/:roomId/contributions`
- **Access**: Room Member
- **Request Body**:
  ```json
  {
    "amount": "2000.00",
    "note": "August Treasury Share"
  }
  ```

### 3. List Contributions
- **Method**: `GET /rooms/:roomId/contributions`
- **Access**: Room Member
- **Query Params**: `status`, `contributorId`, `dateFrom`, `dateTo`, `page`, `limit`

### 4. Cancel Own Pending Contribution
- **Method**: `DELETE /rooms/:roomId/contributions/:id`
- **Access**: Submitting Member (Precondition: `PENDING`)

### 5. Approve Contribution
- **Method**: `PATCH /rooms/:roomId/contributions/:id/approve`
- **Access**: Admin / Accountant
- **Response (200 OK)**: Approved status and updated treasury balance.

### 6. Reject Contribution
- **Method**: `PATCH /rooms/:roomId/contributions/:id/reject`
- **Access**: Admin / Accountant
- **Request Body**:
  ```json
  {
    "rejectionReason": "Payment proof not verified."
  }
  ```

### 7. Get Treasury Ledger Transactions
- **Method**: `GET /rooms/:roomId/treasury/transactions`
- **Access**: Room Member
- **Query Params**: `transactionType` (`CREDIT`|`DEBIT`), `referenceType`, `dateFrom`, `dateTo`, `page`, `limit`

### 8. Manual Treasury Adjustment
- **Method**: `POST /rooms/:roomId/treasury/adjustments`
- **Access**: Room Admin
- **Request Body**:
  ```json
  {
    "transactionType": "CREDIT",
    "amount": "500.00",
    "description": "Cashback received on electricity bill refund"
  }
  ```

---

## 6. Expense Module (`/rooms/:roomId/expenses`)

### 1. Submit Expense
- **Method**: `POST /rooms/:roomId/expenses`
- **Access**: Room Member
- **Request Body**:
  ```json
  {
    "categoryId": "c-1234-uuid",
    "amount": "1450.00",
    "title": "Weekly Vegetables & Dairy",
    "description": "Bought from Reliance Smart",
    "receiptUrl": "https://cdn.example.com/receipts/rec-01.jpg"
  }
  ```

### 2. List Expenses
- **Method**: `GET /rooms/:roomId/expenses`
- **Access**: Room Member
- **Query Params**: `status`, `categoryId`, `submittedBy`, `dateFrom`, `dateTo`, `page`, `limit`

### 3. Get Expense Details
- **Method**: `GET /rooms/:roomId/expenses/:id`
- **Access**: Room Member

### 4. Cancel Own Pending Expense
- **Method**: `DELETE /rooms/:roomId/expenses/:id`
- **Access**: Submitting Member (Precondition: `PENDING`)

### 5. Approve Expense
- **Method**: `PATCH /rooms/:roomId/expenses/:id/approve`
- **Access**: Admin / Accountant
- **Response (200 OK)**: Expense marked `APPROVED`, auto-generated reimbursement info returned.

### 6. Reject Expense
- **Method**: `PATCH /rooms/:roomId/expenses/:id/reject`
- **Access**: Admin / Accountant
- **Request Body**:
  ```json
  {
    "rejectionReason": "Receipt missing or unreadable."
  }
  ```

---

## 7. Reimbursement Module (`/rooms/:roomId/reimbursements`)

### 1. List Reimbursements
- **Method**: `GET /rooms/:roomId/reimbursements`
- **Access**: Room Member
- **Query Params**: `status` (`PENDING_PAYMENT`|`PAID`), `beneficiaryId`, `page`, `limit`

### 2. Get Reimbursement Details
- **Method**: `GET /rooms/:roomId/reimbursements/:id`
- **Access**: Room Member

### 3. Mark Reimbursement as Paid
- **Method**: `PATCH /rooms/:roomId/reimbursements/:id/pay`
- **Access**: Admin / Accountant
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Reimbursement marked as paid and treasury ledger debited",
    "data": {
      "id": "reimb-1234-uuid",
      "status": "PAID",
      "paidAt": "2026-08-08T12:30:00.000Z",
      "treasuryNewBalance": "6050.00"
    }
  }
  ```

---

## 8. Notification & Audit Modules

### 1. List My Notifications
- **Method**: `GET /notifications`
- **Access**: Authenticated
- **Query Params**: `isRead` (boolean), `page`, `limit`

### 2. Mark Notification as Read
- **Method**: `PATCH /notifications/:id/read`
- **Access**: Authenticated

### 3. Mark All Notifications as Read
- **Method**: `PATCH /notifications/read-all`
- **Access**: Authenticated

### 4. Room Activity Timeline
- **Method**: `GET /rooms/:roomId/activity`
- **Access**: Room Member
- **Query Params**: `dateFrom`, `dateTo`, `page`, `limit`

---

## 9. System Health Check

### Health Check
- **Method**: `GET /health`
- **Access**: Public
- **Response (200 OK)**: Database and service connectivity status.
