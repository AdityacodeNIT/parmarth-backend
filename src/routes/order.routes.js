import { Router } from "express";
import { OrderdItems, retreiveOrder } from "../controllers/order.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const orderRouter = Router();

orderRouter.route("/setOrders").post(verifyJWT, OrderdItems);

orderRouter.route("/orders").get(verifyJWT, retreiveOrder);

export default orderRouter;
