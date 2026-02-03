import { authenticate, getHeaders, createOrder, checkServiceability } from '../../utils/ShipRocket.js';
import { Product } from '../product/product.models.js';
import { Address } from '../address/address.models.js';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';

const generateSKU = name => {
  return (
    name
      .toLowerCase() // Convert to lowercase
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/[^a-z0-9_]/g, '') // Remove special characters
      .slice(0, 15) +
    '_' +
    Math.floor(1000 + Math.random() * 9000)
  ); // Add random 4-digit number
};

// Authentication
authenticate().catch(err => console.error(err.message));

export const createOrderController = asyncHandler(async (req, res) => {

  const { items, paymentMethod } = req.body;

  console.log('=== CREATE ORDER REQUEST ===');
  console.log('Payment Method:', paymentMethod);
  console.log('Items:', items);
  console.log('User:', req.user?.username, req.user?.email);

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const orders = [];
  const groupedOrders = {};

 // Cache to avoid redundant DB queries
const addressCache = {};

// Step 1: Fetch all products in parallel
const productIds = items.map(item => item.productId);
const products = await Product.find({ _id: { $in: productIds } });

// Step 2: Map products for quick lookup
const productMap = new Map(products.map(product => [product._id.toString(), product]));

// Step 3: Iterate items efficiently
for (const item of items) {
  const { productId, quantity, Address_id } = item;

  // Get product from cache
  const product = productMap.get(productId.toString());
  if (!product) {
    throw new ApiError(404, `Product with ID ${productId} not found`);
  }

  // Increment bought count (fire-and-forget for performance)
  Product.updateOne({ _id: productId }, { $inc: { bought: 1 } }).catch(err => {
    console.error(`Failed to increment bought for ${productId}`, err);
  });

  // Fetch or reuse address
  if (!addressCache[Address_id]) {
    const address = await Address.findById(Address_id);
    if (!address) throw new ApiError(404, `Address with ID ${Address_id} not found`);

    const isAvailable = await checkServiceability(address.postalCode);
    if (!isAvailable) {
      throw new ApiError(400, `Delivery unavailable for pincode ${address.postalCode}`);
    }

    addressCache[Address_id] = address;

    // Initialize group entry
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
      length: 10,
      breadth: 10,
      height: 10,
      weight: 1
    };
  }

  // Step 4: Add item to grouped order
  groupedOrders[Address_id].order_items.push({
    name: product.name,
    sku: generateSKU(product.name),
    units: quantity,
    selling_price: product.price,
    discount: 0,
    tax: product.price * 0.18
  });

  groupedOrders[Address_id].sub_total += product.price * quantity;
}

  console.log('=== GROUPED ORDERS TO SEND TO SHIPROCKET ===');
  console.log(JSON.stringify(groupedOrders, null, 2));

  const result = await createOrder(groupedOrders);

  console.log('=== SHIPROCKET RESPONSE ===');
  console.log(JSON.stringify(result, null, 2));

  res.status(201).json({
    data: result,
    message: 'Order created successfully'
  });
});

