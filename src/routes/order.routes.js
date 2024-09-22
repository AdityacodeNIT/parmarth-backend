import { Router } from "express";
import { OrderdItems, retreiveOrder } from "../controllers/order.controller.js";

const orderRouter = Router();

orderRouter.route("/getOrders").post(OrderdItems);

orderRouter.route("/orders/:userId").get(retreiveOrder);

export default orderRouter;
