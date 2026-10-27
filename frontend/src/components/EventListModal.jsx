import React from 'react';
import { useEvent } from '../context/EventContext.jsx';

export function EventListModal({ isOpen, onClose, onOpenNewEvent }) {
  const { events, currentEvent, selectEvent } = useEvent();

  if (!isOpen) return null;

  const handleSelect = (eventId) => {
    selectEvent(eventId);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Select Event</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {events.length === 0 ? (
          <div className="empty-state">
            <p>No events found. Create your first event to get started.</p>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: '1rem' }}
              onClick={() => {
                onClose();
                onOpenNewEvent();
              }}
            >
              + Create Event
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
            {events.map(ev => {
              const isSelected = currentEvent?._id === ev._id;
              return (
                <div
                  key={ev._id}
                  onClick={() => handleSelect(ev._id)}
                  style={{
                    background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-primary)',
                    border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem 1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {ev.name} {isSelected && <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>(Active)</span>}
                    </div>
                    {ev.description && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {ev.description}
                      </div>
                    )}
                  </div>
                  <span className="badge badge-tag">{ev.currency}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              onClose();
              onOpenNewEvent();
            }}
          >
            + Create New Event
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
