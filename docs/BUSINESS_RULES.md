# CampusSplit — Business Rules & Financial Policy

This document defines the authoritative business rules, mathematical policies, and edge-case behaviors implemented throughout CampusSplit.

---

## 1. Monetary System & Units

### 1.1 The Integer Paise Standard
1. **Canonical Currency Unit**: All internal monetary values, balances, shares, and calculations are expressed as **integer paise** ($1\text{ INR} = 100\text{ paise}$).
2. **Boundary Validation**:
   - Financial inputs from clients (e.g., `"100.50"`, `100.50`) are parsed and validated strictly at the API controller boundary.
   - Any input with more than two decimal digits (e.g. `10.555`) is rejected with HTTP `400 Bad Request`. Silent rounding of user inputs is strictly prohibited.
3. **Safe Numeric Range**:
   - Maximum single expense: ₹10,000,000.00 ($1,000,000,000\text{ paise}$).
   - JavaScript's `Number.MAX_SAFE_INTEGER` ($9,007,199,254,740,991$) supports up to ₹90,071,992,547,409.91 (₹90 trillion), easily accommodating thousands of large campus events without integer overflow.
4. **Display Presentation**:
   - Paise values are converted to rupees formatted to exactly two decimal places (e.g., `3333` paise $\to$ `₹33.33`) only at the presentation boundary.

---

## 2. Expense Split Policies & The One-Paise Problem

Every expense must satisfy the **Zero-Leakage Invariant**:
$$\sum_{j=1}^{M} \text{sharePaise}_j \equiv \text{amountPaise}$$

### 2.1 Equal Split Method
When an amount $A$ is split equally among $M$ beneficiaries:
1. **Base Quotient**:
   $$Q = \lfloor A / M \rfloor$$
2. **Remainder**:
   $$R = A \pmod M \quad (0 \le R < M)$$
3. **Deterministic Allocation**:
   - Sort the $M$ beneficiary participant IDs in lexicographical ascending order: $[p_1, p_2, \dots, p_M]$.
   - The first $R$ beneficiaries receive $Q + 1$ paise.
   - The remaining $M - R$ beneficiaries receive $Q$ paise.
4. **Example (The ₹100.00 / 3 People Case)**:
   - $A = 10,000\text{ paise}$, $M = 3$.
   - $Q = \lfloor 10,000 / 3 \rfloor = 3,333\text{ paise}$.
   - $R = 10,000 \pmod 3 = 1\text{ paise}$.
   - Beneficiary 1: $3,333 + 1 = 3,334\text{ paise}$ (₹33.34).
   - Beneficiary 2: $3,333\text{ paise}$ (₹33.33).
   - Beneficiary 3: $3,333\text{ paise}$ (₹33.33).
   - Sum: $3,334 + 3,333 + 3,333 = 10,000\text{ paise}$ (₹100.00 exact).

### 2.2 Percentage Split Method (Largest-Remainder / Hare-Niemeyer)
To prevent floating-point inaccuracies, percentage inputs are normalized to **basis points** ($100\% = 10,000\text{ bps}$; $1\% = 100\text{ bps}$; $0.01\% = 1\text{ bps}$).
1. **Validation**:
   - The sum of all beneficiary basis points must equal exactly $10,000\text{ bps}$ ($100\%$).
2. **Allocation Steps**:
   - For each beneficiary $j$ with percentage $B_j$ (in bps):
     $$\text{exactShare}_j = \frac{A \times B_j}{10,000}$$
     $$\text{floorShare}_j = \lfloor \text{exactShare}_j \rfloor$$
     $$\text{remainder}_j = \text{exactShare}_j - \text{floorShare}_j$$
   - Compute initial allocated sum: $S = \sum \text{floorShare}_j$.
   - Remaining paise to distribute: $R = A - S$.
   - Sort beneficiaries by:
     1. Decreasing order of $\text{remainder}_j$ (largest remainder gets priority).
     2. Ascending order of participant ID as deterministic tie-breaker.
   - Award $+1\text{ paise}$ to the top $R$ beneficiaries.
3. **Property**:
   - Guaranteed $\sum \text{sharePaise}_j \equiv A$ with minimal individual rounding error.

### 2.3 Exact Split Method
1. The client supplies the explicit `sharePaise` for each beneficiary.
2. The server asserts:
   - Each `sharePaise` is an integer $\ge 1$.
   - $\sum_{j} \text{sharePaise}_j = \text{amountPaise}$.
3. If the sum differs from the total amount by even 1 paise, the transaction is rejected with an error stating the exact discrepancy.

---

## 3. Participant & Payer Rules

