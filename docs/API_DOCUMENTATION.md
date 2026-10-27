# CampusSplit — REST API Specification

**Base URL**: `/api/v1`  
**Data Format**: JSON (`Content-Type: application/json`)

---

## 1. Standard Response Envelope

### 1.1 Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "data": { ... }
}
```

### 1.2 Error Response (`400`, `404`, `409`, `422`, `500`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Beneficiary shares must sum to exactly the expense amount.",
    "details": {
      "expectedPaise": 10000,
      "actualPaise": 9999,
      "discrepancyPaise": 1
    }
  }
}
```

---

## 2. Endpoints Overview

### 2.1 Event Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/events` | Create a new event |
| `GET` | `/api/v1/events` | List all events |
| `GET` | `/api/v1/events/:eventId` | Get event metadata & participant summary |
| `POST` | `/api/v1/events/seed-demo` | Seed demonstration event (from case study) |

#### `POST /api/v1/events`
**Request Body**:
```json
{
  "name": "Manali Hackathon Trip",
  "description": "Annual student hackathon expenses",
  "currency": "INR"
}
```
**Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "_id": "6750abc123...",
    "name": "Manali Hackathon Trip",
    "description": "Annual student hackathon expenses",
    "currency": "INR",
    "status": "ACTIVE",
    "createdAt": "2026-10-15T04:00:00.000Z"
  }
}
```

---

### 2.2 Participant Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/events/:eventId/participants` | Add participant to event |
| `GET` | `/api/v1/events/:eventId/participants` | List participants for event |
| `PATCH` | `/api/v1/events/:eventId/participants/:participantId/deactivate` | Safely deactivate participant |

#### `POST /api/v1/events/:eventId/participants`
**Request Body**:
```json
{
  "name": "Asha Sharma",
  "email": "asha@campus.edu"
}
```
**Response** (`201 Created`):
```json
{
  "success": true,
  "data": {
    "_id": "6750part01...",
    "eventId": "6750abc123...",
    "name": "Asha Sharma",
    "email": "asha@campus.edu",
    "status": "ACTIVE"
  }
}
```

---

### 2.3 Expense Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/events/:eventId/expenses/preview` | Preview allocation without persisting |
| `POST` | `/api/v1/events/:eventId/expenses` | Record a new expense |
| `GET` | `/api/v1/events/:eventId/expenses` | List expenses (with pagination & category filter) |
| `GET` | `/api/v1/events/:eventId/expenses/:expenseId` | Get single expense details |
| `PUT` | `/api/v1/events/:eventId/expenses/:expenseId` | Update an existing expense |
| `DELETE` | `/api/v1/events/:eventId/expenses/:expenseId` | Delete an expense |

#### `POST /api/v1/events/:eventId/expenses/preview` & `POST /api/v1/events/:eventId/expenses`
**Request Body (Equal Split Example)**:
```json
{
  "description": "Team Dinner",
  "amountRupees": 100.00,
  "payerId": "6750part01...",
  "splitMethod": "EQUAL",
  "category": "FOOD",
  "beneficiaryIds": ["6750part01...", "6750part02...", "6750part03..."],
  "notes": "Shared among Asha, Bala, and Charan"
}
```
**Response**:
```json
{
  "success": true,
  "data": {
    "description": "Team Dinner",
    "amountPaise": 10000,
    "amountRupeesFormatted": "₹100.00",
    "payerId": "6750part01...",
    "splitMethod": "EQUAL",
    "category": "FOOD",
    "beneficiaries": [
      { "participantId": "6750part01...", "sharePaise": 3334, "shareRupeesFormatted": "₹33.34" },
      { "participantId": "6750part02...", "sharePaise": 3333, "shareRupeesFormatted": "₹33.33" },
      { "participantId": "6750part03...", "sharePaise": 3333, "shareRupeesFormatted": "₹33.33" }
    ],
    "verification": {
      "sumOfSharesPaise": 10000,
      "exactMatch": true
    }
  }
}
```

---

### 2.4 Balances & Settlement Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/events/:eventId/balances` | Full balance sheet & verification |
| `GET` | `/api/v1/events/:eventId/balances/:participantId/explain` | Step-by-step explainability breakdown |
| `GET` | `/api/v1/events/:eventId/settlements/proposed` | Proposed payments from greedy algorithm |
| `POST` | `/api/v1/events/:eventId/settlements/record` | Record completed payment |
| `GET` | `/api/v1/events/:eventId/settlements/history` | List settlement ledger entries |
| `POST` | `/api/v1/events/:eventId/settlements/:settlementId/reverse` | Reverse a settlement transaction |

#### `GET /api/v1/events/:eventId/balances`
**Response**:
```json
{
  "success": true,
  "data": {
    "totalExpenseAmountPaise": 10000,
    "totalExpenseAmountRupees": "₹100.00",
    "balances": [
      {
        "participantId": "6750part01...",
        "participantName": "Asha",
        "totalPaidPaise": 10000,
        "totalPaidRupees": "₹100.00",
        "totalSharePaise": 3334,
        "totalShareRupees": "₹33.34",
        "netBalancePaise": 6666,
        "netBalanceRupees": "+₹66.66",
        "status": "CREDITOR",
        "recordedPaymentDeltaPaise": 0,
        "residualBalancePaise": 6666,
        "residualBalanceRupees": "+₹66.66"
      }
    ],
    "verification": {
      "sumOfNetBalancesPaise": 0,
      "isReconciled": true
    }
  }
}
```

#### `GET /api/v1/events/:eventId/settlements/proposed`
**Response**:
```json
{
  "success": true,
  "data": {
    "proposedTransfers": [
      {
        "fromId": "6750part03...",
        "fromName": "Charan",
        "toId": "6750part01...",
        "toName": "Asha",
        "amountPaise": 3333,
        "amountRupees": "₹33.33"
      }
    ],
    "algorithm": "Deterministic Greedy Matching",
    "timeComplexity": "O(N log N)",
    "verification": {
      "totalSettledPaise": 6666,
      "reconcilesFully": true
    }
  }
}
```

---

### 2.5 Reports & Audit Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/events/:eventId/audit` | Chronological audit trail |
| `GET` | `/api/v1/events/:eventId/export/csv` | Download CSV of expenses & settlements |
| `GET` | `/api/v1/events/:eventId/report/reconciliation` | Full event audit report |
