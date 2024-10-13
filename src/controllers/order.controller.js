import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Order } from "../models/order.models.js";

// POST route to place a new order
// const OrderdItems = asyncHandler(async (req, res) => {
//         const newOrder = new Order(req.body, req.files);
//         try {
//                 const savedOrder = await newOrder.save();
//                 res.status(200).send(savedOrder);
//         } catch (error) {
//                 res.status(500).send(error);
//         }
// });

const OrderdItems = asyncHandler(async (req, res) => {
        const { userId, items } = req.body; // items contains productId and quantity

        try {
                const newOrder = new Order({
                        userId,
                        items, // This includes the productId and quantity
                });

                const savedOrder = await newOrder.save();
                res.status(200).send(savedOrder);
        } catch (error) {
                res.status(500).send(error);
        }
});

// GET route to retrieve orders for a specific user
// app.get("/orders/:userId",)
// const retreiveOrder = asyncHandler(async (req, res) => {
//         try {
//                 const orders = await Order.find({
//                         userId: req.params.userId,
//                 }).sort({
//                         date: -1,
//                 });
//                 res.status(200).send(orders);
//         } catch (error) {
//                 res.status(500).send(error);
//         }
// });

const retreiveOrder = asyncHandler(async (req, res) => {
        try {
                const orders = await Order.find({ userId: req.params.userId })
                        .populate("items.productId", "name price ProductImage")
                        .sort({ createdAt: -1 });

                res.status(200).send(orders);
        } catch (error) {
                res.status(500).send(error);
        }
});

export { retreiveOrder, OrderdItems };
