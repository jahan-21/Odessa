import React, { useState } from 'react';
import { EventProvider, useEvent } from './context/EventContext.jsx';
import { Header } from './components/Header.jsx';
import { Navigation } from './components/Navigation.jsx';
import { EventOverview } from './components/EventOverview.jsx';
import { ParticipantManager } from './components/ParticipantManager.jsx';
import { ExpenseManager } from './components/ExpenseManager.jsx';
import { BalanceSheet } from './components/BalanceSheet.jsx';
import { SettlementView } from './components/SettlementView.jsx';
import { AuditReportView } from './components/AuditReportView.jsx';
import { CreateEventModal } from './components/CreateEventModal.jsx';
import { EventListModal } from './components/EventListModal.jsx';

function MainApp() {
  const [activeTab, setActiveTab] = useState('overview');
  const [newEventModalOpen, setNewEventModalOpen] = useState(false);
  const [eventListModalOpen, setEventListModalOpen] = useState(false);

  return (
    <div className="app-container">
      <Header
        onOpenNewEvent={() => setNewEventModalOpen(true)}
        onOpenEventList={() => setEventListModalOpen(true)}
      />

      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <main>
        {activeTab === 'overview' && (
          <EventOverview onNavigate={setActiveTab} />
        )}
        {activeTab === 'participants' && (
          <ParticipantManager />
        )}
        {activeTab === 'expenses' && (
          <ExpenseManager />
        )}
        {activeTab === 'balances' && (
          <BalanceSheet />
        )}
        {activeTab === 'settlements' && (
          <SettlementView />
        )}
        {activeTab === 'reports' && (
          <AuditReportView />
        )}
      </main>

      <CreateEventModal
        isOpen={newEventModalOpen}
        onClose={() => setNewEventModalOpen(false)}
      />

      <EventListModal
        isOpen={eventListModalOpen}
        onClose={() => setEventListModalOpen(false)}
        onOpenNewEvent={() => setNewEventModalOpen(true)}
      />
    </div>
  );
}

export function App() {
  return (
    <EventProvider>
      <MainApp />
    </EventProvider>
  );
}

export default App;
