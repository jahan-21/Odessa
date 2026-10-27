import React, { useState, useEffect } from 'react';
import { useEvent } from '../context/EventContext.jsx';
import { api } from '../api/client.js';

export function ExpenseModal({ isOpen, onClose, onSaved, expenseToEdit = null }) {
  const { currentEvent, participants, showToast } = useEvent();

  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [payerId, setPayerId] = useState('');
  const [splitMethod, setSplitMethod] = useState('EQUAL');
  const [category, setCategory] = useState('GENERAL');
  const [notes, setNotes] = useState('');

  // Beneficiaries selection state
  // For EQUAL: set of participant IDs
  const [selectedEqualIds, setSelectedEqualIds] = useState([]);

  // For EXACT: map of participantId -> shareRupees
  const [exactShares, setExactShares] = useState({});

  // For PERCENTAGE: map of participantId -> percentage
  const [percentageShares, setPercentageShares] = useState({});

  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeParticipants = participants.filter(p => p.status === 'ACTIVE');

  // Populate state on open or edit
  useEffect(() => {
    if (expenseToEdit) {
      setDescription(expenseToEdit.description || '');
      setAmountRupees(expenseToEdit.amountPaise ? (expenseToEdit.amountPaise / 100).toFixed(2) : '');
      setPayerId(expenseToEdit.payerId?._id || expenseToEdit.payerId || '');
      setSplitMethod(expenseToEdit.splitMethod || 'EQUAL');
      setCategory(expenseToEdit.category || 'GENERAL');
      setNotes(expenseToEdit.notes || '');

      if (expenseToEdit.splitMethod === 'EQUAL') {
        setSelectedEqualIds(expenseToEdit.beneficiaries.map(b => b.participantId?._id || b.participantId));
      } else if (expenseToEdit.splitMethod === 'EXACT') {
        const exactMap = {};
        expenseToEdit.beneficiaries.forEach(b => {
          const id = b.participantId?._id || b.participantId;
          exactMap[id] = (b.sharePaise / 100).toFixed(2);
        });
        setExactShares(exactMap);
      } else if (expenseToEdit.splitMethod === 'PERCENTAGE') {
        const percMap = {};
        expenseToEdit.beneficiaries.forEach(b => {
          const id = b.participantId?._id || b.participantId;
          percMap[id] = b.percentageBps ? (b.percentageBps / 100).toFixed(2) : '';
        });
        setPercentageShares(percMap);
      }
    } else {
      // Default new expense
      setDescription('');
      setAmountRupees('');
      setPayerId(activeParticipants[0]?._id || '');
      setSplitMethod('EQUAL');
      setCategory('GENERAL');
      setNotes('');
      // By default, all active participants selected for equal split
      setSelectedEqualIds(activeParticipants.map(p => p._id));
      setExactShares({});
      setPercentageShares({});
    }
    setPreviewData(null);
    setPreviewError('');
  }, [isOpen, expenseToEdit, participants]);

  // Compute live preview whenever inputs change
  useEffect(() => {
    if (!isOpen) return;
    const numAmount = parseFloat(amountRupees);
    if (!numAmount || numAmount <= 0) {
      setPreviewData(null);
      setPreviewError('');
      return;
    }

    let payload = {
      description: description || 'Expense Preview',
      amountRupees: numAmount,
      payerId: payerId || activeParticipants[0]?._id,
      splitMethod,
      category
    };

    if (splitMethod === 'EQUAL') {
      if (selectedEqualIds.length === 0) {
        setPreviewData(null);
        setPreviewError('Select at least one beneficiary.');
        return;
      }
      payload.beneficiaryIds = selectedEqualIds;
    } else if (splitMethod === 'EXACT') {
      const beneficiaries = Object.entries(exactShares)
        .filter(([_, val]) => parseFloat(val) > 0)
        .map(([id, val]) => ({ participantId: id, shareRupees: parseFloat(val) }));

      if (beneficiaries.length === 0) {
        setPreviewData(null);
        setPreviewError('Enter exact shares for beneficiaries.');
        return;
      }
      payload.beneficiaries = beneficiaries;
    } else if (splitMethod === 'PERCENTAGE') {
      const beneficiaries = Object.entries(percentageShares)
        .filter(([_, val]) => parseFloat(val) > 0)
        .map(([id, val]) => ({ participantId: id, percentage: parseFloat(val) }));

      if (beneficiaries.length === 0) {
        setPreviewData(null);
        setPreviewError('Enter percentages for beneficiaries.');
        return;
      }
      payload.beneficiaries = beneficiaries;
    }

    // Call preview endpoint
    api.previewExpense(currentEvent._id, payload)
      .then(res => {
        setPreviewData(res);
        setPreviewError('');
      })
      .catch(err => {
        setPreviewData(null);
        setPreviewError(err.message);
      });
  }, [amountRupees, payerId, splitMethod, selectedEqualIds, exactShares, percentageShares]);

  if (!isOpen) return null;

  const toggleEqualParticipant = (id) => {
    if (selectedEqualIds.includes(id)) {
      setSelectedEqualIds(selectedEqualIds.filter(x => x !== id));
    } else {
      setSelectedEqualIds([...selectedEqualIds, id]);
    }
  };

  const handleExactChange = (id, val) => {
    setExactShares(prev => ({ ...prev, [id]: val }));
  };

  const handlePercentageChange = (id, val) => {
    setPercentageShares(prev => ({ ...prev, [id]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      showToast('Expense description is required.', 'error');
      return;
    }
    const numAmount = parseFloat(amountRupees);
    if (!numAmount || numAmount <= 0) {
      showToast('Valid expense amount is required.', 'error');
      return;
    }
    if (!payerId) {
      showToast('Please select a payer.', 'error');
      return;
    }

    let payload = {
      description: description.trim(),
      amountRupees: numAmount,
      payerId,
      splitMethod,
      category,
      notes: notes.trim()
    };

    if (splitMethod === 'EQUAL') {
      if (selectedEqualIds.length === 0) {
        showToast('At least one beneficiary must be selected.', 'error');
        return;
      }
      payload.beneficiaryIds = selectedEqualIds;
    } else if (splitMethod === 'EXACT') {
      const beneficiaries = Object.entries(exactShares)
        .filter(([_, val]) => parseFloat(val) > 0)
        .map(([id, val]) => ({ participantId: id, shareRupees: parseFloat(val) }));
      payload.beneficiaries = beneficiaries;
    } else if (splitMethod === 'PERCENTAGE') {
      const beneficiaries = Object.entries(percentageShares)
        .filter(([_, val]) => parseFloat(val) > 0)
        .map(([id, val]) => ({ participantId: id, percentage: parseFloat(val) }));
      payload.beneficiaries = beneficiaries;
    }

    try {
      setSubmitting(true);
      if (expenseToEdit) {
        await api.updateExpense(currentEvent._id, expenseToEdit._id, payload);
        showToast('Expense updated successfully!', 'success');
      } else {
        await api.createExpense(currentEvent._id, payload);
        showToast('Expense recorded successfully!', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Remaining for exact split calculation
  const totalExactAllocated = Object.values(exactShares).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
  const remainingExact = (parseFloat(amountRupees) || 0) - totalExactAllocated;

  // Total percentage calculation
  const totalPercentageAllocated = Object.values(percentageShares).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{expenseToEdit ? 'Edit Expense' : 'Record New Expense'}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Description & Amount */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Dinner at Bistro"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (₹ INR) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-control"
                placeholder="0.00"
                value={amountRupees}
                onChange={e => setAmountRupees(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Payer, Category, Split Method */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Paid By *</label>
              <select
                className="form-control"
                value={payerId}
                onChange={e => setPayerId(e.target.value)}
                required
              >
                {activeParticipants.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-control"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="GENERAL">General</option>
                <option value="FOOD">Food & Dining</option>
                <option value="TRAVEL">Travel & Transport</option>
                <option value="STAY">Accommodation</option>
                <option value="SUPPLIES">Supplies & Hardware</option>
                <option value="TICKETS">Tickets & Fees</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Split Method *</label>
              <select
                className="form-control"
                value={splitMethod}
                onChange={e => setSplitMethod(e.target.value)}
              >
                <option value="EQUAL">Equal Split</option>
                <option value="EXACT">Exact Amount Split</option>
                <option value="PERCENTAGE">Percentage Split</option>
              </select>
            </div>
          </div>

          {/* Beneficiaries Allocation Inputs */}
          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label className="form-label">
              Beneficiaries & Shares
              {splitMethod === 'EQUAL' && (
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  ({selectedEqualIds.length} selected)
                </span>
              )}
            </label>

            {splitMethod === 'EQUAL' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                {activeParticipants.map(p => (
                  <label key={p._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedEqualIds.includes(p._id)}
                      onChange={() => toggleEqualParticipant(p._id)}
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            )}

            {splitMethod === 'EXACT' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.5rem', color: Math.abs(remainingExact) < 0.001 ? '#34d399' : '#f87171' }}>
                  <span>Allocated: ₹{totalExactAllocated.toFixed(2)}</span>
                  <span>
                    {Math.abs(remainingExact) < 0.001
                      ? '✓ Fully Allocated'
                      : remainingExact > 0
                      ? `Remaining to allocate: ₹${remainingExact.toFixed(2)}`
                      : `Exceeds total by ₹${Math.abs(remainingExact).toFixed(2)}`}
                  </span>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {activeParticipants.map(p => (
                    <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '1rem' }}>
                      <span style={{ fontSize: '0.88rem' }}>{p.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', width: '130px' }}>
                        <span>₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-control"
                          style={{ padding: '0.3rem 0.5rem' }}
                          placeholder="0.00"
                          value={exactShares[p._id] || ''}
                          onChange={e => handleExactChange(p._id, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {splitMethod === 'PERCENTAGE' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.5rem', color: Math.abs(totalPercentageAllocated - 100) < 0.01 ? '#34d399' : '#f87171' }}>
                  <span>Total Percentage: {totalPercentageAllocated.toFixed(2)}%</span>
                  <span>
                    {Math.abs(totalPercentageAllocated - 100) < 0.01
                      ? '✓ Exact 100.00%'
                      : `Must equal 100% (Diff: ${(100 - totalPercentageAllocated).toFixed(2)}%)`}
                  </span>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {activeParticipants.map(p => (
                    <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '1rem' }}>
                      <span style={{ fontSize: '0.88rem' }}>{p.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', width: '120px' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="form-control"
                          style={{ padding: '0.3rem 0.5rem' }}
                          placeholder="0.00"
                          value={percentageShares[p._id] || ''}
                          onChange={e => handlePercentageChange(p._id, e.target.value)}
                        />
                        <span>%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes (Optional)</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Receipt uploaded, split agreed upon"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Live Preview Box */}
          {previewError && (
            <div className="form-error" style={{ marginBottom: '1rem' }}>
              ⚠️ {previewError}
            </div>
          )}

          {previewData && (
            <div className="preview-box">
              <div className="preview-header">
                <span>Calculated Share Allocation (Paise-Exact)</span>
                <span>Sum Invariant: {previewData.verification?.exactMatch ? '✓ Verified' : '✗ Failed'}</span>
              </div>
              {previewData.beneficiaries?.map(b => {
                const p = participants.find(part => part._id === b.participantId);
                return (
                  <div key={b.participantId} className="preview-item">
                    <span>{p?.name || b.participantId}</span>
                    <span className="mono-amount">{b.shareRupees}</span>
                  </div>
                );
              })}
              <div className="preview-total">
                <span>Total Allocated</span>
                <span className="mono-amount">{previewData.amountRupeesFormatted}</span>
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (previewError && !previewData)}
            >
              {submitting ? 'Saving...' : expenseToEdit ? 'Update Expense' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
