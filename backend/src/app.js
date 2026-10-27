const express = require('express');
const { errorHandler, AppError } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const apiV1Router = require('./routes/v1');

const app = express();

// Security & CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply rate limiting
app.use(rateLimiter(1000, 15 * 60 * 1000));

// Mount REST API version 1
app.use('/api/v1', apiV1Router);

// 404 Catch-All
app.use((req, res, next) => {
  next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
