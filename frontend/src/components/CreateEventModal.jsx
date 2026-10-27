import React, { useState } from 'react';
import { useEvent } from '../context/EventContext.jsx';
import { api } from '../api/client.js';

export function CreateEventModal({ isOpen, onClose }) {
  const { loadEvents, selectEvent, showToast } = useEvent();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Event name is required.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const newEvent = await api.createEvent({
        name: name.trim(),
        description: description.trim() || undefined,
        currency: 'INR'
      });
      showToast(`Created event "${newEvent.name}"!`, 'success');
      await loadEvents();
      await selectEvent(newEvent._id);
      onClose();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Create New Event</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Event Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Manali Hackathon 2026"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="e.g. Group expenses for team travel, food, and supplies"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Currency</label>
            <input
              type="text"
              className="form-control"
              value="INR (₹ Indian Rupee — Integer Paise Precision)"
              disabled
              style={{ opacity: 0.8 }}
            />
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
