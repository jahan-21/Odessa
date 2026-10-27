# CampusSplit — Group Expense Management & Settlement System

[![Tests](https://img.shields.io/badge/tests-63%2F63%20passed%20(100%25)-success)](#automated-testing)
[![Architecture](https://img.shields.io/badge/architecture-modular%20monolith-blue)](#system-architecture)
[![Currency Precision](https://img.shields.io/badge/currency-integer%20paise%20(zero%20float)-brightgreen)](#the-integer-paise-standard)
[![Case Study Demo](https://img.shields.io/badge/case%20study-verified-purple)](#the-campus-hire-case-study-demonstration)

A mathematically sound, explainable group expense management and debt settlement application built for student groups, hackathons, and campus events. 

Engineered with primary focus on **financial correctness**, **deterministic allocation (resolving the one-paise problem)**, **transparent explainability**, and **tamper-proof settlement lifecycle protection**.

---

## Table of Contents
1. [Core Features & Problem Statement](#core-features--problem-statement)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Financial Correctness & The One-Paise Problem](#financial-correctness--the-one-paise-problem)
5. [Debt Settlement Algorithm](#debt-settlement-algorithm)
6. [Settlement Ledger & Expense Lock Policy](#settlement-ledger--expense-lock-policy)
7. [The Campus Hire Case Study Demonstration](#the-campus-hire-case-study-demonstration)
8. [Setup & Execution Instructions](#setup--execution-instructions)
9. [Automated Testing](#automated-testing)
10. [Documentation Index](#documentation-index)
11. [Known Limitations & Design Trade-offs](#known-limitations--design-trade-offs)

---

## Core Features & Problem Statement

When a group of students attends an event together, different individuals pay for various shared expenses (food, transport, supplies, accommodation). At the end of the event, participants must determine:
- Exactly how much each participant paid out-of-pocket.
- Exactly how much each participant owes as their fair share.
- Their individual net financial balance (`netBalance = totalPaid - totalShare`).
- An actionable, minimal settlement plan indicating who owes whom.
- A tamper-proof record of actual transfers completed in real life.

CampusSplit provides:
1. **Event & Participant Scoping**: Strict isolation across events; prevents cross-event references and identity collisions.
2. **Deterministic Split Allocations**: Equal, Exact, and Percentage splits with guaranteed zero sum leakage ($\sum \text{shares} \equiv \text{amount}$).
3. **Paise Precision**: Authoritative storage and calculation in integer paise ($1\text{ INR} = 100\text{ paise}$); zero floating-point drift.
4. **Explainable Balances**: For every participant, step-by-step narrative and itemized breakdown of contributing expenses.
5. **Greedy Matching Settlement Engine**: Generates deterministic payment instructions reducing all balances to zero in $\le N - 1$ transfers.
6. **Settlement Ledger & Historical Safety**: Completed transfers move residual balances towards zero; modifying expenses while settlements depend on them is strictly blocked unless explicitly reversed.
7. **Immutable Audit Trail & CSV Export**: Append-only audit history and exportable reconciliation records.

---

## Technology Stack

- **Frontend**: React 18, React Hooks, React Router-compatible modular view architecture, Vanilla CSS Design System with accessible tokens and dark theme. High-performance development server with on-the-fly Sucrase JSX transpilation.
- **Backend**: Node.js v22, Express.js (REST API v1).
- **Database**: MongoDB with Mongoose ODM (compound indexes, strict schema validations).
- **Testing**: Zero-dependency Node.js test runner running unit tests and integration tests with invariant assertions.
- **Data Exchange**: RESTful JSON envelopes (`{ success, data, error }`).

---

## System Architecture

CampusSplit is designed as a **Modular Monolith** adhering to Separation of Concerns:

```
[ React 18 SPA (Vanilla CSS Design System, Responsive Views) ]
                           |
                           | HTTP / JSON (REST API v1)
                           v
[ Express HTTP Layer: Controllers, Boundary Validation, Error Handling ]
                           |
                           v
[ Application Services: EventService, ParticipantService, ExpenseService,
                        SettlementService, BalanceService, ReportService ]
                           |
                           +----------------------------------------+
                           |                                        |
                           v                                        v
[ Core Domain Engine (Pure Functions) ]               [ Persistence: MongoDB ]
  - money.js (Paise parsing, validation)                - Event Schema
  - splits.js (Equal, Exact, Percentage)                - Participant Schema
  - balances.js (Net balance, explainability)           - Expense Schema
  - settlement.js (Greedy matching O(N log N))          - SettlementRecord
  * Zero dependencies on DB or HTTP                     - AuditRecord
```

For complete architectural specifications, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Financial Correctness & The One-Paise Problem

### The Integer Paise Standard
- Monetary values are represented internally and in the database as integer paise (`amountPaise`, `sharePaise`).
- Boundary parsing rejects any input with $>2$ decimal places (e.g. `₹10.555` is rejected with `400 Bad Request`).
- Display conversion ($3333\text{ paise} \to \text{₹33.33}$) happens only at the presentation boundary.

### Resolving Indivisible Remainders (The One-Paise Problem)
When ₹100.00 ($10,000\text{ paise}$) is divided equally among 3 beneficiaries:
- Quotient $Q = \lfloor 10,000 / 3 \rfloor = 3,333\text{ paise}$.
- Remainder $R = 10,000 \pmod 3 = 1\text{ paise}$.
- **Deterministic Allocation Policy**: Beneficiaries are sorted lexicographically by participant ID. The first $R$ beneficiaries receive $Q + 1$ paise; the remaining receive $Q$ paise.
- Result:
  - Participant A: ₹33.34 ($3,334\text{ paise}$)
  - Participant B: ₹33.33 ($3,333\text{ paise}$)
  - Participant C: ₹33.33 ($3,333\text{ paise}$)
  - **Total**: Exactly ₹100.00 ($10,000\text{ paise}$). Zero leakage.

### Percentage Split (Hare-Niemeyer / Largest-Remainder Method)
- Percentages are represented in integer **basis points** ($100\% = 10,000\text{ bps}$).
- Exact proportional shares are computed, integer floor is assigned, and remainder paise are distributed to beneficiaries with the largest fractional remainders (tie-broken by participant ID).

For full policy details, see [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md).

---

## Debt Settlement Algorithm

### Specification
The settlement engine uses a **Deterministic Greedy Matching Algorithm**:
1. Classify participants into Creditors ($\text{balance} > 0$) and Debtors ($\text{balance} < 0$).
2. Sort Creditors descending by credit; break ties by participant ID.
3. Sort Debtors descending by absolute debt; break ties by participant ID.
4. Greedily match largest debtor with largest creditor, transferring $T = \min(\text{debt}, \text{credit})$.
5. Deduct $T$ and advance pointers until all debts reach zero.

### Formal Invariants Asserted
1. No debtor pays more than their outstanding debt.
2. No creditor receives more than their outstanding credit.
3. Total proposed transfers equal total outstanding net debt.
4. Applying proposed transfers reduces all participant balances to exactly zero.

### Complexity & Optimality Note
- Time Complexity: $O(N \log N)$ (sorting) $+ O(N)$ (matching) $= O(N \log N)$.
- Guarantees complete settlement in at most $N - 1$ transactions.
- *Honest Note on Optimality*: Greedy matching generates a minimal, practical payment plan for group events. Absolute minimum transaction count across arbitrary multi-party groupings is isomorphic to the NP-hard Subset Sum problem; greedy delivers guaranteed correctness, reproducibility, and high efficiency.

---

## Settlement Ledger & Expense Lock Policy

CampusSplit strictly distinguishes three financial concepts:
1. **Original Obligations**: Dynamically aggregated from authoritative expense records.
2. **Proposed Payments**: Generated mathematically by the settlement algorithm.
3. **Recorded Payments**: Confirmed real-world transactions stored in the settlement ledger.

### Historical Safety & Expense Lock Policy
- If any `COMPLETED` settlement record exists for an event, **editing or deleting expenses is blocked** (`409 Conflict: SETTLEMENT_LOCK_CONFLICT`).
- **Rationale**: Silently altering expenses after participants have already exchanged real-world cash creates phantom balances and corrupts accounting history.
- **Audited Reversal Workflow**: To modify expenses, users must explicitly reverse the conflicting settlement records with a documented reason, restoring balances and re-opening expenses safely.

---

## The Campus Hire Case Study Demonstration

The case study scenario is built-in and can be seeded with 1 click:
- **Participants**: Asha, Bala, Charan
- **Expenses**:
  1. Team Dinner: ₹900.00 paid by Asha, split equally among Asha (₹300), Bala (₹300), Charan (₹300).
  2. Project Supplies & Cab: ₹600.00 paid by Bala, exact split for Bala (₹150) and Charan (₹450).
- **Calculated Net Balances**:
  - Asha: Paid ₹900.00, Share ₹300.00 $\implies$ **+₹600.00** (Creditor)
  - Bala: Paid ₹600.00, Share ₹450.00 $\implies$ **+₹150.00** (Creditor)
  - Charan: Paid ₹0.00, Share ₹750.00 $\implies$ **-₹750.00** (Debtor)
  - $\sum \text{Net Balances} \equiv 0$
- **Generated Settlements**:
  - **Charan pays Asha ₹600.00**
  - **Charan pays Bala ₹150.00**
  - Total transfers: 2 transactions clearing ₹750.00 debt completely.

---

## Setup & Execution Instructions

### Prerequisites
- Node.js (v18+ or v22+)
- MongoDB (Running locally on default port `mongodb://localhost:27017`)

### 1. Start Backend Server
```bash
cd backend
node src/server.js
```
The backend starts on `http://localhost:5000` (API at `http://localhost:5000/api/v1`).

### 2. Start Frontend Server
```bash
cd frontend
node dev-server.js
```
The frontend starts on `http://localhost:3000` with automated reverse-proxy to the backend.

### 3. Open in Browser
Visit **`http://localhost:3000`**. Click **"⚡ Load Case Study Demo"** in the header to immediately explore the live calculations, explainability breakdown, and settlement ledger.

---

## Automated Testing

CampusSplit includes 63 comprehensive automated tests covering all domain invariants, boundary validations, REST APIs, and workflow lifecycles:

### Running Backend Unit Tests (Financial Core)
```bash
cd backend
node tests/run-unit-tests.js
```
*41/41 unit tests pass: money parsing, 1-paise remainders, exact matching, largest-remainder percentage, balance zero-sum conservation, and greedy settlement invariants.*

### Running Backend Integration Tests (API & Database)
```bash
cd backend
node tests/integration/api.test.js
```
*17/17 integration tests pass: event scoping, duplicate participant rejection, live pre-save preview, case study reconciliation, settlement recording, settlement lock enforcement, reversal workflow, and CSV export.*

### Running Frontend Verification Tests
```bash
cd frontend
node tests/run-frontend-tests.js
```
*5/5 frontend logic tests pass.*

---

## Documentation Index

Comprehensive documentation is available in the `docs/` directory:
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md): Formal requirements specification and user stories.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): System architecture, layer boundaries, and design principles.
- [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md): Authoritative monetary rules, the one-paise problem resolution, and settlement lifecycle.
- [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md): MongoDB schemas, references, compound indexes, and consistency models.
- [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md): REST API endpoints, request/response payloads, and error codes.
- [docs/TESTING.md](docs/TESTING.md): Test suite architecture, coverage matrix, and invariant proofs.

---

## Known Limitations & Design Trade-offs

1. **Single Currency Focus**: The application is tailored for `INR` using integer paise. The codebase is decoupled so supporting additional currencies requires only defining their minor subunit (e.g., cents) without changing calculation algorithms.
2. **Greedy Matching vs NP-Hard Optimal Subset Sum**: The settlement engine uses greedy matching which guarantees $O(N \log N)$ performance and $\le N - 1$ transfers. It does not solve the NP-hard Subset Sum problem to find the theoretical minimum transaction count in edge cases where multiple subset loops exist.
3. **Recorded vs Bank-Verified Settlements**: Recorded payments reflect confirmed user agreements. No integration with real banking APIs (UPI/IMPS) is simulated or falsely claimed.
