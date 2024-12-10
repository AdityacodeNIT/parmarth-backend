import axios from "axios";

const SHIPROCKET_API_BASE = "https://apiv2.shiprocket.in/v1/external";
const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;

let authToken = null;

// Authenticate with Shiprocket
export const authenticate = async () => {
        try {
                const response = await axios.post(
                        `${SHIPROCKET_API_BASE}/auth/login`,
                        {
                                email: SHIPROCKET_EMAIL,
                                password: SHIPROCKET_PASSWORD,
                        },
                );
                authToken = response.data.token;
                console.log("Shiprocket authenticated successfully!");
        } catch (error) {
                console.error(
                        "Shiprocket authentication failed:",
                        error.response?.data,
                );
                throw new Error("Authentication failed");
        }
};

// Create headers for authenticated requests
export const getHeaders = () => ({
        headers: { Authorization: `Bearer ${authToken}` },
});

// Create an order
export const createOrder = async (orderData) => {
        try {
                const response = await axios.post(
                        `${SHIPROCKET_API_BASE}/orders/create/adhoc`,
                        orderData,
                        getHeaders(),
                );
                return response.data;
        } catch (error) {
                console.error(
                        "Failed to create Shiprocket order:",
                        error.response?.data,
                );
                throw new Error("Order creation failed");
        }
};
