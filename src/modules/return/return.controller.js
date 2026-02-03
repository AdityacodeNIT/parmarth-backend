import { Return } from './return.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { getHeaders } from '../../utils/ShipRocket.js';
import axios from 'axios';

/**
 * Create a return request
 * POST /api/v1/returns/create
 */
export const createReturnRequest = asyncHandler(async (req, res) => {
  const {
    orderId,
    shiprocketOrderId,
    items,
    returnReason,
    returnDescription,
    images,
    pickupAddress,
  } = req.body;

  // Validation
  if (!orderId || !shiprocketOrderId || !items || items.length === 0) {
    throw new ApiError(400, 'Order ID, Shiprocket Order ID, and items are required');
  }

  if (!returnReason || !returnDescription) {
    throw new ApiError(400, 'Return reason and description are required');
  }

  // Check if return already exists for this order
  const existingReturn = await Return.findOne({
    orderId,
    userId: req.user._id,
    status: { $nin: ['CANCELLED', 'REFUND_COMPLETED'] },
  });

  if (existingReturn) {
    throw new ApiError(400, 'A return request already exists for this order');
  }

  // Calculate return eligible date (7 days from now as default)
  const returnEligibleUntil = new Date();
  returnEligibleUntil.setDate(returnEligibleUntil.getDate() + 7);

  // Create return request
  const returnRequest = await Return.create({
    orderId,
    shiprocketOrderId,
    userId: req.user._id,
    userEmail: req.user.email,
    userName: req.user.fullName || req.user.username,
    items,
    returnReason,
    returnDescription,
    images: images || [],
    pickupAddress,
    returnEligibleUntil,
    status: 'REQUESTED',
    timeline: [
      {
        status: 'REQUESTED',
        notes: 'Return request created by customer',
        updatedBy: req.user._id,
      },
    ],
  });

  res.status(201).json(
    new ApiResponse(201, returnRequest, 'Return request created successfully')
  );
});

/**
 * Get all returns for a user
 * GET /api/v1/returns/my-returns
 */
export const getMyReturns = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const query = { userId: req.user._id };
  if (status) {
    query.status = status;
  }

  const returns = await Return.find(query)
    .populate('items.productId', 'name ProductImage price')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Return.countDocuments(query);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        returns,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
      'Returns fetched successfully'
    )
  );
});

/**
 * Get return by ID
 * GET /api/v1/returns/:id
 */
export const getReturnById = asyncHandler(async (req, res) => {
  const returnRequest = await Return.findById(req.params.id)
    .populate('items.productId', 'name ProductImage price')
    .populate('adminReview.reviewedBy', 'fullName email')
    .populate('inspection.inspectedBy', 'fullName email');

  if (!returnRequest) {
    throw new ApiError(404, 'Return request not found');
  }

  // Check if user owns this return or is admin
  if (
    returnRequest.userId.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    throw new ApiError(403, 'You do not have permission to view this return');
  }

  res.status(200).json(
    new ApiResponse(200, returnRequest, 'Return details fetched successfully')
  );
});

/**
 * Approve return request (Admin only)
 * POST /api/v1/returns/:id/approve
 */
export const approveReturn = asyncHandler(async (req, res) => {
  const { notes } = req.body;
  const returnRequest = await Return.findById(req.params.id);

  if (!returnRequest) {
    throw new ApiError(404, 'Return request not found');
  }

  if (returnRequest.status !== 'REQUESTED') {
    throw new ApiError(400, 'Return request cannot be approved in current status');
  }

  // Update return request
  returnRequest.adminReview = {
    reviewedBy: req.user._id,
    reviewedAt: new Date(),
    decision: 'APPROVED',
    notes: notes || 'Return approved by admin',
  };

  await returnRequest.addTimelineEntry(
    'APPROVED',
    notes || 'Return approved by admin',
    req.user._id
  );

  res.status(200).json(
    new ApiResponse(200, returnRequest, 'Return request approved successfully')
  );
});

/**
 * Reject return request (Admin only)
 * POST /api/v1/returns/:id/reject
 */
