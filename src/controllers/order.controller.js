import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Order } from "../models/order.models.js";

// POST route to place a new order
const OrderdItems = asyncHandler(async (req, res) => {
  const newOrder = new Order(req.body);
  try {
    const savedOrder = await newOrder.save();
    res.status(200).send(savedOrder);
  } catch (error) {
    res.status(500).send(error);
  }
});

// GET route to retrieve orders for a specific user
// app.get("/orders/:userId",)
const retreiveOrder = asyncHandler(async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({
      date: -1,
    });
    res.status(200).send(orders);
  } catch (error) {
    res.status(500).send(error);
  }
});

export { retreiveOrder, OrderdItems };
