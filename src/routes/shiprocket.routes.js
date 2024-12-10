import express from "express";
import { createOrderController } from "../controllers/shipRocket.controllers.js";

const shiprouter = express.Router();

// Route to create an order
shiprouter.post("/order", createOrderController);

export default shiprouter;
