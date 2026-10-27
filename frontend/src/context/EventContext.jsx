import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client.js';

const EventContext = createContext(null);

export function EventProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [balancesData, setBalancesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const loadEvents = useCallback(async (selectFirst = false) => {
    try {
      setLoading(true);
      const list = await api.getEvents();
      setEvents(list);
      if (list.length > 0) {
        if (selectFirst || !currentEvent) {
          const detailed = await api.getEvent(list[0]._id);
          setCurrentEvent(detailed);
        } else {
          // Refresh current event
          const updated = await api.getEvent(currentEvent._id);
          setCurrentEvent(updated);
        }
      } else {
        setCurrentEvent(null);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentEvent, showToast]);

  const selectEvent = useCallback(async (eventId) => {
    try {
      setLoading(true);
      const ev = await api.getEvent(eventId);
      setCurrentEvent(ev);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const refreshEventData = useCallback(async () => {
    if (!currentEvent?._id) return;
    try {
      const [parts, bal, ev] = await Promise.all([
        api.getParticipants(currentEvent._id, true),
        api.getBalances(currentEvent._id),
        api.getEvent(currentEvent._id)
      ]);
      setParticipants(parts);
      setBalancesData(bal);
      setCurrentEvent(ev);
    } catch (err) {
      console.error('Error refreshing event data:', err);
    }
  }, [currentEvent?._id]);

  useEffect(() => {
    loadEvents(true);
  }, []);

  useEffect(() => {
    if (currentEvent?._id) {
      refreshEventData();
    } else {
      setParticipants([]);
      setBalancesData(null);
    }
  }, [currentEvent?._id, refreshEventData]);

  const value = {
    events,
    currentEvent,
    participants,
    balancesData,
    loading,
    toasts,
    showToast,
    loadEvents,
    selectEvent,
    refreshEventData
  };

  return (
    <EventContext.Provider value={value}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </EventContext.Provider>
  );
}

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}
