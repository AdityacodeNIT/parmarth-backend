import express from "express";
import { getDatabaseStats } from "../../db/index.js";

const router = express.Router();

// NOTE: protect this with admin auth in production
router.get("/admin/db-stats", async (req, res) => {
  try {
    const stats = await getDatabaseStats();
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to get database statistics"
    });
  }
});

export default router;
