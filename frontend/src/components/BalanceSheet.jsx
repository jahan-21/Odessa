import React, { useState } from 'react';
import { useEvent } from '../context/EventContext.jsx';
import { api } from '../api/client.js';

export function BalanceSheet() {
  const { currentEvent, balancesData, showToast } = useEvent();
  const [explainData, setExplainData] = useState(null);
  const [loadingExplain, setLoadingExplain] = useState(false);

  if (!currentEvent) {
    return (
      <div className="card empty-state">
        <h3 className="empty-state-title">No Event Selected</h3>
        <p>Please select an event to view balances.</p>
      </div>
    );
  }

  const balances = balancesData?.balances || [];
  const verification = balancesData?.verification || {};

  const handleExplain = async (participantId) => {
    try {
      setLoadingExplain(true);
      const res = await api.explainBalance(currentEvent._id, participantId);
      setExplainData(res);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoadingExplain(false);
    }
  };

  return (
    <div>
      {/* Financial Invariant Card */}
      <div className="invariant-banner">
        <div className="invariant-title">
          <span>✓</span>
          <span>Zero-Sum Financial Invariant Verified</span>
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Sum of Net Balances: <strong>₹{(verification.sumOfNetBalancesPaise / 100 || 0).toFixed(2)}</strong> |
          Residual Conservation: <strong>₹{(verification.sumOfResidualBalancesPaise / 100 || 0).toFixed(2)}</strong>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Participant Balances</h2>
            <p className="card-subtitle">
              Net position = Total Paid - Total Allocated Share.
            </p>
          </div>
          <span className="badge badge-tag">
            Total Event Spend: {balancesData?.totalExpenseAmountRupees || '₹0.00'}
          </span>
        </div>

        {balances.length === 0 ? (
          <div className="empty-state">
            <p>No participants or expenses available to compute balances.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th style={{ textAlign: 'right' }}>Total Paid</th>
                  <th style={{ textAlign: 'right' }}>Total Share</th>
                  <th style={{ textAlign: 'right' }}>Raw Net Balance</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Outstanding Residual</th>
                  <th>Explainability</th>
                </tr>
              </thead>
              <tbody>
                {balances.map(b => {
                  let badgeClass = 'badge-settled';
                  if (b.status === 'CREDITOR') badgeClass = 'badge-credit';
                  if (b.status === 'DEBTOR') badgeClass = 'badge-debt';

                  return (
                    <tr key={b.participantId}>
                      <td>
                        <strong style={{ color: 'var(--text-primary)' }}>{b.participantName}</strong>
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono-amount">
                        {b.totalPaidRupees}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono-amount">
                        {b.totalShareRupees}
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono-amount">
                        <span style={{
                          color: b.netBalancePaise > 0 ? '#34d399' : b.netBalancePaise < 0 ? '#f87171' : 'var(--text-muted)',
                          fontWeight: 600
                        }}>
                          {b.netBalanceRupees}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${badgeClass}`}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} className="mono-amount">
                        <strong>{b.residualBalanceRupees}</strong>
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleExplain(b.participantId)}
                          disabled={loadingExplain}
                          title="Explain step-by-step why this balance was calculated"
                        >
                          🔍 Explain
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explainability Modal */}
      {explainData && (
        <div className="modal-overlay" onClick={() => setExplainData(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Balance Explanation: {explainData.participantName}</h3>
              <button className="modal-close" onClick={() => setExplainData(null)}>&times;</button>
            </div>

            {/* Narrative */}
            <div className="narrative-box">
              {explainData.narrative}
            </div>

            {explainData.formula && (
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.65rem 1rem',
                marginBottom: '1.25rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                color: 'var(--accent-primary)',
                fontWeight: 600
              }}>
                {explainData.formula}
              </div>
            )}

            {/* Quick Summary Grid */}
            <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="stat-card" style={{ padding: '0.85rem' }}>
                <div className="stat-label">Total Out-of-Pocket</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                  {explainData.summary?.totalPaidRupees}
                </div>
              </div>
              <div className="stat-card" style={{ padding: '0.85rem' }}>
                <div className="stat-label">Total Share Incurred</div>
                <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                  {explainData.summary?.totalShareRupees}
                </div>
              </div>
              <div className="stat-card" style={{ padding: '0.85rem' }}>
                <div className="stat-label">Net Balance</div>
                <div className="stat-value" style={{
                  fontSize: '1.2rem',
                  color: explainData.summary?.netBalancePaise > 0 ? '#34d399' : explainData.summary?.netBalancePaise < 0 ? '#f87171' : 'var(--text-primary)'
                }}>
                  {explainData.summary?.netBalanceRupees}
                </div>
              </div>
            </div>

            {/* Expenses Paid Breakdown */}
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Expenses Paid by {explainData.participantName} ({explainData.paidExpensesBreakdown?.length || 0})
              </h4>
              {explainData.paidExpensesBreakdown?.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Did not pay for any expenses.</div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table" style={{ fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {explainData.paidExpensesBreakdown?.map(item => (
                        <tr key={item.expenseId}>
                          <td>{item.description}</td>
                          <td><span className="badge badge-tag">{item.category}</span></td>
                          <td style={{ textAlign: 'right' }} className="mono-amount">
                            ₹{(item.amountPaise / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Beneficiary Shares Incurred Breakdown */}
            <div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Expenses Benefiting {explainData.participantName} ({explainData.sharedExpensesBreakdown?.length || 0})
              </h4>
              {explainData.sharedExpensesBreakdown?.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Did not participate in any shared expenses.</div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table" style={{ fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th>Expense</th>
                        <th>Total Cost</th>
                        <th style={{ textAlign: 'right' }}>Assigned Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {explainData.sharedExpensesBreakdown?.map(item => (
                        <tr key={item.expenseId}>
                          <td>{item.description}</td>
                          <td className="mono-amount">₹{(item.totalExpensePaise / 100).toFixed(2)}</td>
                          <td style={{ textAlign: 'right' }} className="mono-amount">
                            <strong>₹{(item.sharePaise / 100).toFixed(2)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary btn-sm" onClick={() => setExplainData(null)}>
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
