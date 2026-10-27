/**
 * CampusSplit REST API Client
 */

const API_BASE = '/api/v1';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);

  // Handle CSV or file downloads
  if (response.headers.get('content-type')?.includes('text/csv')) {
    if (!response.ok) {
      throw new Error('Failed to download CSV export.');
    }
    return response.text();
  }

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Request failed with status ${response.status}`;
    const error = new Error(errorMsg);
    error.code = data?.error?.code || 'API_ERROR';
    error.status = response.status;
    error.details = data?.error?.details || null;
    throw error;
  }

  return data?.data !== undefined ? data.data : data;
}

export const api = {
  // Events
  getEvents: () => request('/events'),
  getEvent: (id) => request(`/events/${id}`),
  createEvent: (data) => request('/events', { method: 'POST', body: data }),
  seedDemoEvent: () => request('/events/seed-demo', { method: 'POST' }),

  // Participants
  getParticipants: (eventId, includeInactive = false) =>
    request(`/events/${eventId}/participants?includeInactive=${includeInactive}`),
  addParticipant: (eventId, data) =>
    request(`/events/${eventId}/participants`, { method: 'POST', body: data }),
  deactivateParticipant: (eventId, participantId) =>
    request(`/events/${eventId}/participants/${participantId}/deactivate`, { method: 'PATCH' }),

  // Expenses
  getExpenses: (eventId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/events/${eventId}/expenses${query ? `?${query}` : ''}`);
  },
  getExpense: (eventId, expenseId) =>
    request(`/events/${eventId}/expenses/${expenseId}`),
  previewExpense: (eventId, data) =>
    request(`/events/${eventId}/expenses/preview`, { method: 'POST', body: data }),
  createExpense: (eventId, data) =>
    request(`/events/${eventId}/expenses`, { method: 'POST', body: data }),
  updateExpense: (eventId, expenseId, data) =>
    request(`/events/${eventId}/expenses/${expenseId}`, { method: 'PUT', body: data }),
  deleteExpense: (eventId, expenseId) =>
    request(`/events/${eventId}/expenses/${expenseId}`, { method: 'DELETE' }),

  // Balances
  getBalances: (eventId) => request(`/events/${eventId}/balances`),
  explainBalance: (eventId, participantId) =>
    request(`/events/${eventId}/balances/${participantId}/explain`),

  // Settlements
  getProposedSettlements: (eventId) =>
    request(`/events/${eventId}/settlements/proposed`),
  recordSettlement: (eventId, data) =>
    request(`/events/${eventId}/settlements/record`, { method: 'POST', body: data }),
  getSettlementHistory: (eventId) =>
    request(`/events/${eventId}/settlements/history`),
  reverseSettlement: (eventId, settlementId, reason) =>
    request(`/events/${eventId}/settlements/${settlementId}/reverse`, {
      method: 'POST',
      body: { reason }
    }),

  // Reports & Audit
  getAuditHistory: (eventId) => request(`/events/${eventId}/audit`),
  getReconciliation: (eventId) => request(`/events/${eventId}/report/reconciliation`),
  downloadCSV: (eventId) => request(`/events/${eventId}/report/export/csv`)
};
