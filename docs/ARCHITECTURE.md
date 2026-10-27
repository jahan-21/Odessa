# CampusSplit — System Architecture Document

## 1. Architectural Style: Modular Monolith
CampusSplit is structured as a **Modular Monolith**. This pattern delivers high cohesion, low operational complexity, straightforward transactional boundaries, and immediate testability without the operational overhead of microservices, service meshes, or distributed state management.

```
+-------------------------------------------------------------+
|                      React Single Page App                  |
|          (Vite, React Router, Clean Vanilla CSS System)     |
+-------------------------------------------------------------+
                              |
                              | REST / JSON (HTTP)
                              v
+-------------------------------------------------------------+
|                     Express.js HTTP Layer                   |
|   - Request Validation (Middleware & DTO sanitization)      |
|   - Centralized Error Handling & Rate Limiting              |
|   - Thin Controllers                                        |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                   Application Service Layer                 |
|   - EventService, ParticipantService, ExpenseService        |
|   - SettlementService, AuditService                         |
|   - Orchestrates persistence, validations & transactions    |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|               Core Domain Engine (Pure Functions)           |
|   - Money Utilities (Paise, integer math, parsing)          |
|   - Split Calculators (Equal, Exact, Percentage)            |
|   - Balance Calculation Engine & Invariant Verifiers        |
|   - Greedy Settlement Graph Resolver                        |
|   * ZERO dependencies on Express, Mongoose, or Network      |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|                   Data Persistence Layer                    |
|   - MongoDB with Mongoose ODM                               |
|   - Schemas: Event, Participant, Expense, SettlementRecord, |
|              AuditRecord                                    |
|   - Indexes & Compound Keys for Scoped Queries              |
+-------------------------------------------------------------+
```

---

## 2. Core Architectural Principles

### 2.1 Separation of Concerns
1. **Presentation Layer (React Frontend)**:
   - Captures user intent, presents data, renders live computation previews, and displays explainable financial summaries.
   - Converts display units (Rupees ₹) to/from internal integer units (paise) for human consumption, but relies on backend validation for authoritative calculations.
2. **API Layer (Express Controllers & Middleware)**:
   - Parses HTTP requests, validates format and types, verifies cross-resource ownership, handles route errors, and constructs standard JSON responses.
   - Controllers remain thin: no financial arithmetic or settlement logic lives inside controllers.
3. **Service Layer**:
   - Manages use-case workflows, coordinates MongoDB database operations, logs audit trails, and enforces state protection policies (such as preventing expense edits when settled).
4. **Domain Engine (`src/core/`)**:
   - Pure, deterministic, side-effect-free business logic.
   - Houses monetary utilities, split distribution algorithms, balance calculations, and the debt-settlement algorithm.
   - Can be run and verified in unit tests completely detached from database or network.
5. **Persistence Layer**:
   - Manages data schemas, default timestamps, compound indexes (e.g. `[eventId, createdAt]`), and atomic operations.

### 2.2 Financial Invariants as Code
- **Invariant 1**: Every expense allocation must sum to the expense amount in paise:
  $$\sum_{j} \text{sharePaise}_j \equiv \text{amountPaise}$$
- **Invariant 2**: The sum of all net participant balances in an event must equal zero:
  $$\sum_{i} \text{netBalancePaise}_i \equiv 0$$
- **Invariant 3**: Proposed settlement transactions must satisfy:
  $$\sum \text{ProposedTransfers} \equiv \frac{1}{2} \sum_{i} |\text{netBalancePaise}_i|$$
- **Invariant 4**: Applying all proposed transfers to participant balances must yield exactly zero for all participants:
  $$\forall i: \text{balance}_i + \sum \text{inflow}_i - \sum \text{outflow}_i \equiv 0$$

---

## 3. Component Directory Structure

```
c:\Users\HP\Desktop\odessa\
├── backend/
│   ├── src/
│   │   ├── config/             # DB & environment configuration
│   │   │   └── db.js
│   │   ├── core/               # PURE DOMAIN ENGINE (No dependencies)
│   │   │   ├── money.js        # Paise conversion, parsing, validation
│   │   │   ├── splits.js       # Equal, Exact, Percentage allocation
│   │   │   ├── balances.js     # Balance aggregator & explainability
│   │   │   └── settlement.js   # Deterministic greedy settlement
│   │   ├── models/             # Mongoose schemas
│   │   │   ├── Event.js
│   │   │   ├── Participant.js
│   │   │   ├── Expense.js
│   │   │   ├── SettlementRecord.js
│   │   │   └── AuditRecord.js
│   │   ├── services/           # Application use-case coordinators
│   │   │   ├── eventService.js
│   │   │   ├── participantService.js
│   │   │   ├── expenseService.js
│   │   │   ├── balanceService.js
│   │   │   ├── settlementService.js
│   │   │   └── auditService.js
│   │   ├── controllers/        # Thin HTTP controllers
│   │   │   ├── eventController.js
│   │   │   ├── participantController.js
│   │   │   ├── expenseController.js
│   │   │   ├── balanceController.js
│   │   │   ├── settlementController.js
│   │   │   └── auditController.js
│   │   ├── routes/             # REST API routing
│   │   │   └── v1/
│   │   ├── middleware/         # Error handling, validation, rate limiting
│   │   │   ├── errorHandler.js
│   │   │   ├── validate.js
│   │   │   └── rateLimiter.js
│   │   ├── app.js              # Express app definition
│   │   └── server.js           # Server bootstrap
│   ├── tests/
│   │   ├── unit/               # Core engine unit tests
│   │   └── integration/        # Supertest API tests
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/                # API client abstraction
│   │   ├── components/         # Reusable UI components
│   │   ├── context/            # Event context / state
│   │   ├── pages/              # Routed pages (Events, Balances, Expenses, etc.)
│   │   ├── utils/              # Client-side currency formatters & preview helpers
│   │   ├── index.css           # Modern design system
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── docs/                       # Technical & Architectural Documentation
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── BUSINESS_RULES.md
│   ├── DATABASE_DESIGN.md
│   ├── API_DOCUMENTATION.md
│   └── TESTING.md
└── README.md
```

---

## 4. Key Design Decisions

| Decision | Choice | Rationale | Alternatives Considered |
|---|---|---|---|
| Monetary Representation | Integer Paise (`amountPaise`) | Avoids binary floating-point rounding errors (`0.1 + 0.2 = 0.30000000000000004`). Inherent in INR. | Float (rejected: rounding drift), Decimal128 (rejected: overhead, JS native BigInt/Number integer suffices within `Number.MAX_SAFE_INTEGER` = ₹90 trillion). |
| Remainder Allocation | Deterministic largest-remainder / stable ID ordering | Ensures reproducible, equitable 1-paise resolution with zero sum leakage. | Random allocation (rejected: non-deterministic), Rotating queue (rejected: unnecessary state tracking). |
| Settlement Algorithm | Deterministic Greedy Matching | O(N log N) time complexity; simple, robust, verifiable; guaranteed to settle all debts in $\le N-1$ transactions. | Subset-sum min-transaction DP (rejected: NP-hard, exponential worst-case, overkill for campus events). |
| Historical Safety Policy | Strict settlement lock on expenses | Prevents corrupting recorded payments; forces audited reversals if corrections are needed. | Silent retroactive recalculation (rejected: creates phantom balances and discredits settled transactions). |
| Database Integrity | Scoped compound queries and event-level verification | Prevents cross-event participant or expense injection. | Unscoped global queries (rejected: security & data isolation risk). |
