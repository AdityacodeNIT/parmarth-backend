import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      process.env.MONGODB_URI,
      {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        autoIndex: true,   // let mongoose handle indexes naturally
        autoCreate: true
      }
    );

    logger.info("MongoDB connected successfully", {
      host: connectionInstance.connection.host,
      name: connectionInstance.connection.name,
      readyState: connectionInstance.connection.readyState,
      poolSize: connectionInstance.connection.maxPoolSize
    });

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

/* ================= CONNECTION MONITORING ================= */

const setupConnectionMonitoring = () => {
  const db = mongoose.connection;

  db.on("connected", () => {
    logger.info("Mongoose connected");
  });

  db.on("error", (error) => {
    logger.error("Mongoose connection error", { error });
  });

  db.on("disconnected", () => {
    logger.warn("Mongoose disconnected");
  });

  db.on("reconnected", () => {
    logger.info("Mongoose reconnected");
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await mongoose.connection.close();
    logger.info("MongoDB connection closed due to app termination");
    process.exit(0);
  });

  /* ===== Optional: Slow query logging ===== */

  if (process.env.LOG_SLOW_QUERIES === "true") {
    db.on("commandSucceeded", (event) => {
      if (event.duration > 1000) {
        logger.warn("Slow database query detected", {
          commandName: event.commandName,
          duration: `${event.duration}ms`,
          requestId: event.requestId
        });
      }
    });
  }
};

/* ================= HEALTH CHECK ================= */

export const checkDatabaseHealth = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return { status: "unhealthy", connected: false };
    }

    await mongoose.connection.db.admin().ping();

    return {
      status: "healthy",
      connected: true,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState
    };
  } catch (error) {
    logger.error("Database health check failed", { error: error.message });
    return {
      status: "unhealthy",
      error: error.message
    };
  }
};

/* ================= DATABASE STATS ================= */

export const getDatabaseStats = async () => {
  try {
    const stats = await mongoose.connection.db.stats();
    return stats;
  } catch (error) {
    logger.error("Error getting database stats", { error: error.message });
    throw error;
  }
};

export default connectDB;
