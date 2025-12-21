import mongoose from 'mongoose';
import { Order } from '../models/order.model.js';
import { Product } from '../models/product.models.js';
import cartService from './cartService.js';
import logger from '../utils/logger.js';

class OrderService {
  // Create order from cart
  async createOrderFromCart(userId, orderData) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const {
        shippingAddress,
        billingAddress,
        paymentDetails,
        shippingMethod = 'standard',
        customerNotes = '',
        isGift = false,
        giftMessage = ''
      } = orderData;
      
      // Get user's cart
      const cart = await cartService.getCart(userId, null);
      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }
      
      // Validate cart items and stock
      const validationErrors = [];
      const orderItems = [];
      
      for (const cartItem of cart.items) {
        const product = await Product.findById(cartItem.productId._id).session(session);
        
        if (!product) {
          validationErrors.push(`Product ${cartItem.productId.name} not found`);
          continue;
        }
        
        if (!product.inStock || product.stocks < cartItem.quantity) {
          validationErrors.push(`Insufficient stock for ${product.name}`);
          continue;
        }
        
        // Create order item
        orderItems.push({
          productId: product._id,
          productName: product.name,
          productImage: product.ProductImage,
          quantity: cartItem.quantity,
          price: cartItem.price,
          totalPrice: cartItem.price * cartItem.quantity,
          selectedVariant: cartItem.selectedVariant || {},
          sellerId: product.seller,
          sellerName: product.sellerName || 'Unknown Seller',
          status: 'pending'
        });
        
        // Update product stock
        product.stocks -= cartItem.quantity;
        product.inStock = product.stocks > 0;
        await product.save({ session });
      }
      
      if (validationErrors.length > 0) {
        throw new Error(`Order validation failed: ${validationErrors.join(', ')}`);
      }
      
      // Calculate estimated delivery date
      const estimatedDeliveryDate = this.calculateEstimatedDelivery(shippingMethod, shippingAddress);
      
      // Create order
      const order = new Order({
        userId,
        items: orderItems,
        subtotal: cart.totalAmount,
        discountAmount: cart.discountAmount || 0,
        discountCode: cart.discountCode,
        shippingCost: cart.shippingCost || 0,
        taxAmount: cart.taxAmount || 0,
        totalAmount: cart.finalAmount,
        shippingAddress,
        billingAddress: billingAddress || shippingAddress,
        shippingMethod,
        estimatedDeliveryDate,
        paymentDetails,
        customerNotes,
        isGift,
        giftMessage,
        orderSource: 'web'
      });
      
      await order.save({ session });
      
      // Clear user's cart
      await cartService.clearCart(userId, null);
      
      await session.commitTransaction();
      
      // Track order creation
      try {
        const { default: userInteractionService } = await import('./userInteractionService.js');
        for (const item of orderItems) {
          await userInteractionService.trackInteraction({
            userId,
            sessionId: `order_${order._id}`,
            productId: item.productId,
            interactionType: 'purchase',
            metadata: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              quantity: item.quantity,
              price: item.price
            }
          });
        }
      } catch (error) {
        logger.warn('Failed to track order interactions:', error);
      }
      
      return await this.getOrderById(order._id, userId);
      
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to create order:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Get order by ID
  async getOrderById(orderId, userId = null) {
    try {
      const query = { _id: orderId };
      if (userId) {
        query.userId = userId;
      }
      
      const order = await Order.findOne(query)
        .populate('userId', 'fullName email phoneNumber')
        .populate('items.productId', 'name ProductImage Category rating reviewCount')
        .populate('items.sellerId', 'fullName businessName')
        .lean();
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      return order;
    } catch (error) {
      logger.error('Failed to get order:', error);
      throw error;
    }
  }
  
  // Get orders by user
  async getUserOrders(userId, options = {}) {
    try {
      const {
        status,
        limit = 20,
        page = 1,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;
      
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
      
      const query = { userId };
      if (status) {
        query.status = status;
      }
      
      const [orders, total] = await Promise.all([
        Order.find(query)
          .sort(sort)
          .limit(limit)
          .skip(skip)
          .populate('items.productId', 'name ProductImage Category')
          .lean(),
        Order.countDocuments(query)
      ]);
      
      return {
        orders,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Failed to get user orders:', error);
      throw error;
    }
  }
  
  // Get orders by seller
  async getSellerOrders(sellerId, options = {}) {
    try {
      const {
        status,
        limit = 20,
        page = 1
      } = options;
      
      const skip = (page - 1) * limit;
      
      const query = { 'items.sellerId': sellerId };
      if (status) {
        query.status = status;
      }
      
      const [orders, total] = await Promise.all([
        Order.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .populate('userId', 'fullName email phoneNumber')
          .populate('items.productId', 'name ProductImage Category')
          .lean(),
        Order.countDocuments(query)
      ]);
      
      return {
        orders,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Failed to get seller orders:', error);
      throw error;
    }
  }
  
  // Update order status
  async updateOrderStatus(orderId, newStatus, updatedBy, notes = '', location = '') {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }
      
      // Validate status transition
      if (!this.isValidStatusTransition(order.status, newStatus)) {
        throw new Error(`Invalid status transition from ${order.status} to ${newStatus}`);
      }
      
      order.updateStatus(newStatus, updatedBy, notes, location);
      
      // Generate tracking number for shipped orders
      if (newStatus === 'shipped' && !order.trackingNumber) {
        order.trackingNumber = this.generateTrackingNumber();
        order.shippingProvider = 'BlueDart'; // Default provider
      }
      
      await order.save();
      
      // Send notifications
      await this.sendOrderStatusNotification(order);
      
      return await this.getOrderById(orderId);
    } catch (error) {
      logger.error('Failed to update order status:', error);
      throw error;
    }
  }
  
  // Cancel order
  async cancelOrder(orderId, userId, reason) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const order = await Order.findOne({ _id: orderId, userId }).session(session);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (!order.canBeCancelled()) {
        throw new Error('Order cannot be cancelled at this stage');
      }
      
      // Restore product stock
      for (const item of order.items) {
        const product = await Product.findById(item.productId).session(session);
        if (product) {
          product.stocks += item.quantity;
          product.inStock = true;
          await product.save({ session });
        }
      }
      
      // Update order
      order.status = 'cancelled';
      order.cancellationReason = reason;
      order.cancelledBy = userId;
      order.cancelledAt = new Date();
      
      order.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        updatedBy: userId,
        notes: `Order cancelled by customer. Reason: ${reason}`
      });
      
      await order.save({ session });
      
      // Process refund if payment was completed
      if (order.paymentDetails.status === 'completed') {
        await this.processRefund(order, order.totalAmount, 'Order cancellation');
      }
      
      await session.commitTransaction();
      
      // Send notification
      await this.sendOrderStatusNotification(order);
      
      return await this.getOrderById(orderId, userId);
      
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to cancel order:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Request return
  async requestReturn(orderId, userId, reason) {
    try {
      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (!order.canBeReturned()) {
        throw new Error('Order cannot be returned');
      }
      
      order.returnStatus = 'requested';
      order.returnReason = reason;
      order.returnRequestedAt = new Date();
      
      order.statusHistory.push({
        status: 'return_requested',
        timestamp: new Date(),
        updatedBy: userId,
        notes: `Return requested. Reason: ${reason}`
      });
      
      await order.save();
      
      // Notify admin/seller about return request
      await this.sendReturnRequestNotification(order);
      
      return await this.getOrderById(orderId, userId);
    } catch (error) {
      logger.error('Failed to request return:', error);
      throw error;
    }
  }
  
  // Process return
  async processReturn(orderId, adminId, approved, adminNotes = '') {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.returnStatus !== 'requested') {
        throw new Error('No return request found for this order');
      }
      
      if (approved) {
        order.returnStatus = 'approved';
        order.status = 'returned';
        order.returnCompletedAt = new Date();
        
        // Restore product stock
        for (const item of order.items) {
          const product = await Product.findById(item.productId).session(session);
          if (product) {
            product.stocks += item.quantity;
            product.inStock = true;
            await product.save({ session });
          }
        }
        
        // Process refund
        const refundAmount = order.calculateRefundAmount();
        await this.processRefund(order, refundAmount, 'Product return');
        
      } else {
        order.returnStatus = 'rejected';
      }
      
      order.adminNotes = adminNotes;
      order.statusHistory.push({
        status: approved ? 'return_approved' : 'return_rejected',
        timestamp: new Date(),
        updatedBy: adminId,
        notes: adminNotes
      });
      
      await order.save({ session });
      await session.commitTransaction();
      
      // Send notification
      await this.sendReturnStatusNotification(order);
      
      return await this.getOrderById(orderId);
      
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to process return:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  // Process refund
  async processRefund(order, amount, reason) {
    try {
      // Update payment details
      order.paymentDetails.refundedAmount += amount;
      order.paymentDetails.refundDate = new Date();
      
      if (order.paymentDetails.refundedAmount >= order.paymentDetails.paidAmount) {
        order.paymentDetails.status = 'refunded';
      } else {
        order.paymentDetails.status = 'partially_refunded';
      }
      
      // Add to status history
      order.statusHistory.push({
        status: 'refund_processed',
        timestamp: new Date(),
        notes: `Refund of ₹${amount} processed. Reason: ${reason}`
      });
      
      await order.save();
      
      // Here you would integrate with actual payment gateway for refund
      logger.info(`Refund processed for order ${order.orderNumber}: ₹${amount}`);
      
      return { success: true, refundAmount: amount };
    } catch (error) {
      logger.error('Failed to process refund:', error);
      throw error;
    }
  }
  
  // Generate invoice
  async generateInvoice(orderId) {
    try {
      const order = await Order.findById(orderId)
        .populate('userId', 'fullName email phoneNumber')
        .populate('items.productId', 'name Category')
        .lean();
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (!order.invoiceNumber) {
        const orderDoc = await Order.findById(orderId);
        orderDoc.invoiceNumber = orderDoc.generateInvoiceNumber();
        orderDoc.invoiceDate = new Date();
        await orderDoc.save();
        order.invoiceNumber = orderDoc.invoiceNumber;
        order.invoiceDate = orderDoc.invoiceDate;
      }
      
      // Generate invoice data
      const invoiceData = {
        invoiceNumber: order.invoiceNumber,
        invoiceDate: order.invoiceDate,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        customer: {
          name: order.userId.fullName,
          email: order.userId.email,
          phone: order.userId.phoneNumber
        },
        billingAddress: order.billingAddress,
        shippingAddress: order.shippingAddress,
        items: order.items.map(item => ({
          name: item.productName,
          quantity: item.quantity,
          price: item.price,
          total: item.totalPrice
        })),
        subtotal: order.subtotal,
        discount: order.discountAmount,
        shipping: order.shippingCost,
        tax: order.taxAmount,
        total: order.totalAmount,
        paymentMethod: order.paymentDetails.method,
        paymentStatus: order.paymentDetails.status
      };
      
      return invoiceData;
    } catch (error) {
      logger.error('Failed to generate invoice:', error);
      throw error;
    }
  }
  
  // Get order analytics
  async getOrderAnalytics(options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        sellerId
      } = options;
      
      const matchStage = {
        createdAt: { $gte: startDate, $lte: endDate }
      };
      
      if (sellerId) {
        matchStage['items.sellerId'] = sellerId;
      }
      
      const [stats] = await Order.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: '$totalAmount' },
            avgOrderValue: { $avg: '$totalAmount' },
            totalItems: { $sum: { $size: '$items' } },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            confirmedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
            },
            shippedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'shipped'] }, 1, 0] }
            },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            returnedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] }
            }
          }
        }
      ]);
      
      return stats || {
        totalOrders: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
        totalItems: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        returnedOrders: 0
      };
    } catch (error) {
      logger.error('Failed to get order analytics:', error);
      throw error;
    }
  }
  
  // Helper methods
  calculateEstimatedDelivery(shippingMethod, address) {
    const baseDate = new Date();
    let deliveryDays = 7; // Default
    
    switch (shippingMethod) {
      case 'express':
        deliveryDays = 3;
        break;
      case 'overnight':
        deliveryDays = 1;
        break;
      case 'standard':
      default:
        deliveryDays = 7;
        break;
    }
    
    // Add extra days for remote locations
    const remotePincodes = ['110001', '400001']; // Example
    if (remotePincodes.includes(address.pincode)) {
      deliveryDays += 2;
    }
    
    baseDate.setDate(baseDate.getDate() + deliveryDays);
    return baseDate;
  }
  
  generateTrackingNumber() {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `TRK${timestamp.slice(-8)}${random}`;
  }
  
  isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['delivered', 'cancelled'],
      'delivered': ['returned'],
      'cancelled': [],
      'returned': ['refunded'],
      'refunded': []
    };
    
    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
  
  async sendOrderStatusNotification(order) {
    try {
      // Here you would integrate with notification service
      logger.info(`Order status notification sent for order ${order.orderNumber}: ${order.status}`);
    } catch (error) {
      logger.warn('Failed to send order status notification:', error);
    }
  }
  
  async sendReturnRequestNotification(order) {
    try {
      // Here you would integrate with notification service
      logger.info(`Return request notification sent for order ${order.orderNumber}`);
    } catch (error) {
      logger.warn('Failed to send return request notification:', error);
    }
  }
  
  async sendReturnStatusNotification(order) {
    try {
      // Here you would integrate with notification service
      logger.info(`Return status notification sent for order ${order.orderNumber}: ${order.returnStatus}`);
    } catch (error) {
      logger.warn('Failed to send return status notification:', error);
    }
  }
}

export default new OrderService();