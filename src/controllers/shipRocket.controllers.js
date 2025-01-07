import { authenticate, getHeaders, createOrder } from "../utils/ShipRocket.js";
import { Product } from "../models/product.models.js";
import { Address } from "../models/address.models.js";
import axios from "axios";

// Authenticatication
authenticate().catch((err) => console.error(err.message));

// Controller function for the  Shiprocket order
export const createOrderController = async (req, res) => {
        try {
                const { productId, quantity, Address_id } = req.body.items[0];

                const product = await Product.findById(productId);
                const address = await Address.findById(Address_id);

                const newOrder = {
                        order_id: productId,
                        order_date: new Date().toISOString(),

                        billing_customer_name: address.firstName,
                        billing_last_name: address.lastName,
                        billing_address: address.streetAddress,
                        billing_city: address.city,
                        billing_pincode: address.postalCode,
                        billing_state: address.state,
                        billing_country: address.country,
                        billing_email: req.user?.email,
                        billing_phone: address.phoneNumber,
                        shipping_is_billing: true,

                        order_items: [
                                {
                                        name: product.name,
                                        sku: "DEFAULTSKU",
                                        units: quantity,
                                        selling_price: product.price,
                                        discount: 0,
                                        tax: product.price * 0.18,
                                },
                        ],
                        payment_method: "Prepaid",
                        sub_total: product.price * quantity,
                        length: product.length,
                        breadth: product.breadth,
                        height: product.height,
                        weight: product.weight / 200,
                };

                const result = await createOrder(newOrder);
                res.status(201).json({
                        data: result,
                        message: "Order created successfully",
                });
        } catch (error) {
                res.status(500).json({ error: error.message });
        }
};

export const getAllOrdersController = async (req, res) => {
        console.log("request reaches here");
        try {
                const headers = await getHeaders();

                // Step 2: Fetch orders from Shiprocket
                console.log("Fetching orders from Shiprocket...");
                const response = await axios.get(
                        "https://apiv2.shiprocket.in/v1/external/orders",
                        headers,
                );
                let orders = response.data;

                if (req.user.isAdmin === "false") {
                        const filteredOrders = orders.data.filter((order) => {
                                return order.customer_email === req.user.email; // Return the comparison result
                        });

                        // Maintain the original structure
                        orders.data = filteredOrders;
                }

                res.status(200).json({
                        data: orders,
                        message: "Orders fetched successfully",
                });
        } catch (err) {
                res.status(500).json({
                        error: err.message || "Failed to fetch orders",
                });
        }
};

export const getOrder = async (req, res) => {
        try {
                // Ensure headers include Authorization and Content-Type
                const headers = await getHeaders();
                const id = req.params.id; // Extra

                // Make the API request to Shiprocket
                const response = await axios.get(
                        `https://apiv2.shiprocket.in/v1/external/orders/show/${id}`,
                        headers, // Correctly structured headers object
                );

                const orders = response.data;

                // Send successful response
                res.status(200).json({
                        data: orders,
                        message: "Orders fetched successfully",
                });
        } catch (err) {
                res.status(500).json({
                        error: err.message || "Failed to fetch orders",
                });
        }
};
