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
        // Connection pool settings
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000, // How long to try selecting a server
        socketTimeoutMS: 45000, // How long a send or receive on a socket can take
        
   
        
        // Other optimizations
        autoIndex: false, // Disable auto index creation
        autoCreate: false, // Disable auto collection creation
        
        // Compression
        compressors: ['zlib'],
        zlibCompressionLevel: 6,
        
        ...options
      };

      this.connection = await mongoose.connect(uri, defaultOptions);
      this.isConnected = true;

      // Set up connection event listeners
      this.setupEventListeners();

      // Create indexes in production
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

    db.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
    });

    db.on('error', (error) => {
      logger.error('Mongoose connection error', { error: error.message });
    });

    db.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
      this.isConnected = false;
    });

    db.on('reconnected', () => {
      logger.info('Mongoose reconnected to MongoDB');
      this.isConnected = true;
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  async disconnect() {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection', { error: error.message });
    }
  }

  async createIndexes() {
    try {
      logger.info('Creating database indexes...');

      // User collection indexes
      await this.createUserIndexes();
      
      // Product collection indexes
      await this.createProductIndexes();
      
      // Order collection indexes
      await this.createOrderIndexes();
      
      // Review collection indexes
      await this.createReviewIndexes();
      
      // Address collection indexes
      await this.createAddressIndexes();
      
      // Payment collection indexes
      await this.createPaymentIndexes();
      
      // Wishlist collection indexes
      await this.createWishlistIndexes();

      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.error('Error creating database indexes', { error: error.message });
      throw error;
    }
  }

  async createUserIndexes() {
    const User = mongoose.model('User');
    
    // Unique indexes
    await User.collection.createIndex({ email: 1 }, { unique: true, background: true });
    await User.collection.createIndex({ username: 1 }, { unique: true, background: true });
    
    // Query optimization indexes
    await User.collection.createIndex({ role: 1 }, { background: true });
    await User.collection.createIndex({ isActive: 1 }, { background: true });
    await User.collection.createIndex({ createdAt: -1 }, { background: true });
    await User.collection.createIndex({ lastLogin: -1 }, { background: true });
    
    // Compound indexes for common queries
    await User.collection.createIndex(
      { role: 1, isActive: 1, createdAt: -1 }, 
      { background: true }
    );
    
    // Partial indexes for specific conditions
    await User.collection.createIndex(
      { lockUntil: 1 }, 
      { 
        background: true,
        partialFilterExpression: { lockUntil: { $exists: true } }
      }
    );
    
    // Text search index
    await User.collection.createIndex(
      { fullName: 'text', email: 'text', username: 'text' },
      { background: true }
    );

    logger.info('User indexes created');
  }

async createProductIndexes() {
  const Product = mongoose.model('Product');

  // Single-field indexes
  await Product.collection.createIndex({ Category: 1 }, { background: true });
  await Product.collection.createIndex({ seller: 1 }, { background: true });
  await Product.collection.createIndex({ isActive: 1 }, { background: true });
  await Product.collection.createIndex({ price: 1 }, { background: true });
  await Product.collection.createIndex({ rating: -1 }, { background: true });
  await Product.collection.createIndex({ salesCount: -1 }, { background: true });
  await Product.collection.createIndex({ createdAt: -1 }, { background: true });

  // Compound indexes
  await Product.collection.createIndex(
    { Category: 1, isActive: 1, price: 1 },
    { background: true }
  );

  await Product.collection.createIndex(
    { seller: 1, isActive: 1, createdAt: -1 },
    { background: true }
  );

  await Product.collection.createIndex(
    { isActive: 1, rating: -1, salesCount: -1 },
    { background: true }
  );

  // Text index
  await Product.collection.createIndex(
    {
      name: 'text',
      description: 'text',
      tags: 'text',
    
    },
    {
      background: true,
      weights: {
        name: 10,
        tags: 5,
        description: 1
      }
    }
  );

  logger.info('Product indexes created');
}



  async createOrderIndexes() {
    const Order = mongoose.model('Order');
    
    // Query optimization indexes
    await Order.collection.createIndex({ userId: 1 }, { background: true });
    await Order.collection.createIndex({ status: 1 }, { background: true });
    await Order.collection.createIndex({ paymentStatus: 1 }, { background: true });
    await Order.collection.createIndex({ createdAt: -1 }, { background: true });
    await Order.collection.createIndex({ orderNumber: 1 }, { unique: true, background: true });
    
    // Compound indexes for common queries
    await Order.collection.createIndex(
      { userId: 1, status: 1, createdAt: -1 }, 
      { background: true }
    );
    
    await Order.collection.createIndex(
      { status: 1, createdAt: -1 }, 
      { background: true }
    );
    
    await Order.collection.createIndex(
      { paymentStatus: 1, createdAt: -1 }, 
      { background: true }
    );
    
    // Seller-specific indexes
    await Order.collection.createIndex(
      { 'items.sellerId': 1, status: 1, createdAt: -1 }, 
      { background: true }
    );

    logger.info('Order indexes created');
  }

  async createReviewIndexes() {
    const Review = mongoose.model('Review');
    
    // Query optimization indexes
    await Review.collection.createIndex({ productId: 1 }, { background: true });
    await Review.collection.createIndex({ userId: 1 }, { background: true });
    await Review.collection.createIndex({ rating: -1 }, { background: true });
    await Review.collection.createIndex({ createdAt: -1 }, { background: true });
    
    // Compound indexes
    await Review.collection.createIndex(
      { productId: 1, rating: -1, createdAt: -1 }, 
      { background: true }
    );
    
    await Review.collection.createIndex(
      { userId: 1, createdAt: -1 }, 
      { background: true }
    );
    
    // Unique constraint to prevent duplicate reviews
    await Review.collection.createIndex(
      { userId: 1, productId: 1 }, 
      { unique: true, background: true }
    );

    logger.info('Review indexes created');
  }

  async createAddressIndexes() {
    const Address = mongoose.model('Address');
    
    // Query optimization indexes
    await Address.collection.createIndex({ userId: 1 }, { background: true });
    await Address.collection.createIndex({ isDefault: 1 }, { background: true });
    await Address.collection.createIndex({ country: 1 }, { background: true });
    await Address.collection.createIndex({ state: 1 }, { background: true });
    
    // Compound indexes
    await Address.collection.createIndex(
      { userId: 1, isDefault: 1 }, 
      { background: true }
    );

    logger.info('Address indexes created');
  }

  async createPaymentIndexes() {
    const Payment = mongoose.model('Payment');
    
    // Query optimization indexes
    await Payment.collection.createIndex({ userId: 1 }, { background: true });
    await Payment.collection.createIndex({ orderId: 1 }, { background: true });
    await Payment.collection.createIndex({ status: 1 }, { background: true });
    await Payment.collection.createIndex({ paymentMethod: 1 }, { background: true });
    await Payment.collection.createIndex({ createdAt: -1 }, { background: true });
    
    // Compound indexes
    await Payment.collection.createIndex(
      { userId: 1, status: 1, createdAt: -1 }, 
      { background: true }
    );
    
    await Payment.collection.createIndex(
      { orderId: 1, status: 1 }, 
      { background: true }
    );

    logger.info('Payment indexes created');
  }

async createWishlistIndexes() {
  const Wishlist = mongoose.model('Wishlist');
  const existingIndexes = await Wishlist.collection.indexes();

  const hasUserIdIndex = existingIndexes.some(
    i => i.name === 'userId_1'
  );

  if (!hasUserIdIndex) {
    await Wishlist.collection.createIndex(
      { userId: 1 },
      { unique: true, background: true }
    );
  }

  const hasCompoundIndex = existingIndexes.some(
    i => i.name === 'userId_1_items.productId_1'
  );

  if (!hasCompoundIndex) {
    await Wishlist.collection.createIndex(
      { userId: 1, 'items.productId': 1 },
      { unique: true, background: true }
    );
  }

  logger.info('Wishlist indexes created');
}



  // Database health check
  async healthCheck() {
    try {
      const adminDb = mongoose.connection.db.admin();
      const result = await adminDb.ping();
      
      const stats = await mongoose.connection.db.stats();
      
      return {
        status: 'healthy',
        connected: this.isConnected,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        collections: stats.collections,
        dataSize: stats.dataSize,
        indexSize: stats.indexSize,
        ping: result
      };
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message
      };
    }
  }

  // Get database statistics
  async getStats() {
    try {
      const stats = await mongoose.connection.db.stats();
      const collections = await mongoose.connection.db.listCollections().toArray();
      
      return {
        database: stats,
        collections: collections.map(col => ({
          name: col.name,
          type: col.type
        }))
      };
    } catch (error) {
      logger.error('Error getting database stats', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
export default new DatabaseManager();