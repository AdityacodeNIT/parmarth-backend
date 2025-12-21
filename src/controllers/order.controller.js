import orderService from '../services/orderService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

// Create order from cart
export const createOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const orderData = req.body;

  // Validate required fields
  if (!orderData.shippingAddress) {
    throw new ApiError(400, 'Shipping address is required');
  }

  if (!orderData.paymentDetails) {
    throw new ApiError(400, 'Payment details are required');
  }

  const order = await orderService.createOrderFromCart(userId, orderData);

  res.status(201).json(
    new ApiResponse(201, order, 'Order created successfully')
  );
});

// Get order by ID
export const getOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await orderService.getOrderById(orderId, userId);

  res.status(200).json(
    new ApiResponse(200, order, 'Order retrieved successfully')
  );
});

// Get user orders
export const getUserOrders = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const {
    status,
    limit = 20,
    page = 1,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const options = {
    status,
    limit: parseInt(limit),
    page: parseInt(page),
    sortBy,
    sortOrder
  };

  const result = await orderService.getUserOrders(userId, options);

  res.status(200).json(
    new ApiResponse(200, result, 'Orders retrieved successfully')
  );
});

// Get seller orders (for sellers)
export const getSellerOrders = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;
  const {
    status,
    limit = 20,
    page = 1
  } = req.query;

  const options = {
    status,
    limit: parseInt(limit),
    page: parseInt(page)
  };

  const result = await orderService.getSellerOrders(sellerId, options);

  res.status(200).json(
    new ApiResponse(200, result, 'Seller orders retrieved successfully')
  );
});

// Update order status (for sellers/admin)
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, notes = '', location = '' } = req.body;
  const updatedBy = req.user._id;

  if (!status) {
    throw new ApiError(400, 'Status is required');
  }

  const order = await orderService.updateOrderStatus(orderId, status, updatedBy, notes, location);

  res.status(200).json(
    new ApiResponse(200, order, 'Order status updated successfully')
  );
});

// Cancel order
export const cancelOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  if (!reason) {
    throw new ApiError(400, 'Cancellation reason is required');
  }

  const order = await orderService.cancelOrder(orderId, userId, reason);

  res.status(200).json(
    new ApiResponse(200, order, 'Order cancelled successfully')
  );
});

// Request return
export const requestReturn = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  if (!reason) {
    throw new ApiError(400, 'Return reason is required');
  }

  const order = await orderService.requestReturn(orderId, userId, reason);

  res.status(200).json(
    new ApiResponse(200, order, 'Return request submitted successfully')
  );
});

// Process return (for admin)
export const processReturn = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { approved, adminNotes = '' } = req.body;
  const adminId = req.user._id;

  if (typeof approved !== 'boolean') {
    throw new ApiError(400, 'Approved status is required');
  }

  const order = await orderService.processReturn(orderId, adminId, approved, adminNotes);

  res.status(200).json(
    new ApiResponse(200, order, `Return ${approved ? 'approved' : 'rejected'} successfully`)
  );
});

// Generate invoice
export const generateInvoice = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const invoiceData = await orderService.generateInvoice(orderId);

  res.status(200).json(
    new ApiResponse(200, invoiceData, 'Invoice generated successfully')
  );
});

// Get order analytics (for sellers/admin)
export const getOrderAnalytics = asyncHandler(async (req, res) => {
  const {
    startDate,
    endDate,
    sellerId
  } = req.query;

  const options = {};
  
  if (startDate) {
    options.startDate = new Date(startDate);
  }
  
  if (endDate) {
    options.endDate = new Date(endDate);
  }
  
  // If user is a seller, filter by their ID
  if (req.user.role === 'seller') {
    options.sellerId = req.user._id;
  } else if (sellerId) {
    options.sellerId = sellerId;
  }

  const analytics = await orderService.getOrderAnalytics(options);

  res.status(200).json(
    new ApiResponse(200, analytics, 'Order analytics retrieved successfully')
  );
});

// Get order tracking info
export const getOrderTracking = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await orderService.getOrderById(orderId, userId);

  const trackingInfo = {
    orderNumber: order.orderNumber,
    status: order.status,
    trackingNumber: order.trackingNumber,
    shippingProvider: order.shippingProvider,
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    actualDeliveryDate: order.actualDeliveryDate,
    statusHistory: order.statusHistory,
    shippingAddress: order.shippingAddress
  };

  res.status(200).json(
    new ApiResponse(200, trackingInfo, 'Order tracking info retrieved successfully')
  );
});

// Get order summary
export const getOrderSummary = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const order = await orderService.getOrderById(orderId, userId);
  const summary = {
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: order.totalAmount,
    itemCount: order.items.length,
    totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
    orderDate: order.createdAt,
    estimatedDelivery: order.estimatedDeliveryDate,
    canCancel: order.canBeCancelled?.() || false,
    canReturn: order.canBeReturned?.() || false
  };

  res.status(200).json(
    new ApiResponse(200, summary, 'Order summary retrieved successfully')
  );
});