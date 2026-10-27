# CampusSplit — Database Design & Data Integrity

## 1. Storage Technology: MongoDB with Mongoose
MongoDB is used as the operational document store with strict Mongoose schema enforcement, field validations, and compound indexes to guarantee data integrity and efficient event-scoped queries.

---

## 2. Entity Schemas

### 2.1 Event (`Event.js`)
Represents an isolated group activity, trip, or conference.
```javascript
{
  _id: ObjectId,
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500 },
  currency: { type: String, default: 'INR', uppercase: true, enum: ['INR'] },
  status: { type: String, default: 'ACTIVE', enum: ['ACTIVE', 'ARCHIVED'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```
**Indexes**:
- `{ createdAt: -1 }` (for listing latest events)

---

### 2.2 Participant (`Participant.js`)
Represents an individual belonging to an event.
```javascript
{
  _id: ObjectId,
  eventId: { type: ObjectId, ref: 'Event', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, trim: true, lowercase: true, maxlength: 120 },
  status: { type: String, default: 'ACTIVE', enum: ['ACTIVE', 'INACTIVE'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```
**Constraints & Indexes**:
- Compound Unique Index: `{ eventId: 1, name: 1 }` (prevents duplicate participant names in the same event)
- Partial Unique Index on email when provided: `{ eventId: 1, email: 1 }`

---

### 2.3 Expense (`Expense.js`)
Authoritative record of a shared financial expenditure.
```javascript
// Beneficiary Share Sub-Schema
const BeneficiaryShareSchema = {
  participantId: { type: ObjectId, ref: 'Participant', required: true },
  sharePaise: { type: Number, required: true, min: 1 },
  // Optional metadata preserving user input for recalculation/display:
  percentageBps: { type: Number, min: 1, max: 10000 },
  exactInputPaise: { type: Number, min: 1 }
};

// Main Expense Schema
{
  _id: ObjectId,
  eventId: { type: ObjectId, ref: 'Event', required: true, index: true },
  description: { type: String, required: true, trim: true, maxlength: 200 },
  amountPaise: { type: Number, required: true, min: 1, max: 1000000000 },
  payerId: { type: ObjectId, ref: 'Participant', required: true },
  splitMethod: { 
    type: String, 
    required: true, 
    enum: ['EQUAL', 'EXACT', 'PERCENTAGE'] 
  },
  category: { 
    type: String, 
    default: 'GENERAL',
    enum: ['GENERAL', 'FOOD', 'TRAVEL', 'STAY', 'SUPPLIES', 'TICKETS', 'OTHER'] 
  },
  beneficiaries: [BeneficiaryShareSchema],
  notes: { type: String, trim: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```
**Constraints & Indexes**:
- Compound Index: `{ eventId: 1, createdAt: -1 }` (for fast chronological expense history)
- `{ eventId: 1, payerId: 1 }` (for payer-scoped aggregations)

---

### 2.4 Settlement Record (`SettlementRecord.js`)
Tracks actual, confirmed debt-clearing payments between participants.
```javascript
{
  _id: ObjectId,
  eventId: { type: ObjectId, ref: 'Event', required: true, index: true },
  payerId: { type: ObjectId, ref: 'Participant', required: true },     // Debtor
  payeeId: { type: ObjectId, ref: 'Participant', required: true },     // Creditor
  amountPaise: { type: Number, required: true, min: 1 },
  notes: { type: String, trim: true, maxlength: 300 },
  status: { type: String, default: 'COMPLETED', enum: ['COMPLETED', 'REVERSED'] },
  reversalReason: { type: String, trim: true, maxlength: 300 },
  reversedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
}
```
**Indexes**:
- Compound Index: `{ eventId: 1, status: 1 }`
- Compound Index: `{ eventId: 1, createdAt: -1 }`

---

### 2.5 Audit Record (`AuditRecord.js`)
Immutable append-only ledger of state-changing operations.
```javascript
{
  _id: ObjectId,
  eventId: { type: ObjectId, ref: 'Event', required: true, index: true },
  action: { 
    type: String, 
    required: true, 
    enum: [
      'EVENT_CREATED', 
      'PARTICIPANT_ADDED', 
      'PARTICIPANT_DEACTIVATED',
      'EXPENSE_CREATED', 
      'EXPENSE_UPDATED', 
      'EXPENSE_DELETED',
      'SETTLEMENT_RECORDED', 
      'SETTLEMENT_REVERSED'
    ] 
  },
  entityType: { type: String, required: true }, // 'Expense', 'Settlement', etc.
  entityId: { type: ObjectId },
  details: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
}
```
**Indexes**:
- `{ eventId: 1, timestamp: -1 }`

---

## 3. Data Integrity & Consistency Strategy

### 3.1 Single Source of Financial Truth
- **No Cached / Editable Balances**: Net balances are **never** stored as static, mutable fields on `Participant` or `Event`. Balances are calculated dynamically by aggregating authoritative `Expense` records and adjusting for `SettlementRecord` entries. This eliminates data desynchronization and race condition anomalies.
- **Cross-Event Reference Prevention**: Before saving any expense or settlement, the service layer validates that the `payerId`, `payeeId`, and all `beneficiary.participantId` records explicitly belong to the targeted `eventId`.

### 3.2 Transaction & Atomicity Strategy
- In MongoDB environments with replica sets enabled, multi-document ACID transactions (`session.withTransaction`) are used for atomic composite operations (e.g. creating an expense and writing its audit record).
- In standalone local development environments without replica set initialization, operations are executed with sequential defensive validation and error handling, ensuring fail-safe rollbacks if an intermediate step fails.