export const rejectReturn = asyncHandler(async (req, res) => {
  const { notes } = req.body;

  if (!notes) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const returnRequest = await Return.findById(req.params.id);

  if (!returnRequest) {
    throw new ApiError(404, 'Return request not found');
  }

  if (returnRequest.status !== 'REQUESTED') {
    throw new ApiError(400, 'Return request cannot be rejected in current status');
  }

  returnRequest.adminReview = {
    reviewedBy: req.user._id,
    reviewedAt: new Date(),
    decision: 'REJECTED',
    notes,
  };

  await returnRequest.addTimelineEntry('REJECTED', notes, req.user._id);

  res.status(200).json(
    new ApiResponse(200, returnRequest, 'Return request rejected')
  );
});

/**
 * Schedule pickup with Shiprocket
 * POST /api/v1/returns/:id/schedule-pickup
 */
export const schedulePickup = asyncHandler(async (req, res) => {
  const returnRequest = await Return.findById(req.params.id);

  if (!returnRequest) {
    throw new ApiError(404, 'Return request not found');
  }

  if (returnRequest.status !== 'APPROVED') {
    throw new ApiError(400, 'Return must be approved before scheduling pickup');
  }

  // Create return order in Shiprocket
  const headers = await getHeaders();
  
  const shiprocketPayload = {
    order_id: returnRequest.shiprocketOrderId,
    order_date: new Date().toISOString(),
    pickup_customer_name: returnRequest.pickupAddress.name,
    pickup_last_name: '',
    pickup_address: returnRequest.pickupAddress.address,
    pickup_city: returnRequest.pickupAddress.city,
    pickup_state: returnRequest.pickupAddress.state,
    pickup_pincode: returnRequest.pickupAddress.pincode,
    pickup_phone: returnRequest.pickupAddress.phone,
    pickup_email: returnRequest.userEmail,
  };

  try {
    const response = await axios.post(
      'https://apiv2.shiprocket.in/v1/external/orders/create/return',
      shiprocketPayload,
      headers
    );

    returnRequest.shiprocketReturnId = response.data.order_id;
    returnRequest.shiprocketAwbCode = response.data.awb_code;
    returnRequest.pickupScheduledDate = new Date();

    await returnRequest.addTimelineEntry(
      'PICKUP_SCHEDULED',
      'Pickup scheduled with Shiprocket',
      req.user._id
    );

    res.status(200).json(
      new ApiResponse(200, returnRequest, 'Pickup scheduled successfully')
    );
  } catch (error) {
    console.error('Shiprocket pickup scheduling failed:', error.response?.data || error.message);
    throw new ApiError(500, 'Failed to schedule pickup with Shiprocket');
  }
});

/**
 * Update return status
 * PATCH /api/v1/returns/:id/status
 */
export const updateReturnStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;

  if (!status) {
    throw new ApiError(400, 'Status is required');
  }

  const returnRequest = await Return.findById(req.params.id);

  if (!returnRequest) {
    throw new ApiError(404, 'Return request not found');
  }

  await returnRequest.addTimelineEntry(status, notes || '', req.user._id);

  res.status(200).json(
    new ApiResponse(200, returnRequest, 'Return status updated successfully')
  );
});

/**
 * Inspect returned product (Admin only)
 * POST /api/v1/returns/:id/inspect
 */
export const inspectReturn = asyncHandler(async (req, res) => {
  const { condition, notes, images } = req.body;

  if (!condition) {
    throw new ApiError(400, 'Product condition is required');
  }

  const returnRequest = await Return.findById(req.params.id);

  if (!returnRequest) {
    throw new ApiError(404, 'Return request not found');
  }

  if (returnRequest.status !== 'RECEIVED') {
    throw new ApiError(400, 'Product must be received before inspection');
  }

  returnRequest.inspection = {
    inspectedBy: req.user._id,
    inspectedAt: new Date(),
    condition,
    notes: notes || '',
    images: images || [],
  };

  await returnRequest.addTimelineEntry(
    'INSPECTED',
    `Product inspected - Condition: ${condition}`,
    req.user._id
  );

  res.status(200).json(
    new ApiResponse(200, returnRequest, 'Product inspected successfully')
  );
});

/**
 * Initiate refund
 * POST /api/v1/returns/:id/refund
 */