export const getAllOrdersController = asyncHandler(async (req, res) => {
  
  if (!req.user) {
    console.error('User not authenticated');
    throw new ApiError(401, 'User not authenticated');
  }

  console.log('=== GET ALL ORDERS REQUEST ===');
  console.log('User:', req.user.username, req.user.email);
  console.log('Role:', req.user.role);

  const headers = await getHeaders();
  let orders;

  try {
    // --- Added: Role-based URL selection ---
    let url = 'https://apiv2.shiprocket.in/v1/external/orders';
    if (req.user.role === 'customer') {
      // Add email as filter for customer role
      url += `?email=${encodeURIComponent(req.user.email)}`;
      console.log('Customer role - filtering by email:', req.user.email);
    } else {
      console.log('Admin role - fetching all orders');
    }

    console.log('Fetching from URL:', url);
    const response = await axios.get(url, headers);
    console.log('Shiprocket response status:', response.status);
    console.log('Number of orders received:', response.data?.data?.length || 0);

    orders = response.data;
  } catch (shiprocketError) {
    console.error('Error fetching orders from Shiprocket:', shiprocketError);

    if (shiprocketError.response) {
      const statusCode = shiprocketError.response.status || 502;
      const shiprocketMessage =
        shiprocketError.response.data.message || 'Error from Shiprocket API';

      return res.status(statusCode).json({
        success: false,
        error: `Shiprocket API error: ${shiprocketMessage}`
      });
    } else if (shiprocketError.request) {
      return res.status(504).json({
        success: false,
        error: 'No response from Shiprocket API (Gateway Timeout)'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: `Error communicating with Shiprocket API: ${shiprocketError.message}`
      });
    }
  }

  if (!orders.data || !Array.isArray(orders.data)) {
    return res.status(500).json({
      success: false,
      error: 'Invalid response from Shiprocket API'
    });
  }

  // --- Keep role-based filtering as a safety net ---
  if (req.user.role === 'customer') {
    const beforeFilter = orders.data.length;
    const filteredOrders = orders.data.filter(order => {
      const matches = order.customer_email === req.user?.email;
      if (!matches) {
        console.log('Filtering out order:', order.id, 'email:', order.customer_email);
      }
      return matches;
    });
    orders.data = filteredOrders;
    console.log(`Filtered orders: ${beforeFilter} -> ${filteredOrders.length}`);
  } else {
    console.log('Admin user detected. Returning all orders...');
  }

  console.log('=== FINAL ORDERS TO RETURN ===');
  console.log('Total orders:', orders.data.length);
  if (orders.data.length > 0) {
    console.log('Sample order:', {
      id: orders.data[0].id,
      status: orders.data[0].status,
      payment_method: orders.data[0].payment_method,
      customer_email: orders.data[0].customer_email,
    });
  }

  return res.status(200).json({
    success: true,
    data: orders,
    message: 'Orders fetched successfully'
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
    console.error('Error fetching order:', err.message || err);

    if (err.response) {
      const statusCode = err.response.status || 502;
      const message = err.response.data?.message || 'Shiprocket API responded with an error';
      throw new ApiError(statusCode, message);
    } else if (err.request) {
      throw new ApiError(504, 'No response from Shiprocket API (Gateway Timeout)');
    } else {
      throw new ApiError(500, `Shiprocket communication error: ${err.message}`);
    }
  }
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const headers = await getHeaders(); // Must return valid Authorization headers
  const orderId = req.params.id;

  console.log('=== CANCEL ORDER REQUEST ===');
  console.log('Order ID:', orderId);
  console.log('User:', req.user?.username, req.user?.email);

  if (!orderId) {
    throw new ApiError(400, 'Order ID is required for cancellation');
  }

  const payload = {
    ids: [orderId] // Shiprocket expects an array of IDs
  };

  console.log('Sending cancel request to Shiprocket:', payload);

  try {
    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/orders/cancel',
      payload,
      headers
    );

    console.log('=== SHIPROCKET CANCEL RESPONSE ===');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    res.status(200).json({
      success: true,
      data: response.data,
      message: `Order ${orderId} cancelled successfully`
    });
  } catch (err) {
    console.error('=== CANCEL ORDER ERROR ===');
    console.error('Error message:', err.message);
    console.error('Response status:', err.response?.status);
    console.error('Response data:', err.response?.data);

    if (err.response) {
      const statusCode = err.response.status || 502;
      const message = err.response.data?.message || 'Shiprocket API responded with an error';
      throw new ApiError(statusCode, message);
    } else if (err.request) {
      throw new ApiError(504, 'No response from Shiprocket API (Gateway Timeout)');
    } else {
      throw new ApiError(500, `Shiprocket communication error: ${err.message}`);
    }
  }
});

export const checkAvailabilityController = asyncHandler(async (req, res) => {
  const { pincode } = req.body;

  if (!pincode || pincode.length !== 6) {
    throw new ApiError(400, 'Valid 6-digit pincode is required');
  }

  const result = await checkServiceability(pincode);

  // result.couriers is where the courier options are listed
  const couriers = result?.couriers || [];

  // Select the best one (for now, let's pick the cheapest as example)
  const bestCourier = couriers.reduce((min, curr) => {
    return curr.freight_charge < min.freight_charge ? curr : min;
  }, couriers[0]);

  return res.status(200).json({
    success: true,
    data: {
      available: result.available,
      eta: result.eta || 'Not specified',
      cod: result.cod || false,
      deliveryCharge: bestCourier?.freight_charge ?? null,
      courierName: bestCourier?.courier_name ?? null,
      estimatedDays: bestCourier?.estimated_delivery_days ?? null
    }
  });
});
