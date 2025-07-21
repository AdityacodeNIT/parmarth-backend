import { authenticate, getHeaders, createOrder,checkServiceability } from "../utils/ShipRocket.js";
import { Product } from "../models/product.models.js";
import { Address } from "../models/address.models.js";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";



const generateSKU = (name) => {
    return name.toLowerCase() // Convert to lowercase
        .replace(/\s+/g, "_") // Replace spaces with underscores
        .replace(/[^a-z0-9_]/g, "") // Remove special characters
        .slice(0, 15) + "_" + Math.floor(1000 + Math.random() * 9000); // Add random 4-digit number
};


// Authentication
authenticate().catch((err) => console.error(err.message));

export const createOrderController = asyncHandler(async (req, res) => {

        const { items } = req.body;
        console.log("Items received for order creation:", items);
    
      
        if (!items || items.length === 0) {
            return res.status(400).json({ error: "No items provided" });
        }

        const orders = [];
        const groupedOrders = {};

        for (const item of items) {
            const { productId, quantity, Address_id,paymentMethod } = item;
            console.log("Payment method received from frontend:", paymentMethod);

            const product = await Product.findById(productId);

            if (!product) {
                throw new ApiError(404, `Product with ID ${productId} not found`);
            }

            await Product.updateOne(
                { _id: productId },
                [
                  { $set: { bought: { $add: ["$bought", 1] } } } // Increment 'bought' by 1
                ]
              );

            if (!groupedOrders[Address_id]) {
                const address = await Address.findById(Address_id);

                if (!address) {
                    throw new ApiError(404, `Address with ID ${Address_id} not found`);
                }

                const isAvailable = await checkServiceability(address.postalCode);
            if (!isAvailable) {
                throw new ApiError(400, `Delivery unavailable for pincode ${address.postalCode}`);
            }

                groupedOrders[Address_id] = {
                    order_id: uuidv4(),
                    order_date: new Date().toISOString(),

                    billing_customer_name: req.user?.username,
                    billing_last_name: address.lastName,
                    billing_address: address.streetAddress,
                    billing_city: address.city,
                    billing_pincode: address.postalCode,
                    billing_state: address.state,
                    billing_country: address.country,
                    billing_email: req.user?.email,
                    billing_phone: address.phoneNumber,
                    shipping_is_billing: true,

                    order_items: [],
                    payment_method: paymentMethod,
                    sub_total: 0,
                    length: 10, // Default values for now
                    breadth: 10,
                    height: 10,
                    weight: 1,
                };
            }

            groupedOrders[Address_id].order_items.push({
                name: product.name,
                sku: generateSKU(product.name),
                units: quantity,
                selling_price: product.price,
                discount: 0,
                tax: product.price * 0.18,
            });

            groupedOrders[Address_id].sub_total += product.price * quantity;
        }
        console.log("Grouped Orders:", groupedOrders);
      

        const result = await createOrder(groupedOrders);



        res.status(201).json({
            data: result,
            message: "Order created successfully",
        });
   
});

export const getAllOrdersController = asyncHandler(async (req, res) => {
    if (!req.user) {
        console.error('User not authenticated');
        throw new ApiError(401, "User not authenticated");
    }

    const headers = await getHeaders();
    let orders;

    try {
        const response = await axios.get(
            "https://apiv2.shiprocket.in/v1/external/orders",
            headers,
        );
        orders = response.data;
    } catch (shiprocketError) {
        console.error('Error fetching orders from Shiprocket:', shiprocketError);

        if (shiprocketError.response) {
            const statusCode = shiprocketError.response.status || 502;
            console.log(shiprocketError.response.data);
            const shiprocketMessage = shiprocketError.response.data.message || 'Error from Shiprocket API';

            return res.status(statusCode).json({
                success: false,
                error: `Shiprocket API error: ${shiprocketMessage}`,
            });
        } else if (shiprocketError.request) {
            return res.status(504).json({
                success: false,
                error: 'No response from Shiprocket API (Gateway Timeout)',
            });
        } else {
            return res.status(500).json({
                success: false,
                error: `Error communicating with Shiprocket API: ${shiprocketError.message}`,
            });
        }
    }

    if (!orders.data || !Array.isArray(orders.data)) {
        return res.status(500).json({
            success: false,
            error: 'Invalid response from Shiprocket API',
        });
    }


    // Role-based filtering
    if (req.user.role === 'customer') {
        const filteredOrders = orders.data.filter(order => {
            return order.customer_email === req.user?.email;
        });
    
        orders.data = filteredOrders;
    } else {
        console.log("Admin user detected. Returning all orders...");
    }

    return res.status(200).json({
        success: true,
        data: orders,
        message: "Orders fetched successfully",
    });
});

export const getOrder = asyncHandler(async (req, res) => {
    const headers = await getHeaders();
    const id = req.params.id;

    try {
        const response = await axios.get(
            `https://apiv2.shiprocket.in/v1/external/orders/show/${id}`,
            headers
        );

        res.status(200).json({
            success: true,
            data: response.data,
            message: `Order ${id} fetched successfully`
        });

    } catch (err) {
        console.error("Error fetching order:", err.message || err);

        if (err.response) {
            const statusCode = err.response.status || 502;
            const message = err.response.data?.message || "Shiprocket API responded with an error";
            throw new ApiError(statusCode, message);
        } else if (err.request) {
            throw new ApiError(504, "No response from Shiprocket API (Gateway Timeout)");
        } else {
            throw new ApiError(500, `Shiprocket communication error: ${err.message}`);
        }
    }
});

export const cancelOrder = asyncHandler(async (req, res) => {
    const headers = await getHeaders(); // Must return valid Authorization headers
    const orderId = req.params.id;

    if (!orderId) {
        throw new ApiError(400, "Order ID is required for cancellation");
    }

    const payload = {
        ids: [orderId], // Shiprocket expects an array of IDs
    };

    try {
        const response = await axios.post(
            "https://apiv2.shiprocket.in/v1/external/orders/cancel",
            payload,
            headers
        );

        res.status(200).json({
            success: true,
            data: response.data,
            message: `Order ${orderId} cancelled successfully`,
        });

    } catch (err) {
        console.error("Error cancelling order:", err.message || err);

        if (err.response) {
            const statusCode = err.response.status || 502;
            const message = err.response.data?.message || "Shiprocket API responded with an error";
            throw new ApiError(statusCode, message);
        } else if (err.request) {
            throw new ApiError(504, "No response from Shiprocket API (Gateway Timeout)");
        } else {
            throw new ApiError(500, `Shiprocket communication error: ${err.message}`);
        }
    }
});






export const checkAvailabilityController = asyncHandler(async (req, res) => {
  const { pincode } = req.body;

  if (!pincode || pincode.length !== 6) {
    throw new ApiError(400, "Valid 6-digit pincode is required");
  }
   const result = await checkServiceability(pincode);
   console.log(result) // this should return { data: [...] }

   
    
   

  return res.status(200).json({
    success: true,
    data: {
      available: result.available,
      eta: result.eta || "Not specified",
      cod: result.cod || false,
    },
  });
});

