const express = require('express');
const router = express.Router();

const eventRoutes = require('./eventRoutes');
const participantRoutes = require('./participantRoutes');
const expenseRoutes = require('./expenseRoutes');
const balanceRoutes = require('./balanceRoutes');
const settlementRoutes = require('./settlementRoutes');
const auditRoutes = require('./auditRoutes');
const reportRoutes = require('./reportRoutes');

// Root API Health
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ONLINE',
    service: 'CampusSplit API v1',
    timestamp: new Date().toISOString()
  });
});

// Event collection routes
router.use('/events', eventRoutes);

// Nested routes scoped to a specific event
router.use('/events/:eventId/participants', participantRoutes);
router.use('/events/:eventId/expenses', expenseRoutes);
router.use('/events/:eventId/balances', balanceRoutes);
router.use('/events/:eventId/settlements', settlementRoutes);
router.use('/events/:eventId/audit', auditRoutes);
router.use('/events/:eventId/report', reportRoutes);

module.exports = router;
