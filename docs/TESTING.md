# CampusSplit — Comprehensive Testing Strategy

## 1. Testing Philosophy
Testing is a first-class deliverable. Financial correctness requires verification at every layer:
1. **Domain Engine Isolation**: The core financial algorithms must be tested with 100% coverage across edge cases, independent of database and HTTP transport.
2. **Invariant-First Assertions**: Tests do not merely match static strings; they assert mathematical invariants ($\sum \text{shares} \equiv \text{amount}$, $\sum \text{netBalances} \equiv 0$, residual balances $\to 0$).
3. **Integration Scenarios**: End-to-end API workflows asserting cross-event isolation, safe participant deactivation, and settlement protection locks.

---

## 2. Test Suite Architecture

```
tests/
├── unit/
│   ├── money.test.js          # Currency conversion, decimal rejection, formatting
│   ├── splits.test.js         # Equal, Exact, Percentage split algorithms & 1-paise resolution
│   ├── balances.test.js       # Balance aggregation, explainability, conservation of money
│   └── settlement.test.js     # Greedy matching algorithm, bounds, post-condition proofs
└── integration/
    ├── api.test.js            # Express API integration, route validation, error handling
    └── settlementWorkflow.test.js # Multi-step workflow: expense -> settlement -> lock -> reverse
```

---

## 3. Test Cases Matrix

### 3.1 Monetary Engine (`money.test.js`)
- [x] Converts ₹100.00 to 10,000 paise.
- [x] Converts ₹0.01 to 1 paise.
- [x] Rejects 3 decimal places (e.g., `100.555`) with descriptive validation error.
- [x] Rejects negative amounts (e.g., `-50.00`).
- [x] Rejects NaN or non-numeric strings (e.g., `"abc"`).
- [x] Converts 3,333 paise to formatted string `"₹33.33"`.
- [x] Converts -500 paise to `"-₹5.00"` and +500 to `"+₹5.00"`.

### 3.2 Split Methods & One-Paise Distribution (`splits.test.js`)
- [x] **Equal Split - Exact**: ₹90.00 among 3 participants = 3,000 paise each.
- [x] **Equal Split - 1-Paise Remainder**: ₹100.00 (10,000 paise) among 3 participants = 3,334 paise, 3,333 paise, 3,333 paise.
- [x] **Equal Split - 2-Paise Remainder**: ₹100.01 (10,001 paise) among 3 participants = 3,334 paise, 3,334 paise, 3,333 paise.
- [x] **Equal Split - Determinism**: Invariant held across repeated executions with identical participant IDs.
- [x] **Percentage Split - Clean**: ₹100.00 split 50%-50% (5,000 bps each) = 5,000 paise each.
- [x] **Percentage Split - Largest-Remainder**: ₹100.00 split 33.33%, 33.33%, 33.34% (3,333 bps, 3,333 bps, 3,334 bps).
- [x] **Percentage Split - Tie-Breaking**: Equal fractional remainders broken deterministically by participant ID.
- [x] **Percentage Split - Validation**: Fails if total basis points $\ne 10,000$.
- [x] **Exact Split - Valid**: Shares summing to total amount accepted.
- [x] **Exact Split - Discrepancy**: Shares missing 1 paise rejected with explicit discrepancy report.
- [x] **Cross-Validation**: Empty beneficiary list rejected; duplicate beneficiary IDs rejected.

### 3.3 Balance Aggregation (`balances.test.js`)
- [x] Payer who pays more than their share has positive net balance.
- [x] Participant whose payment equals their share has zero net balance.
- [x] Participant who pays nothing but incurs shares has negative net balance.
- [x] Complex multi-expense scenario with cross-payments correctly calculates net balances.
- [x] Single participant event handles gracefully.
- [x] Zero expenses produces zero balances for all participants.
- [x] **Zero-Sum Invariant Check**: Assert $\sum_{i} \text{netBalance}_i \equiv 0$ on all scenarios.

### 3.4 Settlement Algorithm (`settlement.test.js`)
- [x] **Case Study Example**:
  - Asha: +₹600.00 (+60,000 paise)
  - Bala: +₹150.00 (+15,000 paise)
  - Charan: -₹750.00 (-75,000 paise)
  - Result: Charan pays Asha ₹600.00, Charan pays Bala ₹150.00.
- [x] 1 Debtor and multiple Creditors.
- [x] Multiple Debtors and 1 Creditor.
- [x] Multiple Debtors and multiple Creditors.
- [x] Already balanced event returns 0 proposed transfers.
- [x] Invariant Assertion 1: No debtor overpays.
- [x] Invariant Assertion 2: No creditor over-receives.
- [x] Invariant Assertion 3: Total proposed transfers match total net debt.
- [x] Invariant Assertion 4: Applying all proposed transfers leaves every participant balance at 0.

### 3.5 API & Workflow Tests (`integration/`)
- [x] Create event, add participants, verify scoped retrieval.
- [x] Duplicate participant name in same event is rejected (`409 Conflict`).
- [x] Cross-event participant in expense is rejected (`400 Bad Request`).
- [x] Recording a settlement decreases residual debt and credit towards zero.
- [x] Modifying an expense when completed settlements exist is blocked (`409 Conflict`).
- [x] Explicitly reversing a settlement re-opens the expense for editing.
- [x] CSV export returns compliant comma-separated representation.
