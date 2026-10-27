import React, { useState, useEffect, useCallback } from 'react';
import { useEvent } from '../context/EventContext.jsx';
import { api } from '../api/client.js';
import { ExpenseModal } from './ExpenseModal.jsx';

export function ExpenseManager() {
  const { currentEvent, refreshEventData, showToast } = useEvent();
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);

  const loadExpenses = useCallback(async (page = 1, cat = categoryFilter) => {
    if (!currentEvent?._id) return;
    try {
      setLoading(true);
      const res = await api.getExpenses(currentEvent._id, {
        page,
        limit: 15,
        ...(cat ? { category: cat } : {})
      });
      setExpenses(res.expenses || []);
      setPagination(res.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentEvent?._id, categoryFilter, showToast]);

  useEffect(() => {
    loadExpenses(1, categoryFilter);
  }, [loadExpenses, categoryFilter]);

  if (!currentEvent) {
    return (
      <div className="card empty-state">
        <h3 className="empty-state-title">No Event Selected</h3>
        <p>Please select an event to view expenses.</p>
      </div>
    );
  }

  const handleOpenAdd = () => {
    setExpenseToEdit(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (exp) => {
    setExpenseToEdit(exp);
    setModalOpen(true);
  };

  const handleDelete = async (exp) => {
    const confirm = window.confirm(
      `Are you sure you want to delete "${exp.description}" (${exp.amountRupees})? This will recalculate all balances.`
    );
    if (!confirm) return;

    try {
      await api.deleteExpense(currentEvent._id, exp._id);
      showToast('Expense removed successfully.', 'success');
      await Promise.all([loadExpenses(pagination.page), refreshEventData()]);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleSaved = async () => {
    await Promise.all([loadExpenses(1), refreshEventData()]);
  };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Expense History</h2>
            <p className="card-subtitle">
              Authoritative transaction log. Every expense sum is strictly validated.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              className="form-control"
              style={{ width: '160px', padding: '0.45rem 0.65rem' }}
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="FOOD">Food & Dining</option>
              <option value="TRAVEL">Travel</option>
              <option value="STAY">Accommodation</option>
              <option value="SUPPLIES">Supplies</option>
              <option value="TICKETS">Tickets</option>
              <option value="GENERAL">General</option>
              <option value="OTHER">Other</option>
            </select>

            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
              + Add Expense
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading expenses...
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <h3 className="empty-state-title">No Expenses Found</h3>
            <p>No expenses have been recorded for this event yet.</p>
            <button className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }} onClick={handleOpenAdd}>
              + Record First Expense
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Paid By</th>
                  <th>Split Method</th>
                  <th>Beneficiaries</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e._id}>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{e.description}</strong>
                      {e.notes && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Note: {e.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-tag">{e.category}</span>
                    </td>
                    <td>{e.payerId?.name || 'Unknown'}</td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {e.splitMethod}
                      </span>
                    </td>
                    <td>
                      <span title={e.beneficiaries?.map(b => `${b.participantId?.name}: ${b.shareRupees}`).join(', ')}>
                        {e.beneficiaries?.length || 0} person{e.beneficiaries?.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono-amount">
                      <strong>{e.amountRupees}</strong>
                    </td>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {new Date(e.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenEdit(e)}
                          title="Edit expense"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(e)}
                          title="Delete expense"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} expenses)
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={pagination.page <= 1}
                    onClick={() => loadExpenses(pagination.page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => loadExpenses(pagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && (
        <ExpenseModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          expenseToEdit={expenseToEdit}
        />
      )}
    </div>
  );
}
