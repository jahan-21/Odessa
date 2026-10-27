import React, { useState, useEffect, useCallback } from 'react';
import { useEvent } from '../context/EventContext.jsx';
import { api } from '../api/client.js';

export function AuditReportView() {
  const { currentEvent, showToast } = useEvent();
  const [reconciliation, setReconciliation] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadReportData = useCallback(async () => {
    if (!currentEvent?._id) return;
    try {
      setLoading(true);
      const [recon, logs] = await Promise.all([
        api.getReconciliation(currentEvent._id),
        api.getAuditHistory(currentEvent._id)
      ]);
      setReconciliation(recon);
      setAuditLogs(logs);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentEvent?._id, showToast]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  if (!currentEvent) {
    return (
      <div className="card empty-state">
        <h3 className="empty-state-title">No Event Selected</h3>
        <p>Please select an event to view reports and audit logs.</p>
      </div>
    );
  }

  const handleDownloadCSV = async () => {
    try {
      setDownloading(true);
      const csvText = await api.downloadCSV(currentEvent._id);
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campussplit-event-${currentEvent.name.toLowerCase().replace(/\s+/g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('CSV Export downloaded successfully!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDownloading(false);
    }
  };

  const inv = reconciliation?.invariants || {};
  const totals = reconciliation?.totals || {};

  return (
    <div>
      {/* Reconciliation Invariant Report Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Mathematical Invariant Verification</h2>
            <p className="card-subtitle">
              Formal consistency proofs asserted against live event data.
            </p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleDownloadCSV}
            disabled={downloading}
          >
            {downloading ? 'Exporting...' : '📥 Download CSV Audit'}
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Conservation of Money</div>
            <div className="stat-value" style={{ color: inv.conservationOfMoneyPassed ? '#34d399' : '#f87171', fontSize: '1.25rem' }}>
              {inv.conservationOfMoneyPassed ? '✓ PASSED' : '✗ FAILED'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              &Sigma; Net Balances &equiv; 0 paise
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Ledger Conservation</div>
            <div className="stat-value" style={{ color: inv.settlementLedgerConservationPassed ? '#34d399' : '#f87171', fontSize: '1.25rem' }}>
              {inv.settlementLedgerConservationPassed ? '✓ PASSED' : '✗ FAILED'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              &Sigma; Residuals &equiv; 0 paise
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Debt-Credit Equivalence</div>
            <div className="stat-value" style={{ color: inv.netDebtCreditEquivalencePassed ? '#34d399' : '#f87171', fontSize: '1.25rem' }}>
              {inv.netDebtCreditEquivalencePassed ? '✓ PASSED' : '✗ FAILED'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Total Net Debt == Total Net Credit
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Residual Equivalence</div>
            <div className="stat-value" style={{ color: inv.residualDebtCreditEquivalencePassed ? '#34d399' : '#f87171', fontSize: '1.25rem' }}>
              {inv.residualDebtCreditEquivalencePassed ? '✓ PASSED' : '✗ FAILED'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Remaining Debt == Remaining Credit
            </div>
          </div>
        </div>

        {/* Totals Breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg-primary)', padding: '1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Total Expenditure:</span>{' '}
            <strong className="mono-amount">{totals.totalExpenditureRupees || '₹0.00'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Original Net Debt:</span>{' '}
            <strong className="mono-amount">{totals.totalNetDebtRupees || '₹0.00'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Completed Transfers:</span>{' '}
            <strong className="mono-amount">{totals.totalCompletedSettlementsRupees || '₹0.00'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Remaining Debt:</span>{' '}
            <strong className="mono-amount" style={{ color: totals.totalRemainingDebtPaise > 0 ? '#f59e0b' : '#34d399' }}>
              {totals.totalRemainingDebtRupees || '₹0.00'}
            </strong>
          </div>
        </div>
      </div>

      {/* Immutable Audit Log Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Immutable Audit Trail</h2>
            <p className="card-subtitle">
              Chronological log of state-changing operations for evaluation and transparency.
            </p>
          </div>
          <span className="badge badge-tag">{auditLogs.length} Log Entries</span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="empty-state">
            <p>No audit events recorded for this event yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(log => {
                  let actionBadge = 'badge-tag';
                  if (log.action.includes('CREATED') || log.action.includes('RECORDED')) actionBadge = 'badge-credit';
                  if (log.action.includes('DELETED') || log.action.includes('REVERSED')) actionBadge = 'badge-debt';

                  return (
                    <tr key={log._id}>
                      <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${actionBadge}`}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{log.entityType}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {log.details ? (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                            {JSON.stringify(log.details).replace(/"/g, '')}
                          </span>
                        ) : (
                          <span style={{ opacity: 0.5 }}>None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
