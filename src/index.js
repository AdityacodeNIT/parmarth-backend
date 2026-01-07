import dotenv from 'dotenv';
import connectDB from './db/index.js';

import { app } from './app.js';
import logger from './utils/logger.js';

dotenv.config();

const PORT = process.env.PORT || 8000;

// Handle uncaught exceptions
process.on('uncaughtException', err => {
  logger.error('Uncaught Exception! Shutting down...', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

// Connect to database and start server

connectDB()
  .then(async () => {
    logger.info('Database connected successfully');
    
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT
      });
    });

    // Handle server errors
    server.on('error', error => {
      logger.error('Server error occurred', { error: error.message });
      throw error;
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', err => {
      logger.error('Unhandled Rejection! Shutting down...', {
        error: err.message,
        stack: err.stack
      });

      server.close(() => {
        process.exit(1);
      });

    });

    // Graceful shutdown

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received. Shutting down gracefully...');

      server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });
  })

  .catch(err => {

    logger.error('Database connection failed', {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
    
  });
