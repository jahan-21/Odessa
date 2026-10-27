import React, { useState } from 'react';
import { useEvent } from '../context/EventContext.jsx';
import { api } from '../api/client.js';

export function ParticipantManager() {
  const { currentEvent, participants, refreshEventData, showToast } = useEvent();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!currentEvent) {
    return (
      <div className="card empty-state">
        <h3 className="empty-state-title">No Event Selected</h3>
        <p>Please select an event to manage participants.</p>
      </div>
    );
  }

  const handleAddParticipant = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim()) {
      setErrorMsg('Participant name is required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.addParticipant(currentEvent._id, {
        name: name.trim(),
        email: email.trim() || undefined
      });
      showToast(`Added "${name.trim()}" to event participants!`, 'success');
      setName('');
      setEmail('');
      await refreshEventData();
    } catch (err) {
      setErrorMsg(err.message);
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (p) => {
    const confirmPrompt = window.confirm(
      `Are you sure you want to deactivate or remove "${p.name}"? If they have existing expenses or settlement records, their status will be set to INACTIVE to preserve financial history.`
    );
    if (!confirmPrompt) return;

    try {
      const res = await api.deactivateParticipant(currentEvent._id, p._id);
      showToast(res.message, 'info');
      await refreshEventData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div>
      {/* Add Participant Card */}
      <div className="card">
        <h2 className="card-title">Add Participant</h2>
        <p className="card-subtitle">
          Participants must be enrolled in this event before they can pay or share expenses.
        </p>

        <form onSubmit={handleAddParticipant} style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Asha Sharma"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Email Address (Optional)</label>
              <input
                type="email"
                className="form-control"
                placeholder="e.g. asha@campus.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {errorMsg && <div className="form-error" style={{ marginTop: '0.75rem' }}>{errorMsg}</div>}

          <div style={{ marginTop: '1.25rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Adding...' : '+ Add Participant'}
            </button>
          </div>
        </form>
      </div>

      {/* Participants Roster Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Participant Roster</h2>
            <p className="card-subtitle">
              Total {participants.length} registered participant{participants.length !== 1 ? 's' : ''} in this event.
            </p>
          </div>
        </div>

        {participants.length === 0 ? (
          <div className="empty-state">
            <p>No participants registered yet. Use the form above to add members.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {participants.map(p => (
                  <tr key={p._id}>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{p.name}</strong>
                    </td>
                    <td>{p.email || <span style={{ opacity: 0.5 }}>None</span>}</td>
                    <td>
                      <span className={`badge ${p.status === 'ACTIVE' ? 'badge-credit' : 'badge-tag'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td>
                      {p.status === 'ACTIVE' ? (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeactivate(p)}
                          title="Safely deactivate or remove participant"
                        >
                          Remove
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Deactivated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
