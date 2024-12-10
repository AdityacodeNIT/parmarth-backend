import { authenticate, getHeaders } from "../utils/ShipRocket.js";

// Authenticate with Shiprocket on server start
authenticate().catch((err) => console.error(err.message));

// Controller function for creating a Shiprocket order
export const createOrderController = async (req, res) => {
        try {
                console.log(req.body);
                const { orderData } = req.body;

                const result = await createOrder(orderData);
                console.log(result);
                res.status(201).json({
                        message: "Order created successfully",
                        data: result,
                });
        } catch (error) {
                res.status(500).json({ error: error.message });
        }
};
