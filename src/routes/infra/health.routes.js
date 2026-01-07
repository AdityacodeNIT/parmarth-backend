import express from "express";
import logger from "../../utils/logger.js";

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    const { checkDatabaseHealth } = await import("../../db/index.js");
    const dbHealth = await checkDatabaseHealth();

    res.status(200).json({
      status: "OK",
      uptime: process.uptime(),
      database: dbHealth.status
    });
  } catch (err) {
    logger.error("Health check failed", err);
    res.status(503).json({ status: "ERROR" });
  }
});

export default router;
