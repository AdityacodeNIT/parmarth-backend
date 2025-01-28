import axios from "axios";
import {jwtDecode}  from "jwt-decode";

const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL;
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD;


let authToken = null;

// Authenticate with Shiprocket
export const authenticate = async () => {
        try {
                const response = await axios.post(
                        "https://apiv2.shiprocket.in/v1/external/auth/login",
                        {
                                email: process.env.SHIPROCKET_EMAIL,
                                password: process.env.SHIPROCKET_PASSWORD,
                        },
                );
                authToken = response.data.token;
                console.log("Shiprocket authenticated successfully!");
        } catch (error) {
                console.error(
                        "Shiprocket authentication failed:",
                        error.response?.data,
                );
                throw new Error("Authentication failed ho gya hai broo");
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

export const getHeaders = async () => {

        const token = await getAuthToken();

        return {
                headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                },
        };
};

export const createOrder = async (orderData) => {
        console.log("Order data:", orderData);
        try {
                const response = await axios.post(
                        `${process.env.SHIPROCKET_API_BASE}/orders/create/adhoc`,
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
