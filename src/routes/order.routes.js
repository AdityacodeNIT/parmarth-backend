import { Router } from "express";
import { OrderdItems } from "../controllers/order.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const orderRouter = Router();

orderRouter.route("/setOrders").post(verifyJWT, OrderdItems);
export default orderRouter;