1. **Payer Independence**:
   - The payer of an expense must be a valid participant in the event.
   - The payer **is not required** to be a beneficiary (e.g., student leader pays ₹1,500 for 3 teammates' workshop kits).
2. **Beneficiary Constraints**:
   - An expense must contain at least one beneficiary.
   - All beneficiaries must belong to the same event.
   - Duplicate beneficiaries within the same expense are strictly forbidden.
3. **Safe Participant Removal / Deactivation**:
   - A participant cannot be deleted if they appear as a payer or beneficiary in any expense, or as a debtor or creditor in any recorded settlement.
   - They may be marked as `INACTIVE`, preventing new expenses from including them while preserving all historical financial records.

---

## 4. Balance Calculation Engine

1. **Net Balance Formula**:
   $$\text{totalPaidPaise}_i = \sum_{e \in \text{Expenses}, e.\text{payerId} = i} e.\text{amountPaise}$$
   $$\text{totalSharePaise}_i = \sum_{e \in \text{Expenses}} \text{shareOf}(e, i)$$
   $$\text{netBalancePaise}_i = \text{totalPaidPaise}_i - \text{totalSharePaise}_i$$
2. **Global Conservation of Money**:
   $$\sum_{i=1}^N \text{totalPaidPaise}_i \equiv \sum_{e} e.\text{amountPaise} \equiv \sum_{i=1}^N \text{totalSharePaise}_i$$
   $$\implies \sum_{i=1}^N \text{netBalancePaise}_i \equiv 0$$
3. **Invariant Check**:
   - Prior to computing settlement plans, the engine verifies $\sum \text{netBalancePaise}_i = 0$.
   - If this check fails, the system logs a high-severity error and aborts settlement generation without producing corrupt instructions.

---

## 5. Debt Settlement Algorithm

### 5.1 Algorithm Specification (Deterministic Greedy Matching)
1. **Filter & Classify**:
   - Creditors: $C = \{ (p, \text{balance}_p) \mid \text{balance}_p > 0 \}$
   - Debtors: $D = \{ (p, |\text{balance}_p|) \mid \text{balance}_p < 0 \}$
2. **Deterministic Sort**:
   - Sort $C$ descending by balance; break ties by ascending `participantId`.
   - Sort $D$ descending by debt; break ties by ascending `participantId`.
3. **Iterative Matching**:
   - While $C$ and $D$ are non-empty:
     - Let top debtor be $(d, \text{debt}_d)$ and top creditor be $(c, \text{credit}_c)$.
     - Transfer amount $T = \min(\text{debt}_d, \text{credit}_c)$.
     - Generate proposed transfer: $\{ \text{from}: d, \text{to}: c, \text{amountPaise}: T \}$.
     - $\text{debt}_d \leftarrow \text{debt}_d - T$.
     - $\text{credit}_c \leftarrow \text{credit}_c - T$.
     - If $\text{debt}_d = 0$, pop from $D$.
     - If $\text{credit}_c = 0$, pop from $C$.
4. **Time & Space Complexity**:
   - Sorting $N$ participants: $O(N \log N)$.
   - Greedy matching loop: $O(N)$ iterations (each step exhausts at least one debtor or creditor).
   - Total Time Complexity: $O(N \log N)$.
   - Space Complexity: $O(N)$ for participant queues.
5. **Guarantee & Limitations**:
   - The greedy algorithm is deterministic, terminates in finite time, and requires at most $N - 1$ transactions.
   - *Honest Note on Optimality*: While greedy matching produces a valid and minimal set of payments for almost all realistic group expenses, finding the absolute minimum transaction count across all arbitrary subsets is equivalent to the NP-hard Subset Sum problem. We implement and test the deterministic greedy approach because it is efficient, reliable, and guaranteed to clear all balances.

---

## 6. Settlement Ledger & State Lifecycle

### 6.1 Three Financial States
1. **Original Expense Obligations**: Raw net balances computed from recorded expenses.
2. **Proposed Settlements**: Algorithmic recommendations for who should pay whom.
3. **Recorded Settlements**: Concrete transactions marked as completed by participants.

### 6.2 Residual Balance Computation
When a settlement payment of $X$ paise from $d$ to $c$ is recorded:
- Effective balance of $d$ increases by $+X$ (debt decreases toward 0).
- Effective balance of $c$ decreases by $-X$ (credit decreases toward 0).
- The total un-settled balance decreases by $2X$.

### 6.3 Expense Modification Protection Policy
- **Rule**: If any completed settlement record exists for an event, **no existing expenses may be edited or deleted**, and no new expenses can alter historical settled lines, without first **reversing** the active settlements.
- **Rationale**: Silently editing an expense after participants have already exchanged real-world payments causes phantom balances and breaks reconciliation audits.
- **Workflow to Modify**:
  1. User attempts edit $\to$ API returns `409 Conflict` with clear explanation.
  2. User explicitly reviews settlement ledger and reverses conflicting settlement records with a reason.
  3. Expense is updated.
  4. Recalculated settlement instructions reflect the updated financial state.
