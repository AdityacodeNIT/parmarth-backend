import migrationManager from './index.js';
import logger from '../utils/logger.js';

// Migration 001: Create initial database indexes
migrationManager.register(
  '001',
  'Create initial database indexes',
  
  // Up migration - create indexes
  async (session) => {
    const db = session.client.db();
    
    logger.info('Creating initial database indexes...');
    
    // Users collection indexes
    const usersCollection = db.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true, session });
    await usersCollection.createIndex({ username: 1 }, { unique: true, session });
    await usersCollection.createIndex({ role: 1 }, { session });
    await usersCollection.createIndex({ isActive: 1 }, { session });
    await usersCollection.createIndex({ createdAt: -1 }, { session });
    await usersCollection.createIndex({ role: 1, isActive: 1, createdAt: -1 }, { session });
    
    // Products collection indexes
    const productsCollection = db.collection('products');
    await productsCollection.createIndex({ sku: 1 }, { unique: true, session });
    await productsCollection.createIndex({ category: 1 }, { session });
    await productsCollection.createIndex({ sellerId: 1 }, { session });
    await productsCollection.createIndex({ status: 1 }, { session });
    await productsCollection.createIndex({ price: 1 }, { session });
    await productsCollection.createIndex({ rating: -1 }, { session });
    await productsCollection.createIndex({ category: 1, status: 1, price: 1 }, { session });
    await productsCollection.createIndex({ sellerId: 1, status: 1, createdAt: -1 }, { session });
    
    // Orders collection indexes
    const ordersCollection = db.collection('orders');
    await ordersCollection.createIndex({ userId: 1 }, { session });
    await ordersCollection.createIndex({ status: 1 }, { session });
    await ordersCollection.createIndex({ orderNumber: 1 }, { unique: true, session });
    await ordersCollection.createIndex({ userId: 1, status: 1, createdAt: -1 }, { session });
    await ordersCollection.createIndex({ 'items.sellerId': 1, status: 1 }, { session });
    
    // Reviews collection indexes
    const reviewsCollection = db.collection('reviews');
    await reviewsCollection.createIndex({ productId: 1 }, { session });
    await reviewsCollection.createIndex({ userId: 1 }, { session });
    await reviewsCollection.createIndex({ userId: 1, productId: 1 }, { unique: true, session });
    await reviewsCollection.createIndex({ productId: 1, rating: -1, createdAt: -1 }, { session });
    
    // Addresses collection indexes
    const addressesCollection = db.collection('addresses');
    await addressesCollection.createIndex({ userId: 1 }, { session });
    await addressesCollection.createIndex({ userId: 1, isDefault: 1 }, { session });
    
    // Payments collection indexes
    const paymentsCollection = db.collection('payments');
    await paymentsCollection.createIndex({ userId: 1 }, { session });
    await paymentsCollection.createIndex({ orderId: 1 }, { session });
    await paymentsCollection.createIndex({ status: 1 }, { session });
    await paymentsCollection.createIndex({ userId: 1, status: 1, createdAt: -1 }, { session });
    
    // Wishlists collection indexes
    const wishlistsCollection = db.collection('wishlists');
    await wishlistsCollection.createIndex({ userId: 1 }, { session });
    await wishlistsCollection.createIndex({ 'items.productId': 1 }, { session });
    
    logger.info('Initial database indexes created successfully');
  },
  
  // Down migration - remove indexes
  async (session) => {
    const db = session.client.db();
    
    logger.info('Removing initial database indexes...');
    
    // Note: In production, be careful about dropping indexes as it can affect performance
    // This is mainly for development/testing purposes
    
    const collections = ['users', 'products', 'orders', 'reviews', 'addresses', 'payments', 'wishlists'];
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        const indexes = await collection.listIndexes().toArray();
        
        // Drop all indexes except _id
        for (const index of indexes) {
          if (index.name !== '_id_') {
            await collection.dropIndex(index.name, { session });
          }
        }
      } catch (error) {
        logger.warn(`Error dropping indexes for collection ${collectionName}`, { 
          error: error.message 
        });
      }
    }
    
    logger.info('Initial database indexes removed');
  }
);