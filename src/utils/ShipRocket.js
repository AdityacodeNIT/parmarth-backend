import axios from "axios";
import {jwtDecode}  from "jwt-decode";




let authToken = null;

export const authenticate = async () => {
        try {
                const response = await axios.post(
                        "https://apiv2.shiprocket.in/v1/external/auth/login",
                        {
                                email: process.env.SHIPROCKET_EMAIL,
                                password: process.env.SHIPROCKET_PASSWORD,
                        },
                       { headers: {
                                'Content-Type': 'application/json',
                              },
                        }
                );
               
                authToken = response.data?.token;
              
             
        } catch (error) {
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

export const createOrder = async (orders) => {
        try {
          
            const responses = await Promise.all(
                Object.values(orders).map(async (orderData) => {
                    
                try {
                        
                            const response = await axios.post(
                                `https://apiv2.shiprocket.in/v1/external/orders/create/adhoc`,
                                orderData,
                                await getHeaders()
                            );
        
                          
                            return response.data;
                }
                   

                    catch (error) {
                        console.error("API Request Failed:", error.response?.data || error.message);
                    }
                })
            );
            return responses;
        } catch (error) {
            throw new Error("Bulk order creation failed");
        }
    };
    

/**
 * Checks if delivery is available to the given pincode using Shiprocket's serviceability API.
 *
 * @param {string} deliveryPincode - The destination pincode to check.
 * @param {number} cod - Set to 1 to check for COD availability, 0 for prepaid (default: 0).
 * @param {number} weight - The weight of the package in kg (default: 1).
 * @param {string} pickupPincode - Your warehouse or origin pincode (default: "110030").
 *
 * @returns {Promise<{ available: boolean, eta: string | null, cod: boolean, couriers: Array }>}
 */
export const checkServiceability = async (
  deliveryPincode,
  cod =1,
  weight = 1,
  pickupPincode = "796012"
) => {
  const headers = await getHeaders(); // Includes Authorization token

  const url = `https://apiv2.shiprocket.in/v1/external/courier/serviceability?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&cod=${cod}&weight=${weight}`;

  try {
    const response = await axios.get(url, headers);
    const couriers = response.data?.data?.available_courier_companies || [];

    return {
      available: couriers.length > 0,
      eta: couriers[0]?.etd || null,
      cod: couriers.some((c) => c.cod === 1),
      couriers,
    };
  } catch (error) {
    console.error("Shiprocket serviceability check failed:", error.message);
    return {
      available: false,
      eta: null,
      cod: false,
      couriers: [],
    };
  }
};



