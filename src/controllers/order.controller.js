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
        const { items } = req.body;
        // items contains productId and quantity

        try {
                const newOrder = new Order({
                        userId: req.user._id,
                        items, // This includes the productId and quantity
                });

                const savedOrder = await newOrder.save();
                res.status(200).send(savedOrder);
        } catch (error) {
                res.status(500).send(error);
        }
});

// const retreiveOrder = asyncHandler(async (req, res) => {
//         try {
//                 const orders = await Order.find({ userId: req.user._id })
//                         .populate("items.productId", "name price ProductImage")
//                         .sort({ createdAt: -1 });

//                 res.status(200).send(orders);
//         } catch (error) {
//                 res.status(500).send(error);
//         }
// });

export { OrderdItems };
