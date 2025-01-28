import { authenticate, getHeaders, createOrder } from "../utils/ShipRocket.js";
import { Product } from "../models/product.models.js";
import { Address } from "../models/address.models.js";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';

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
                        order_id: uuidv4(),
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
            // Ensure req.user is defined
            if (!req.user) {
                console.error('User not authenticated');
                return res.status(401).json({ error: 'User not authenticated' });
            }
    
            console.log('User:', req.user);
    
            const headers = await getHeaders();
    
            // Fetch orders from Shiprocket
            console.log("Fetching orders from Shiprocket...");
    
            let orders;
            try {
                const response = await axios.get(
                    "https://apiv2.shiprocket.in/v1/external/orders",
                    headers,
                );
                orders = response.data;
            } catch (shiprocketError) {
                // Error occurred while calling Shiprocket API
                console.error('Error fetching orders from Shiprocket:', shiprocketError);
    
                // Check if Shiprocket provided a response
                if (shiprocketError.response) {
                    // Shiprocket responded with an error status code
                    const statusCode = shiprocketError.response.status || 502; // Use 502 Bad Gateway if status code is not provided
                    const shiprocketMessage = shiprocketError.response.data.message || 'Error from Shiprocket API';
    
                    return res.status(statusCode).json({
                        error: `Shiprocket API error: ${shiprocketMessage}`,
                    });
                } else if (shiprocketError.request) {
                    // No response received from Shiprocket
                    return res.status(504).json({
                        error: 'No response from Shiprocket API (Gateway Timeout)',
                    });
                } else {
                    // Other errors
                    return res.status(500).json({
                        error: `Error while communicating with Shiprocket API: ${shiprocketError.message}`,
                    });
                }
            }
    
            // Continue processing orders
            if (!orders.data || !Array.isArray(orders.data)) {
                console.error('Invalid response format from Shiprocket:', orders);
                return res.status(500).json({ error: 'Invalid response from Shiprocket API' });
            }
    
            if (req.user.isAdmin === "false") {
                console.log("Filtering orders for the regular user...");
                const filteredOrders = orders.data.filter(order => {
                    console.log("Order customer email:", order.customer_email);
                    return order.customer_email === req.user.email;
                });
                orders.data = filteredOrders;
            } else {
                console.log("Admin user. No filtering applied.");
            }
    
            res.status(200).json({
                data: orders,
                message: "Orders fetched successfully",
            });
        } catch (err) {
            // Handle any other errors that may occur
            console.error('Error in getAllOrdersController:', err);
            res.status(500).json({
                error: err.message || "An unknown error occurred",
            });
        }
    };
export const getOrder = async (req, res) => {
        console.log("Received request at getOrder");
    
        try {
            const headers = await getHeaders();
            const id = req.params.id;
    
            // Log request details
            console.log("Fetching order with ID:", id);
            console.log("Request headers:", JSON.stringify(headers, null, 2));
            console.log(`Requesting: https://apiv2.shiprocket.in/v1/external/orders/show/${id}`);
    
            // Make the API request to Shiprocket
            const response = await axios.get(
                `https://apiv2.shiprocket.in/v1/external/orders/show/${id}`,
                headers
            );
    
            console.log("API Response Data:", response.data);
    
            // Return successful response
            res.status(200).json({
                success: true,
                data: response.data,
                message: `Order ${id} fetched successfully`
            });
    
        } catch (err) {
            // Log different error types for better debugging
            console.error("Error fetching orders:", err.message || err);
    
            if (err.response) {
                console.error("Error Response Status:", err.response.status);
                console.error("Error Response Data:", err.response.data);
            } else if (err.request) {
                console.error("No Response Received. Request Details:", err.request);
            } else {
                console.error("Request Error:", err.message);
            }
    
            // Return a descriptive error response
            res.status(500).json({
                success: false,
                error: err.response?.data || err.message || "An unknown error occurred",
                hint: "Ensure the order ID is valid and headers contain correct authorization",
                troubleshooting: {
                    possibleCauses: [
                        "Invalid Shiprocket API URL or incorrect endpoint",
                        "Missing or incorrect headers",
                        "API request rate limit exceeded",
                        "Order ID not found"
                    ]
                }
            });
        }
    };
    

// export const cancelOrderController=()={
//         try {
//                 const headers = await getHeaders();

//         } catch (error) {
                
//         }

// }