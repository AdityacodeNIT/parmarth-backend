import { authenticate, getHeaders, createOrder } from "../utils/ShipRocket.js";
import { Product } from "../models/product.models.js";
import { Address } from "../models/address.models.js";
import axios from "axios";

// Authenticatication
authenticate().catch((err) => console.error(err.message));

// Controller function for the  Shiprocket order
export const createOrderController = async (req, res) => {
        try {
                console.log(" ye hai bhau ", req.body);
                const { productId, quantity, Address_id } = req.body.items[0];

                const product = await Product.findById(productId);
                const address = await Address.findById(Address_id);

                console.log(product);
                console.log(address);
                console.log(req.user.email);

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

                console.log("the value is", newOrder);

                const result = await createOrder(newOrder);

                console.log(result);
                res.status(201).json({
                        data: result,
                        message: "Order created successfully",
                });
        } catch (error) {
                res.status(500).json({ error: error.message });
        }
};

export const getAllOrdersController = async (req, res) => {
        console.log("Received request at getAllOrdersController");

        try {
                const headers = await getHeaders();

                // Step 2: Fetch orders from Shiprocket
                console.log("Fetching orders from Shiprocket...");
                const response = await axios.get(
                        "https://apiv2.shiprocket.in/v1/external/orders",
                        headers,
                );

                let orders = response.data;

                console.log(req.user.email);

                // console.log(orders.data);

                // Log only the customer_email for each order
                console.log(orders.data[0].customer_email);

                for (let order of orders.data) {
                        console.log(order.customer_email); // Logs the email of each order
                }

                if (req.user.isAdmin === "false") {
                        console.log("Filtering orders for the regular user...");

                        // Check if orders.data is an array
                        if (Array.isArray(orders.data)) {
                                console.log(
                                        "orders.data is an array. Proceeding with filtering...",
                                );

                                // Log the email being checked for filtering
                                console.log("User email:", req.user.email);

                                // Filter the orders and log details of each order being checked
                                const filteredOrders = orders.data.filter(
                                        (order) => {
                                                console.log(
                                                        "Order customer email:",
                                                        order.customer_email,
                                                );
                                                return (
                                                        order.customer_email ===
                                                        req.user.email
                                                ); // Return the comparison result
                                        },
                                );

                                // Maintain the original structure
                                orders.data = filteredOrders;
                        } else {
                                console.log(
                                        "orders.data is not an array:",
                                        orders.data,
                                );
                        }
                } else {
                        console.log("Admin user. No filtering applied.");
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
        console.log("Received request at getOrder");
        try {
                const headers = await getHeaders();
                const id = req.params.id; // Extract the ID from the request params
                console.log("Order ID:", id);

                // Log headers to ensure correct Authorization
                console.log("Request headers:", headers);

                // Log the request URL
                console.log(
                        `Making request to: https://apiv2.shiprocket.in/v1/external/orders/show/${id}`,
                );

                // Make the API request to Shiprocket
                const response = await axios.get(
                        `https://apiv2.shiprocket.in/v1/external/orders/show/${id}`,
                        headers,
                );

                console.log("Response data:", response.data);
                const orders = response.data;

                // Send successful response
                res.status(200).json({
                        data: orders,
                        message: "Orders fetched successfully",
                });
        } catch (err) {
                console.error("Error fetching orders:", err.message || err);
                console.error("Error details:", err.response?.data); // Log the full error response
                res.status(500).json({
                        error: err.message || "Failed to fetch orders",
                });
        }
};
