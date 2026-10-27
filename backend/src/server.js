try {
  require('dotenv').config();
} catch (_) {
  // Use environment variables or defaults
}
const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`CampusSplit Backend Server running on port ${PORT}`);
      console.log(`API Base: http://localhost:${PORT}/api/v1`);
      console.log(`=================================================`);
    });

    const shutdown = async () => {
      console.log('\nGracefully shutting down...');
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
