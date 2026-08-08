# HisaabSync - Sequence Diagrams v1

## 1. Expense Submission & Approval Flow

```mermaid
sequenceDiagram
    autonumber
    actor Member as Submitting Member
    actor Admin as Admin / Accountant
    participant Controller as ExpenseController
    participant Service as ExpenseService
    participant DB as PostgreSQL (Prisma)
    participant EventBus as EventEmitter2
    participant ReimbSvc as ReimbursementService
    participant NotifSvc as NotificationService

    Note over Member,DB: Step 1: Submit Expense
    Member->>Controller: POST /rooms/:roomId/expenses (amount, title, categoryId, receiptUrl)
    Controller->>Service: submitExpense(roomId, userId, dto)
    Service->>DB: CREATE Expense (status = PENDING)
    DB-->>Service: Expense record created
    Service->>EventBus: emit('expense.submitted', event)
    EventBus-->>NotifSvc: notifyAdminsAndAccountants()
    Service-->>Controller: Return created expense
    Controller-->>Member: 201 Created

    Note over Admin,DB: Step 2: Approve Expense
    Admin->>Controller: PATCH /rooms/:roomId/expenses/:id/approve
    Controller->>Service: approveExpense(roomId, expenseId, adminId)
    Service->>DB: UPDATE Expense (status = APPROVED, reviewedBy = adminId)
    DB-->>Service: Expense approved
    Service->>EventBus: emit('expense.approved', event)
    
    par Async Reimbursement Creation
        EventBus->>ReimbSvc: handleExpenseApproved(event)
        ReimbSvc->>DB: CREATE Reimbursement (status = PENDING_PAYMENT, amount = expense.amount)
        DB-->>ReimbSvc: Reimbursement created
    and Async Notification Dispatch
        EventBus->>NotifSvc: handleExpenseApproved(event)
        NotifSvc->>DB: CREATE Notification for submitting member
    end

    Service-->>Controller: Return approval confirmation
    Controller-->>Admin: 200 OK
```

---

## 2. Contribution Submission & Approval Flow

```mermaid
sequenceDiagram
    autonumber
    actor Member as Contributor
    actor Admin as Admin / Accountant
    participant Controller as TreasuryController
    participant Service as TreasuryService
    participant DB as PostgreSQL (Prisma)
    participant EventBus as EventEmitter2
    participant NotifSvc as NotificationService

    Member->>Controller: POST /rooms/:roomId/contributions (amount, note)
    Controller->>Service: submitContribution(roomId, userId, dto)
    Service->>DB: CREATE Contribution (status = PENDING)
    DB-->>Service: Contribution record
    Service-->>Controller: 201 Created
    Controller-->>Member: Contribution submitted

    Admin->>Controller: PATCH /rooms/:roomId/contributions/:id/approve
    Controller->>Service: approveContribution(roomId, id, adminId)
    
    rect rgb(240, 248, 255)
        Note over Service,DB: Atomic Database Transaction
        Service->>DB: 1. UPDATE Contribution (status = APPROVED)
        Service->>DB: 2. INSERT TreasuryTransaction (CREDIT, CONTRIBUTION, amount)
        Service->>DB: 3. UPDATE TreasuryAccount (currentBalance += amount)
    end

    Service->>EventBus: emit('contribution.approved', event)
    EventBus->>NotifSvc: handleContributionApproved(event)
    NotifSvc->>DB: CREATE Notification for contributor
    Service-->>Controller: Return approved contribution & new balance
    Controller-->>Admin: 200 OK
```

---

## 3. Reimbursement Payout Flow (Strict vs Flexible Treasury)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin / Accountant
    participant Controller as ReimbursementController
    participant Service as ReimbursementService
    participant DB as PostgreSQL (Prisma)
    participant EventBus as EventEmitter2
    participant NotifSvc as NotificationService

    Admin->>Controller: PATCH /rooms/:roomId/reimbursements/:id/pay
    Controller->>Service: payReimbursement(roomId, id, adminId)
    
    Service->>DB: Fetch TreasuryAccount & RoomSettings
    DB-->>Service: Treasury & Settings data

    alt Strict Mode (allowNegativeTreasury == false) AND balance < amount
        Service-->>Controller: Throw BadRequestException('TREASURY_INSUFFICIENT_BALANCE')
        Controller-->>Admin: 400 Bad Request (Insufficient Balance)
    else Balance OK OR Flexible Mode Enabled
        rect rgb(240, 248, 255)
            Note over Service,DB: Atomic Database Transaction
            Service->>DB: 1. UPDATE Reimbursement (status = PAID, paidBy, paidAt)
            Service->>DB: 2. INSERT TreasuryTransaction (DEBIT, REIMBURSEMENT, amount)
            Service->>DB: 3. UPDATE TreasuryAccount (currentBalance -= amount)
        end
        Service->>EventBus: emit('reimbursement.paid', event)
        EventBus->>NotifSvc: handleReimbursementPaid(event)
        NotifSvc->>DB: CREATE Notification for beneficiary
        Service-->>Controller: Return paid confirmation & updated balance
        Controller-->>Admin: 200 OK
    end
```

---

## 4. Room Join Request & Approval Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Prospective Member
    actor Admin as Room Admin
    participant Controller as RoomController
    participant Service as RoomService
    participant DB as PostgreSQL (Prisma)
    participant EventBus as EventEmitter2
    participant NotifSvc as NotificationService

    User->>Controller: POST /rooms/join (roomCode)
    Controller->>Service: requestJoin(userId, roomCode)
    Service->>DB: CREATE JoinRequest (status = PENDING)
    DB-->>Service: JoinRequest record
    Service->>EventBus: emit('room.join.requested', event)
    EventBus->>NotifSvc: Notify Room Admins
    Service-->>Controller: 201 Created
    Controller-->>User: Join Request submitted

    Admin->>Controller: PATCH /rooms/:roomId/join-requests/:requestId/approve
    Controller->>Service: approveJoin(roomId, requestId, adminId)
    rect rgb(240, 248, 255)
        Service->>DB: 1. UPDATE JoinRequest (status = APPROVED)
        Service->>DB: 2. CREATE RoomMember (role = MEMBER, status = ACTIVE)
    end
    Service->>EventBus: emit('room.member.added', event)
    EventBus->>NotifSvc: Notify User of approval
    Service-->>Controller: 200 OK
    Controller-->>Admin: Member added to room
```

---

## 5. Authentication & Token Refresh Flow

```mermaid
sequenceDiagram
    autonumber
    actor Client as Web/Mobile Client
    participant AuthController
    participant AuthService
    participant DB as PostgreSQL (Prisma)

    Client->>AuthController: POST /auth/login (email, password)
    AuthController->>AuthService: login(dto)
    AuthService->>DB: Find user by email
    DB-->>AuthService: User & passwordHash
    AuthService->>AuthService: Verify bcrypt password hash
    AuthService->>DB: CREATE RefreshToken (hashedToken, expiresAt)
    AuthService-->>AuthController: Return AccessToken (15m) + RefreshToken (7d)
    AuthController-->>Client: 200 OK

    Note over Client,DB: Token Refresh Cycle
    Client->>AuthController: POST /auth/refresh (refreshToken)
    AuthController->>AuthService: refresh(refreshToken)
    AuthService->>DB: Find & validate stored tokenHash
    AuthService->>DB: DELETE old RefreshToken & CREATE new RefreshToken (Rotation)
    AuthService-->>AuthController: Return new AccessToken + new RefreshToken
    AuthController-->>Client: 200 OK
```
