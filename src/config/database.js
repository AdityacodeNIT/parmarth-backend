import mongoose from 'mongoose';
import logger from '../utils/logger.js';

// Database configuration and optimization
export class DatabaseManager {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  async connect(uri, options = {}) {
    try {
      const defaultOptions = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,

        autoIndex: false,
        autoCreate: false,

        compressors: ['zlib'],
        zlibCompressionLevel: 6,

        ...options
      };

      this.connection = await mongoose.connect(uri, defaultOptions);
      this.isConnected = true;

      this.setupEventListeners();

      if (process.env.NODE_ENV === 'production') {
        await this.createIndexes();
      }

      logger.info('Database connected successfully', {
        host: this.connection.connection.host,
        name: this.connection.connection.name,
        readyState: this.connection.connection.readyState
      });

      return this.connection;
    } catch (error) {
      logger.error('Database connection failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  setupEventListeners() {
    const db = mongoose.connection;

    db.on('connected', () => logger.info('Mongoose connected'));
    db.on('error', err => logger.error('Mongoose error', { err }));
    db.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('Mongoose disconnected');
    });
    db.on('reconnected', () => {
      this.isConnected = true;
      logger.info('Mongoose reconnected');
    });

    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  async disconnect() {
    await mongoose.connection.close();
    this.isConnected = false;
    logger.info('Database connection closed');
  }

  async createIndexes() {
    logger.info('Creating database indexes...');
    await this.createUserIndexes();
    await this.createProductIndexes();
    await this.createOrderIndexes();
    await this.createReviewIndexes();
    await this.createAddressIndexes();
    await this.createPaymentIndexes();
    await this.createWishlistIndexes();
    logger.info('Database indexes created successfully');
  }

  /* ================= USER ================= */

  async createUserIndexes() {
    const User = mongoose.model('User');

    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ username: 1 }, { unique: true });

    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ isActive: 1 });
    await User.collection.createIndex({ createdAt: -1 });
    await User.collection.createIndex({ lastLogin: -1 });

    await User.collection.createIndex(
      { role: 1, isActive: 1, createdAt: -1 }
    );

    await User.collection.createIndex(
      { lockUntil: 1 },
      { partialFilterExpression: { lockUntil: { $exists: true } } }
    );

    await User.collection.createIndex(
      { fullName: 'text', email: 'text', username: 'text' }
    );

    logger.info('User indexes created');
  }

  /* ================= PRODUCT ================= */

  async createProductIndexes() {
    const Product = mongoose.model('Product');

    await Product.collection.createIndex({ Category: 1 });
    await Product.collection.createIndex({ seller: 1 });
    await Product.collection.createIndex({ isActive: 1 });
    await Product.collection.createIndex({ price: 1 });
    await Product.collection.createIndex({ rating: -1 });
    await Product.collection.createIndex({ salesCount: -1 });
    await Product.collection.createIndex({ createdAt: -1 });

    await Product.collection.createIndex(
      { Category: 1, isActive: 1, price: 1 }
    );

    await Product.collection.createIndex(
      { seller: 1, isActive: 1, createdAt: -1 }
    );

    await Product.collection.createIndex(
      { isActive: 1, rating: -1, salesCount: -1 }
    );

    await Product.collection.createIndex(
      {
        name: 'text',
        description: 'text',
        tags: 'text'
      },
      {
        weights: {
          name: 10,
          tags: 5,
          description: 1
        }
      }
    );

    logger.info('Product indexes created');
  }

  /* ================= ORDER ================= */

  async createOrderIndexes() {
    const Order = mongoose.model('Order');

    await Order.collection.createIndex({ userId: 1 });
    await Order.collection.createIndex({ status: 1 });
    await Order.collection.createIndex({ paymentStatus: 1 });
    await Order.collection.createIndex({ createdAt: -1 });

    // ✅ SAFE unique index
    await Order.collection.createIndex(
      { orderNumber: 1 },
      {
        unique: true,
        partialFilterExpression: {
          orderNumber: { $type: 'string' }
        }
      }
    );

    await Order.collection.createIndex(
      { userId: 1, status: 1, createdAt: -1 }
    );

    await Order.collection.createIndex(
      { status: 1, createdAt: -1 }
    );

    await Order.collection.createIndex(
      { paymentStatus: 1, createdAt: -1 }
    );

    await Order.collection.createIndex(
      { 'items.sellerId': 1, status: 1, createdAt: -1 }
    );

    logger.info('Order indexes created');
  }

  /* ================= REVIEW ================= */

  async createReviewIndexes() {
    const Review = mongoose.model('Review');

    await Review.collection.createIndex({ productId: 1 });
    await Review.collection.createIndex({ userId: 1 });
    await Review.collection.createIndex({ rating: -1 });
    await Review.collection.createIndex({ createdAt: -1 });

    await Review.collection.createIndex(
      { productId: 1, rating: -1, createdAt: -1 }
    );

    await Review.collection.createIndex(
      { userId: 1, createdAt: -1 }
    );

    // ✅ SAFE unique constraint
    await Review.collection.createIndex(
      { userId: 1, productId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          userId: { $exists: true },
          productId: { $exists: true }
        }
      }
    );

    logger.info('Review indexes created');
  }

  /* ================= ADDRESS ================= */

  async createAddressIndexes() {
    const Address = mongoose.model('Address');

    await Address.collection.createIndex({ userId: 1 });
    await Address.collection.createIndex({ isDefault: 1 });
    await Address.collection.createIndex({ country: 1 });
    await Address.collection.createIndex({ state: 1 });

    await Address.collection.createIndex(
      { userId: 1, isDefault: 1 }
    );

    logger.info('Address indexes created');
  }

  /* ================= PAYMENT ================= */

  async createPaymentIndexes() {
    const Payment = mongoose.model('Payment');

    await Payment.collection.createIndex({ userId: 1 });
    await Payment.collection.createIndex({ orderId: 1 });
    await Payment.collection.createIndex({ status: 1 });
    await Payment.collection.createIndex({ paymentMethod: 1 });
    await Payment.collection.createIndex({ createdAt: -1 });

    await Payment.collection.createIndex(
      { userId: 1, status: 1, createdAt: -1 }
    );

    await Payment.collection.createIndex(
      { orderId: 1, status: 1 }
    );

    logger.info('Payment indexes created');
  }

  /* ================= WISHLIST ================= */

  async createWishlistIndexes() {
    const Wishlist = mongoose.model('Wishlist');

    await Wishlist.collection.createIndex(
      { userId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          userId: { $exists: true }
        }
      }
    );

    await Wishlist.collection.createIndex(
      { userId: 1, 'items.productId': 1 },
      {
        unique: true,
        partialFilterExpression: {
          userId: { $exists: true },
          'items.productId': { $exists: true }
        }
      }
    );

    logger.info('Wishlist indexes created');
  }
}

export default new DatabaseManager();