export const initiateRefund = asyncHandler(async (req, res) => {
  const { amount, method } = req.body;

  if (!amount || !method) {
    throw new ApiError(400, 'Refund amount and method are required');
  }

  const returnRequest = await Return.findById(req.params.id);

  if (!returnRequest) {
    throw new ApiError(404, 'Return request not found');
  }

  if (returnRequest.status !== 'INSPECTED') {
    throw new ApiError(400, 'Product must be inspected before refund');
  }

  returnRequest.refund = {
    amount,
    method,
    status: 'PROCESSING',
    processedAt: new Date(),
  };

  await returnRequest.addTimelineEntry(
    'REFUND_INITIATED',
    `Refund of ₹${amount} initiated via ${method}`,
    req.user._id
  );

  res.status(200).json(
    new ApiResponse(200, returnRequest, 'Refund initiated successfully')
  );
});

/**
 * Complete refund
 * POST /api/v1/returns/:id/refund/complete
 */
export const completeRefund = asyncHandler(async (req, res) => {
  const { transactionId } = req.body;

  const returnRequest = await Return.findById(req.params.id);

  if (!returnRequest) {
    throw new ApiError(404, 'Return request not found');
  }

  if (returnRequest.status !== 'REFUND_INITIATED') {
    throw new ApiError(400, 'Refund must be initiated first');
  }

  returnRequest.refund.status = 'COMPLETED';
  returnRequest.refund.transactionId = transactionId;
  returnRequest.refund.completedAt = new Date();

  await returnRequest.addTimelineEntry(
    'REFUND_COMPLETED',
    `Refund completed - Transaction ID: ${transactionId}`,
    req.user._id
  );

  res.status(200).json(
    new ApiResponse(200, returnRequest, 'Refund completed successfully')
  );
});

/**
 * Cancel return request
 * POST /api/v1/returns/:id/cancel
 */
export const cancelReturn = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  if (!reason) {
    throw new ApiError(400, 'Cancellation reason is required');
  }

  const returnRequest = await Return.findById(req.params.id);

  if (!returnRequest) {
    throw new ApiError(404, 'Return request not found');
  }

  if (!returnRequest.canBeCancelled()) {
    throw new ApiError(400, 'Return cannot be cancelled in current status');
  }

  // Check if user owns this return
  if (returnRequest.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You can only cancel your own returns');
  }

  returnRequest.cancellationReason = reason;
  returnRequest.cancelledBy = req.user._id;
  returnRequest.cancelledAt = new Date();

  await returnRequest.addTimelineEntry('CANCELLED', reason, req.user._id);

  res.status(200).json(
    new ApiResponse(200, returnRequest, 'Return cancelled successfully')
  );
});

/**
 * Get all returns (Admin only)
 * GET /api/v1/returns/admin/all
 */
export const getAllReturns = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const query = {};
  if (status) {
    query.status = status;
  }

  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const returns = await Return.find(query)
    .populate('userId', 'fullName email username')
    .populate('items.productId', 'name ProductImage price')
    .sort(sort)
    .limit(parseInt(limit))
    .skip((parseInt(page) - 1) * parseInt(limit));

  const total = await Return.countDocuments(query);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        returns,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
      'All returns fetched successfully'
    )
  );
});

/**
 * Get return statistics (Admin only)
 * GET /api/v1/returns/admin/stats
 */
export const getReturnStats = asyncHandler(async (req, res) => {
  const stats = await Return.getReturnStats();

  const totalReturns = await Return.countDocuments();
  const pendingReturns = await Return.countDocuments({ status: 'REQUESTED' });
  const approvedReturns = await Return.countDocuments({ status: 'APPROVED' });
  const completedReturns = await Return.countDocuments({ status: 'REFUND_COMPLETED' });

  const totalRefundAmount = await Return.aggregate([
    { $match: { 'refund.status': 'COMPLETED' } },
    { $group: { _id: null, total: { $sum: '$refund.amount' } } },
  ]);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        totalReturns,
        pendingReturns,
        approvedReturns,
        completedReturns,
        totalRefundAmount: totalRefundAmount[0]?.total || 0,
        statusBreakdown: stats,
      },
      'Return statistics fetched successfully'
    )
  );
});
