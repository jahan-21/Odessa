import React, { useState } from 'react';
import { useEvent } from '../context/EventContext.jsx';
import { api } from '../api/client.js';

export function Header({ onOpenNewEvent, onOpenEventList }) {
  const { currentEvent, loadEvents, showToast, selectEvent } = useEvent();
  const [seeding, setSeeding] = useState(false);

  const handleSeedDemo = async () => {
    if (seeding) return;
    try {
      setSeeding(true);
      const seeded = await api.seedDemoEvent();
      showToast('Seeded Case Study Demonstration Event (Asha, Bala, Charan)!', 'success');
      await loadEvents();
      if (seeded?.eventId) {
        await selectEvent(seeded.eventId);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <span className="brand-badge">CORE v1</span>
        <div>
          <h1 className="brand-title">CampusSplit</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Group Expense Management & Settlement System
          </p>
        </div>
      </div>

      <div className="header-actions">
        {currentEvent ? (
          <button className="btn btn-secondary btn-sm" onClick={onOpenEventList}>
            <span>📁 Event: <strong>{currentEvent.name}</strong></span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>▾</span>
          </button>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={onOpenEventList}>
            Select Event
          </button>
        )}

        <button className="btn btn-outline btn-sm" onClick={onOpenNewEvent}>
          + New Event
        </button>

        <button
          className="btn btn-success btn-sm"
          onClick={handleSeedDemo}
          disabled={seeding}
          title="Seed the exact Campus Hire Case Study Demo Event"
        >
          {seeding ? 'Seeding...' : '⚡ Load Case Study Demo'}
        </button>
      </div>
    </header>
  );
}
