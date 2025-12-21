import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { Product } from '../models/product.models.js';

// User Interaction Schema
const UserInteractionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  interactionType: {
    type: String,
    enum: ['view', 'click', 'add_to_cart', 'remove_from_cart', 'purchase', 'wishlist_add', 'wishlist_remove', 'search_click'],
    required: true,
    index: true
  },
  duration: {
    type: Number, // Time spent on product page in seconds
    default: 0
  },
  metadata: {
    searchQuery: String,
    category: String,
    price: Number,
    referrer: String,
    deviceType: String,
    userAgent: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient querying
UserInteractionSchema.index({ userId: 1, timestamp: -1 });
UserInteractionSchema.index({ productId: 1, interactionType: 1 });
UserInteractionSchema.index({ userId: 1, interactionType: 1, timestamp: -1 });
UserInteractionSchema.index({ sessionId: 1, timestamp: -1 });

const UserInteraction = mongoose.model('UserInteraction', UserInteractionSchema);

class UserInteractionService {
  // Track user interaction
  async trackInteraction(interactionData) {
    try {
      const {
        userId,
        sessionId,
        productId,
        interactionType,
        duration = 0,
        metadata = {}
      } = interactionData;

      // Validate required fields
      if (!userId || !sessionId || !productId || !interactionType) {
        throw new Error('Missing required interaction data');
      }

      // Create interaction record
      const interaction = new UserInteraction({
        userId,
        sessionId,
        productId,
        interactionType,
        duration,
        metadata
      });

      await interaction.save();

      // Update product analytics
      await this.updateProductAnalytics(productId, interactionType);

      logger.debug('User interaction tracked', {
        userId,
        productId,
        interactionType
      });

      return interaction;
    } catch (error) {
      logger.error('Failed to track user interaction:', error);
      throw error;
    }
  }

  // Update product analytics based on interaction
  async updateProductAnalytics(productId, interactionType) {
    try {
      const updateData = {};

      switch (interactionType) {
        case 'view':
        case 'click':
          updateData.$inc = { viewCount: 1 };
          break;
        case 'purchase':
          updateData.$inc = { salesCount: 1 };
          break;
      }

      if (Object.keys(updateData).length > 0) {
        await Product.findByIdAndUpdate(productId, updateData);
      }
    } catch (error) {
      logger.error('Failed to update product analytics:', error);
    }
  }

  // Get user interaction history
  async getUserInteractions(userId, options = {}) {
    try {
      const {
        interactionType,
        limit = 50,
        skip = 0,
        startDate,
        endDate
      } = options;

      const query = { userId };

      if (interactionType) {
        query.interactionType = interactionType;
      }

      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) query.timestamp.$lte = new Date(endDate);
      }

      const interactions = await UserInteraction
        .find(query)
        .populate('productId', 'name price Category ProductImage')
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      return interactions;
    } catch (error) {
      logger.error('Failed to get user interactions:', error);
      throw error;
    }
  }

  // Get recently viewed products
  async getRecentlyViewed(userId, limit = 10) {
    try {
      const interactions = await UserInteraction
        .find({
          userId,
          interactionType: { $in: ['view', 'click'] }
        })
        .populate('productId')
        .sort({ timestamp: -1 })
        .limit(limit * 2) // Get more to filter duplicates
        .lean();

      // Remove duplicates and limit results
      const uniqueProducts = [];
      const seenProducts = new Set();

      for (const interaction of interactions) {
        if (interaction.productId && !seenProducts.has(interaction.productId._id.toString())) {
          uniqueProducts.push(interaction.productId);
          seenProducts.add(interaction.productId._id.toString());
          
          if (uniqueProducts.length >= limit) break;
        }
      }

      return uniqueProducts;
    } catch (error) {
      logger.error('Failed to get recently viewed products:', error);
      return [];
    }
  }

  // Get user preferences based on interactions
  async getUserPreferences(userId) {
    try {
      const pipeline = [
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            interactionType: { $in: ['view', 'click', 'purchase', 'add_to_cart'] }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $unwind: '$product'
        },
        {
          $group: {
            _id: {
              category: '$product.Category',
              interactionType: '$interactionType'
            },
            count: { $sum: 1 },
            avgPrice: { $avg: '$product.price' },
            products: { $addToSet: '$product._id' }
          }
        },
        {
          $group: {
            _id: '$_id.category',
            interactions: {
              $push: {
                type: '$_id.interactionType',
                count: '$count',
                avgPrice: '$avgPrice',
                products: '$products'
              }
            },
            totalInteractions: { $sum: '$count' }
          }
        },
        {
          $sort: { totalInteractions: -1 }
        }
      ];

      const preferences = await UserInteraction.aggregate(pipeline);

      // Calculate preference scores
      const categoryPreferences = preferences.map(pref => {
        let score = 0;
        pref.interactions.forEach(interaction => {
          const weight = this.getInteractionWeight(interaction.type);
          score += interaction.count * weight;
        });

        return {
          category: pref._id,
          score,
          totalInteractions: pref.totalInteractions,
          interactions: pref.interactions
        };
      });

      return categoryPreferences;
    } catch (error) {
      logger.error('Failed to get user preferences:', error);
      return [];
    }
  }

  // Get interaction weight for scoring
  getInteractionWeight(interactionType) {
    const weights = {
      'view': 1,
      'click': 2,
      'add_to_cart': 5,
      'wishlist_add': 3,
      'purchase': 10,
      'search_click': 2
    };
    return weights[interactionType] || 1;
  }

  // Get similar users based on interactions
  async getSimilarUsers(userId, limit = 10) {
    try {
      // Get user's interacted products
      const userProducts = await UserInteraction
        .find({ userId })
        .distinct('productId');

      if (userProducts.length === 0) {
        return [];
      }

      // Find users who interacted with similar products
      const pipeline = [
        {
          $match: {
            productId: { $in: userProducts },
            userId: { $ne: new mongoose.Types.ObjectId(userId) }
          }
        },
        {
          $group: {
            _id: '$userId',
            commonProducts: { $addToSet: '$productId' },
            totalInteractions: { $sum: 1 }
          }
        },
        {
          $addFields: {
            similarity: {
              $divide: [
                { $size: '$commonProducts' },
                userProducts.length
              ]
            }
          }
        },
        {
          $match: {
            similarity: { $gte: 0.1 } // At least 10% similarity
          }
        },
        {
          $sort: { similarity: -1, totalInteractions: -1 }
        },
        {
          $limit: limit
        }
      ];

      const similarUsers = await UserInteraction.aggregate(pipeline);
      return similarUsers;
    } catch (error) {
      logger.error('Failed to get similar users:', error);
      return [];
    }
  }

  // Get trending products based on recent interactions
  async getTrendingProducts(options = {}) {
    try {
      const {
        category,
        timeframe = 7, // days
        limit = 20
      } = options;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframe);

      const matchStage = {
        timestamp: { $gte: startDate },
        interactionType: { $in: ['view', 'click', 'add_to_cart', 'purchase'] }
      };

      const pipeline = [
        { $match: matchStage },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' }
      ];

      // Add category filter if specified
      if (category) {
        pipeline.push({
          $match: { 'product.Category': category }
        });
      }

      pipeline.push(
        {
          $group: {
            _id: '$productId',
            product: { $first: '$product' },
            totalInteractions: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            purchases: {
              $sum: {
                $cond: [{ $eq: ['$interactionType', 'purchase'] }, 1, 0]
              }
            },
            cartAdds: {
              $sum: {
                $cond: [{ $eq: ['$interactionType', 'add_to_cart'] }, 1, 0]
              }
            }
          }
        },
        {
          $addFields: {
            uniqueUserCount: { $size: '$uniqueUsers' },
            trendingScore: {
              $add: [
                '$totalInteractions',
                { $multiply: ['$purchases', 10] },
                { $multiply: ['$cartAdds', 5] }
              ]
            }
          }
        },
        {
          $sort: { trendingScore: -1, uniqueUserCount: -1 }
        },
        {
          $limit: limit
        }
      );

      const trendingProducts = await UserInteraction.aggregate(pipeline);
      return trendingProducts.map(item => ({
        ...item.product,
        trendingScore: item.trendingScore,
        uniqueUsers: item.uniqueUserCount,
        totalInteractions: item.totalInteractions
      }));
    } catch (error) {
      logger.error('Failed to get trending products:', error);
      return [];
    }
  }

  // Clean up old interactions (for performance)
  async cleanupOldInteractions(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await UserInteraction.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      logger.info('Cleaned up old interactions', {
        deletedCount: result.deletedCount,
        cutoffDate
      });

      return result.deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old interactions:', error);
      throw error;
    }
  }

  // Get interaction analytics
  async getInteractionAnalytics(options = {}) {
    try {
      const {
        startDate,
        endDate,
        userId,
        productId
      } = options;

      const matchStage = {};

      if (startDate || endDate) {
        matchStage.timestamp = {};
        if (startDate) matchStage.timestamp.$gte = new Date(startDate);
        if (endDate) matchStage.timestamp.$lte = new Date(endDate);
      }

      if (userId) matchStage.userId = new mongoose.Types.ObjectId(userId);
      if (productId) matchStage.productId = new mongoose.Types.ObjectId(productId);

      const pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              type: '$interactionType',
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$timestamp'
                }
              }
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' },
            uniqueProducts: { $addToSet: '$productId' }
          }
        },
        {
          $group: {
            _id: '$_id.type',
            dailyStats: {
              $push: {
                date: '$_id.date',
                count: '$count',
                uniqueUsers: { $size: '$uniqueUsers' },
                uniqueProducts: { $size: '$uniqueProducts' }
              }
            },
            totalCount: { $sum: '$count' }
          }
        }
      ];

      const analytics = await UserInteraction.aggregate(pipeline);
      return analytics;
    } catch (error) {
      logger.error('Failed to get interaction analytics:', error);
      return [];
    }
  }
}

export default new UserInteractionService();