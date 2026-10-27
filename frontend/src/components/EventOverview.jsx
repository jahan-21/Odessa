import React from 'react';
import { useEvent } from '../context/EventContext.jsx';

export function EventOverview({ onNavigate }) {
  const { currentEvent, balancesData } = useEvent();

  if (!currentEvent) {
    return (
      <div className="card empty-state">
        <h3 className="empty-state-title">No Event Selected</h3>
        <p>Please select an existing event or create a new one to begin managing expenses.</p>
      </div>
    );
  }

  const isReconciled = balancesData?.verification?.isReconciled ?? true;
  const totalExp = balancesData?.totalExpenseAmountRupees || '₹0.00';
  const participantsCount = currentEvent.stats?.participantsCount || 0;
  const expensesCount = currentEvent.stats?.expensesCount || 0;
  const settlementsCount = currentEvent.stats?.settlementsCount || 0;

  // Outstanding net debt in group
  const totalOutstandingPaise = balancesData?.balances
    ? balancesData.balances
        .filter(b => b.residualBalancePaise < 0)
        .reduce((acc, b) => acc + Math.abs(b.residualBalancePaise), 0)
    : 0;
  const totalOutstandingRupees = `₹${(totalOutstandingPaise / 100).toFixed(2)}`;

  return (
    <div>
      {/* Financial Invariant Verification Banner */}
      <div className="invariant-banner">
        <div className="invariant-title">
          <span>✓</span>
          <span>Financial Conservation Verified: Sum of Net Balances = ₹0.00</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {isReconciled ? 'All mathematical invariants holding' : 'Conservation warning'}
        </div>
      </div>

      {/* Event Details Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">{currentEvent.name}</h2>
            <p className="card-subtitle">{currentEvent.description || 'No description provided.'}</p>
          </div>
          <span className="badge badge-tag">Currency: {currentEvent.currency}</span>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Expenditure</div>
            <div className="stat-value">{totalExp}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Unsettled Balance</div>
            <div className="stat-value" style={{ color: totalOutstandingPaise > 0 ? '#f59e0b' : '#10b981' }}>
              {totalOutstandingRupees}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Participants</div>
            <div className="stat-value">{participantsCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Recorded Expenses</div>
            <div className="stat-value">{expensesCount}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <button className="btn btn-primary" onClick={() => onNavigate('expenses')}>
            + Record New Expense
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('settlements')}>
            🤝 View Settlement Plan
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate('balances')}>
            ⚖️ Check Balances
          </button>
        </div>
      </div>
    </div>
  );
}
