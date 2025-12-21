import mongoose from "mongoose";
import logger from "../utils/logger.js";
import databaseManager from "../config/database.js";

const connectDB = async () => {
        try {
                // Use the enhanced database manager
                const connectionInstance = await databaseManager.connect(
                        process.env.MONGODB_URI
                );

                logger.info("MongoDB connected successfully", {
                        host: connectionInstance.connection.host,
                        name: connectionInstance.connection.name,
                        readyState: connectionInstance.connection.readyState,
                        poolSize: connectionInstance.connection.maxPoolSize
                });

                // Set up monitoring
                setupConnectionMonitoring();

                return connectionInstance;
        } catch (error) {
                logger.error("MongoDB connection failed", {
                        error: error.message,
                        stack: error.stack
                });
                process.exit(1);
        }
};

// Set up connection monitoring
const setupConnectionMonitoring = () => {
        const db = mongoose.connection;

        // Monitor connection pool events
        db.on('connectionPoolCreated', (event) => {
                logger.debug('Connection pool created', { 
                        address: event.address,
                        options: event.options 
                });
        });

        db.on('connectionPoolClosed', (event) => {
                logger.info('Connection pool closed', { address: event.address });
        });

        db.on('connectionCreated', (event) => {
                logger.debug('Connection created', { 
                        connectionId: event.connectionId,
                        address: event.address 
                });
        });

        db.on('connectionClosed', (event) => {
                logger.debug('Connection closed', { 
                        connectionId: event.connectionId,
                        address: event.address,
                        reason: event.reason 
                });
        });

        // Monitor slow operations
        db.on('commandStarted', (event) => {
                if (process.env.LOG_SLOW_QUERIES === 'true') {
                        logger.debug('Database command started', {
                                commandName: event.commandName,
                                databaseName: event.databaseName,
                                requestId: event.requestId
                        });
                }
        });

        db.on('commandSucceeded', (event) => {
                const duration = event.duration;
                if (duration > 1000) { // Log queries taking more than 1 second
                        logger.warn('Slow database query detected', {
                                commandName: event.commandName,
                                duration: `${duration}ms`,
                                requestId: event.requestId
                        });
                }
        });

        db.on('commandFailed', (event) => {
                logger.error('Database command failed', {
                        commandName: event.commandName,
                        failure: event.failure,
                        duration: `${event.duration}ms`,
                        requestId: event.requestId
                });
        });
};

// Health check function
export const checkDatabaseHealth = async () => {
        try {
                return await databaseManager.healthCheck();
        } catch (error) {
                logger.error('Database health check failed', { error: error.message });
                return {
                        status: 'unhealthy',
                        error: error.message
                };
        }
};

// Get database statistics
export const getDatabaseStats = async () => {
        try {
                return await databaseManager.getStats();
        } catch (error) {
                logger.error('Error getting database stats', { error: error.message });
                throw error;
        }
};

export default connectDB;
