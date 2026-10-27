import React from 'react';

export function Navigation({ activeTab, onSelectTab }) {
  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'participants', label: '👥 Participants' },
    { id: 'expenses', label: '💳 Expenses' },
    { id: 'balances', label: '⚖️ Balances & Explain' },
    { id: 'settlements', label: '🤝 Settlement Engine' },
    { id: 'reports', label: '📑 Reports & Audit' }
  ];

  return (
    <nav className="nav-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onSelectTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
