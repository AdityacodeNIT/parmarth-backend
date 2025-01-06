import axios from "axios";

const SHIPROCKET_API_BASE = "https://apiv2.shiprocket.in/v1/external";
const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;
import { jwtDecode } from "jwt-decode";

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

const getAuthToken = async () => {
        if (!authToken || isTokenExpired(authToken)) {
                await authenticate(); // Re-authenticate if the token is missing or expired
        }
        return authToken; // Return the valid token
};

const isTokenExpired = (token) => {
        const { exp } = jwtDecode(token);
        const currentTime = Math.floor(Date.now() / 1000);
        return exp < currentTime;
};

// Use this function in other requests:
export const getHeaders = async () => {
        const token = await getAuthToken();
        return {
                headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}}`,
                },
        };
};

// Create headers

// Create an order
export const createOrder = async (orderData) => {
        console.log("Order data:", orderData);
        try {
                const response = await axios.post(
                        `${SHIPROCKET_API_BASE}/orders/create/adhoc`,
                        orderData,
                        await getHeaders(),
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
