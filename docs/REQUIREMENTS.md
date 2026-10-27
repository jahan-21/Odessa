# CampusSplit — Requirements Specification

## 1. Project Overview & Problem Statement
CampusSplit is a specialized group expense management and settlement application designed for students and event groups. When a group of participants incurs shared expenses during a trip, hackathon, festival, or group project, different individuals pay for various items on behalf of different sub-groups of beneficiaries.

At the conclusion of the event, participants must determine:
1. Exactly how much each participant paid out-of-pocket.
2. Exactly how much each participant legitimately incurred as their fair share.
3. The net balance for each person (`netBalance = totalPaid - totalShare`).
4. An actionable, deterministic settlement plan specifying who owes whom and the exact amount to transfer, minimizing confusion and eliminating disputes.
5. A verified ledger of payments actually recorded as completed, tracking residual balances until full settlement.

---

## 2. Core Functional Requirements

### 2.1 Event & Participant Management
- **Event Creation**: Create an event with a name, optional description, base currency (default `INR`), and creation metadata.
- **Participant Roster**: Add participants with name and optional email.
- **Identity & Uniqueness**: Duplicate participant names or emails within the same event must be prohibited.
- **Safe Participant Lifecycle**: Participants with financial transactions (as payer or beneficiary) cannot be deleted without an explicit safe deactivation workflow to preserve historical financial integrity.
- **Event Isolation**: All resources (participants, expenses, settlements, audit logs) belong strictly to a single event; cross-event data queries and references are strictly forbidden and validated at the boundary.

### 2.2 Expense Recording & Split Allocation
- **Monetary Precision**: All monetary values are processed and stored as integer paise (1 INR = 100 paise). Floating-point arithmetic for authoritative financial calculations is prohibited.
- **Expense Metadata**: An expense record contains:
  - `id`: Unique identifier
  - `eventId`: Scoped event reference
  - `description`: Plain text description (e.g., "Dinner at Bistro")
  - `amountPaise`: Positive integer amount in paise (> 0)
  - `payerId`: Valid participant belonging to the same event
  - `splitMethod`: One of `EQUAL`, `EXACT`, `PERCENTAGE`
  - `beneficiaries`: List of allocated shares (`participantId`, `sharePaise`, and optional input data like percentage basis points)
  - `category`: Category string (e.g., `FOOD`, `TRAVEL`, `ACCOMMODATION`, `SUPPLIES`, `OTHER`)
  - `notes`: Optional string
  - `createdAt`, `updatedAt`: Timestamps
- **Split Methods**:
  1. **Equal Split**: Expense amount is divided equally among all selected beneficiaries. Indivisible remainder paise are distributed deterministically (1 paise per participant ordered by stable participant ID).
  2. **Exact Split**: User specifies exact rupee/paise share for each beneficiary. Backend validates that $\sum \text{sharePaise} = \text{amountPaise}$ exactly.
  3. **Percentage Split**: User specifies percentages in basis points ($100\% = 10,000 \text{ bps}$ or $0.01\% = 1 \text{ bps}$). Allocation uses the Hare-Niemeyer / Largest-Remainder method, with participant ID as a deterministic tie-breaker.
- **Payer as Non-Beneficiary**: The payer may or may not be among the beneficiaries (e.g., organizer pays upfront for tickets for others).
- **CRUD Operations**: Support adding, viewing, editing, and deleting expenses with live pre-save allocation preview and confirmation dialogs.

### 2.3 Balance Calculation Engine
- **Formula**: For every participant $i$:
  $$\text{netBalancePaise}_i = \text{totalPaidPaise}_i - \text{totalSharePaise}_i$$
- **Interpretation**:
  - $\text{netBalancePaise}_i > 0$: Creditor (is owed money by the group).
  - $\text{netBalancePaise}_i < 0$: Debtor (owes money to the group).
  - $\text{netBalancePaise}_i = 0$: Settled (no outstanding obligation).
- **Core Financial Invariant**:
  $$\sum_{i=1}^{N} \text{netBalancePaise}_i \equiv 0$$
  This condition is strictly validated before generating any settlement plan.

### 2.4 Settlement Engine & Algorithm
- **Deterministic Settlement Generation**:
  - Categorizes participants into creditors ($\text{balance} > 0$), debtors ($\text{balance} < 0$), and zero-balance participants.
  - Generates recommended transactions $(D \to C, \text{amount})$ using a deterministic greedy algorithm matching the largest debtor to the largest creditor, breaking ties deterministically by ID.
- **Settlement Invariants**:
  1. No debtor is instructed to pay more than their outstanding debt.
  2. No creditor is instructed to receive more than their outstanding credit.
  3. Total proposed payments equal total net debt and total net credit.
  4. Executing all proposed transfers brings every participant's balance to exactly zero paise.
  5. Zero-value transactions are never generated.

### 2.5 Settlement Ledger & Lifecycle
- **Three-Tier State Separation**:
  1. *Original Obligations*: Computed dynamically from expenses.
  2. *Proposed Payments*: Generated mathematically to resolve current net balances.
  3. *Recorded Payments*: Explicitly confirmed transactions stored in the settlement ledger.
- **Residual Balance Computation**:
  - Recorded completed transfer of amount $X$ from debtor $D$ to creditor $C$:
    - Increases $D$'s net balance by $+X$ (debt reduced).
    - Decreases $C$'s net balance by $-X$ (credit reduced).
- **Settlement Protection Policy**:
  - Modifying or deleting an expense when completed settlements exist for that event is prohibited unless those settlements are explicitly reversed through an audited workflow, preventing historical balance drift.
- **Settlement Reversal**:
  - Completed settlements can be reversed with a recorded reason, reverting balances back to their pre-settlement state.

### 2.6 Balance Explainability & Auditability
- **Participant Balance Breakdown**:
  - Total paid across all expenses
  - Total share incurred
  - Net balance and status (To Receive / To Pay / Settled)
  - Detailed list of contributing expenses showing exact share breakdown
- **Reconciliation Status**: Live check proving $\sum \text{Paid} = \sum \text{Shares}$ and $\sum \text{Net Balances} = 0$.
- **Audit Log**: Immutable chronological record of all significant actions:
  - `EXPENSE_CREATED`, `EXPENSE_UPDATED`, `EXPENSE_DELETED`
  - `SETTLEMENT_RECORDED`, `SETTLEMENT_REVERSED`
  - `PARTICIPANT_ADDED`, `PARTICIPANT_DEACTIVATED`

---

## 3. Non-Functional Requirements
- **Financial Integrity**: Zero floating-point representation in storage or core logic.
- **Determinism**: Identical inputs must yield identical allocations and settlement instructions.
- **Fail-Safe Operations**: Reject malformed requests, invalid fractions, and cross-event references with descriptive JSON errors.
- **Modular Monolith**: Clean separation between UI, REST API, Domain Services, Calculation Core, and Database Persistence.
- **Testability**: Pure financial calculation core testable in isolation without network, database, or UI dependencies.
- **Usability**: Professional, legible UI with live previews, form validations, zero-state displays, and explicit confirmation for destructive actions.
