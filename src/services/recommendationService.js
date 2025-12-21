import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { Product } from '../models/product.models.js';
import userInteractionService from './userInteractionService.js';

class RecommendationService {
  constructor() {
    this.algorithms = {
      COLLABORATIVE_FILTERING: 'collaborative_filtering',
      CONTENT_BASED: 'content_based',
      POPULARITY_BASED: 'popularity_based',
      HYBRID: 'hybrid'
    };
  }

  // Main recommendation function
  async getRecommendations(userId, options = {}) {
    try {
      const {
        algorithm = this.algorithms.HYBRID,
        limit = 10,
        excludeViewed = true,
        category = null,
        priceRange = null
      } = options;

      let recommendations = [];

      switch (algorithm) {
        case this.algorithms.COLLABORATIVE_FILTERING:
          recommendations = await this.getCollaborativeFilteringRecommendations(userId, options);
          break;
        case this.algorithms.CONTENT_BASED:
          recommendations = await this.getContentBasedRecommendations(userId, options);
          break;
        case this.algorithms.POPULARITY_BASED:
          recommendations = await this.getPopularityBasedRecommendations(options);
          break;
        case this.algorithms.HYBRID:
        default:
          recommendations = await this.getHybridRecommendations(userId, options);
          break;
      }

      // Apply filters
      if (excludeViewed) {
        recommendations = await this.excludeViewedProducts(userId, recommendations);
      }

      if (category) {
        recommendations = recommendations.filter(product => product.Category === category);
      }

      if (priceRange) {
        recommendations = recommendations.filter(product => 
          product.price >= priceRange.min && product.price <= priceRange.max
        );
      }

      // Limit results
      recommendations = recommendations.slice(0, limit);

      // Add recommendation scores and reasons
      recommendations = recommendations.map((product, index) => ({
        ...product,
        recommendationScore: product.recommendationScore || (1 - index * 0.1),
        recommendationReason: product.recommendationReason || 'Based on your preferences'
      }));

      return recommendations;
    } catch (error) {
      logger.error('Failed to get recommendations:', error);
      return [];
    }
  }

  // Collaborative filtering recommendations
  async getCollaborativeFilteringRecommendations(userId, options = {}) {
    try {
      const { limit = 20 } = options;

      // Get similar users
      const similarUsers = await userInteractionService.getSimilarUsers(userId, 10);
      
      if (similarUsers.length === 0) {
        // Fallback to popularity-based if no similar users
        return await this.getPopularityBasedRecommendations(options);
      }

      const similarUserIds = similarUsers.map(user => user._id);

      // Get products liked by similar users
      const pipeline = [
        {
          $match: {
            userId: { $in: similarUserIds },
            interactionType: { $in: ['purchase', 'add_to_cart', 'wishlist_add'] }
          }
        },
        {
          $group: {
            _id: '$productId',
            score: { $sum: 1 },
            users: { $addToSet: '$userId' }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $unwind: '$product'
        },
        {
          $addFields: {
            'product.recommendationScore': {
              $divide: ['$score', { $size: '$users' }]
            },
            'product.recommendationReason': 'Users with similar interests also liked this'
          }
        },
        {
          $sort: { 'product.recommendationScore': -1 }
        },
        {
          $limit: limit
        },
        {
          $replaceRoot: { newRoot: '$product' }
        }
      ];

      const recommendations = await mongoose.connection.db
        .collection('userinteractions')
        .aggregate(pipeline)
        .toArray();

      return recommendations;
    } catch (error) {
      logger.error('Failed to get collaborative filtering recommendations:', error);
      return [];
    }
  }

  // Content-based recommendations
  async getContentBasedRecommendations(userId, options = {}) {
    try {
      const { limit = 20 } = options;

      // Get user preferences
      const preferences = await userInteractionService.getUserPreferences(userId);
      
      if (preferences.length === 0) {
        return await this.getPopularityBasedRecommendations(options);
      }

      // Get preferred categories with weights
      const categoryWeights = {};
      let totalScore = 0;

      preferences.forEach(pref => {
        categoryWeights[pref.category] = pref.score;
        totalScore += pref.score;
      });

      // Normalize weights
      Object.keys(categoryWeights).forEach(category => {
        categoryWeights[category] = categoryWeights[category] / totalScore;
      });

      // Find products in preferred categories
      const preferredCategories = Object.keys(categoryWeights);
      
      const products = await Product.find({
        Category: { $in: preferredCategories },
        $or: [
          { isActive: true },
          { isActive: { $exists: false } }
        ]
      })
      .sort({ rating: -1, reviewCount: -1 })
      .limit(limit * 2)
      .lean();

      // Score products based on category preference
      const scoredProducts = products.map(product => ({
        ...product,
        recommendationScore: categoryWeights[product.Category] || 0,
        recommendationReason: `Based on your interest in ${product.Category}`
      }));

      // Sort by score and return top results
      scoredProducts.sort((a, b) => b.recommendationScore - a.recommendationScore);
      
      return scoredProducts.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get content-based recommendations:', error);
      return [];
    }
  }

  // Popularity-based recommendations
  async getPopularityBasedRecommendations(options = {}) {
    try {
      const { limit = 20, category = null } = options;

      const query = {
        $or: [
          { isActive: true },
          { isActive: { $exists: false } }
        ]
      };

      if (category) {
        query.Category = category;
      }

      const products = await Product.find(query)
        .sort({ 
          salesCount: -1, 
          viewCount: -1, 
          rating: -1, 
          reviewCount: -1 
        })
        .limit(limit)
        .lean();

      return products.map(product => ({
        ...product,
        recommendationScore: this.calculatePopularityScore(product),
        recommendationReason: 'Popular among all users'
      }));
    } catch (error) {
      logger.error('Failed to get popularity-based recommendations:', error);
      return [];
    }
  }

  // Hybrid recommendations (combines multiple algorithms)
  async getHybridRecommendations(userId, options = {}) {
    try {
      const { limit = 20 } = options;

      // Get recommendations from different algorithms
      const [
        collaborativeRecs,
        contentBasedRecs,
        popularityRecs
      ] = await Promise.all([
        this.getCollaborativeFilteringRecommendations(userId, { limit: Math.ceil(limit * 0.4) }),
        this.getContentBasedRecommendations(userId, { limit: Math.ceil(limit * 0.4) }),
        this.getPopularityBasedRecommendations({ limit: Math.ceil(limit * 0.2) })
      ]);

      // Combine and deduplicate recommendations
      const combinedRecs = new Map();

      // Add collaborative filtering results (highest weight)
      collaborativeRecs.forEach((product, index) => {
        const score = (product.recommendationScore || 0.5) * 0.5 + (1 - index * 0.1) * 0.1;
        combinedRecs.set(product._id.toString(), {
          ...product,
          recommendationScore: score,
          recommendationReason: 'Based on similar users and your preferences'
        });
      });

      // Add content-based results (medium weight)
      contentBasedRecs.forEach((product, index) => {
        const productId = product._id.toString();
        const score = (product.recommendationScore || 0.5) * 0.3 + (1 - index * 0.1) * 0.1;
        
        if (combinedRecs.has(productId)) {
          const existing = combinedRecs.get(productId);
          existing.recommendationScore += score;
        } else {
          combinedRecs.set(productId, {
            ...product,
            recommendationScore: score,
            recommendationReason: 'Based on your preferences'
          });
        }
      });

      // Add popularity-based results (lowest weight)
      popularityRecs.forEach((product, index) => {
        const productId = product._id.toString();
        const score = (product.recommendationScore || 0.5) * 0.2 + (1 - index * 0.1) * 0.05;
        
        if (combinedRecs.has(productId)) {
          const existing = combinedRecs.get(productId);
          existing.recommendationScore += score;
        } else {
          combinedRecs.set(productId, {
            ...product,
            recommendationScore: score,
            recommendationReason: 'Popular product'
          });
        }
      });

      // Convert to array and sort by score
      const recommendations = Array.from(combinedRecs.values())
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .slice(0, limit);

      return recommendations;
    } catch (error) {
      logger.error('Failed to get hybrid recommendations:', error);
      return [];
    }
  }

  // Get "You May Also Like" recommendations for a specific product
  async getProductBasedRecommendations(productId, options = {}) {
    try {
      const { limit = 10, userId = null } = options;

      // Get the source product
      const sourceProduct = await Product.findById(productId).lean();
      if (!sourceProduct) {
        return [];
      }

      // Find similar products based on category, price range, and user behavior
      const priceRange = {
        min: sourceProduct.price * 0.5,
        max: sourceProduct.price * 2
      };

      // Get products in same category with similar price
      let similarProducts = await Product.find({
        _id: { $ne: productId },
        Category: sourceProduct.Category,
        price: { $gte: priceRange.min, $lte: priceRange.max },
        $or: [
          { isActive: true },
          { isActive: { $exists: false } }
        ]
      })
      .sort({ rating: -1, salesCount: -1 })
      .limit(limit * 2)
      .lean();

      // If not enough similar products, expand to all categories
      if (similarProducts.length < limit) {
        const additionalProducts = await Product.find({
          _id: { $ne: productId, $nin: similarProducts.map(p => p._id) },
          price: { $gte: priceRange.min, $lte: priceRange.max },
          $or: [
            { isActive: true },
            { isActive: { $exists: false } }
          ]
        })
        .sort({ rating: -1, salesCount: -1 })
        .limit(limit - similarProducts.length)
        .lean();

        similarProducts = [...similarProducts, ...additionalProducts];
      }

      // If user is provided, get users who viewed this product and their other views
      if (userId) {
        try {
          const userBasedRecs = await this.getUserBasedProductRecommendations(productId, userId, limit);
          
          // Merge with similar products, giving preference to user-based recommendations
          const userRecIds = new Set(userBasedRecs.map(p => p._id.toString()));
          const filteredSimilar = similarProducts.filter(p => !userRecIds.has(p._id.toString()));
          
          similarProducts = [
            ...userBasedRecs.slice(0, Math.ceil(limit * 0.6)),
            ...filteredSimilar.slice(0, Math.floor(limit * 0.4))
          ];
        } catch (error) {
          logger.warn('Failed to get user-based product recommendations:', error);
        }
      }

      return similarProducts.slice(0, limit).map((product, index) => ({
        ...product,
        recommendationScore: 1 - (index * 0.1),
        recommendationReason: sourceProduct.Category === product.Category 
          ? `Similar to ${sourceProduct.name}`
          : 'You might also like this'
      }));
    } catch (error) {
      logger.error('Failed to get product-based recommendations:', error);
      return [];
    }
  }

  // Get user-based product recommendations
  async getUserBasedProductRecommendations(productId, userId, limit = 10) {
    try {
      // Find users who also viewed this product
      const pipeline = [
        {
          $match: {
            productId: new mongoose.Types.ObjectId(productId),
            userId: { $ne: new mongoose.Types.ObjectId(userId) },
            interactionType: { $in: ['view', 'click', 'purchase', 'add_to_cart'] }
          }
        },
        {
          $group: {
            _id: '$userId',
            interactions: { $sum: 1 }
          }
        },
        {
          $sort: { interactions: -1 }
        },
        {
          $limit: 20
        }
      ];

      const similarUsers = await mongoose.connection.db
        .collection('userinteractions')
        .aggregate(pipeline)
        .toArray();

      if (similarUsers.length === 0) {
        return [];
      }

      const similarUserIds = similarUsers.map(user => user._id);

      // Get other products these users interacted with
      const productPipeline = [
        {
          $match: {
            userId: { $in: similarUserIds },
            productId: { $ne: new mongoose.Types.ObjectId(productId) },
            interactionType: { $in: ['view', 'click', 'purchase', 'add_to_cart'] }
          }
        },
        {
          $group: {
            _id: '$productId',
            score: { $sum: 1 },
            users: { $addToSet: '$userId' }
          }
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        {
          $unwind: '$product'
        },
        {
          $sort: { score: -1 }
        },
        {
          $limit: limit
        },
        {
          $replaceRoot: { newRoot: '$product' }
        }
      ];

      const recommendations = await mongoose.connection.db
        .collection('userinteractions')
        .aggregate(productPipeline)
        .toArray();

      return recommendations;
    } catch (error) {
      logger.error('Failed to get user-based product recommendations:', error);
      return [];
    }
  }

  // Exclude products user has already viewed
  async excludeViewedProducts(userId, recommendations) {
    try {
      const viewedProductIds = await mongoose.connection.db
        .collection('userinteractions')
        .distinct('productId', {
          userId: new mongoose.Types.ObjectId(userId),
          interactionType: { $in: ['view', 'click', 'purchase'] }
        });

      const viewedIds = new Set(viewedProductIds.map(id => id.toString()));
      
      return recommendations.filter(product => 
        !viewedIds.has(product._id.toString())
      );
    } catch (error) {
      logger.error('Failed to exclude viewed products:', error);
      return recommendations;
    }
  }

  // Calculate popularity score
  calculatePopularityScore(product) {
    const salesWeight = 0.4;
    const viewWeight = 0.3;
    const ratingWeight = 0.3;

    const salesScore = (product.salesCount || 0) / 100; // Normalize
    const viewScore = (product.viewCount || 0) / 1000; // Normalize
    const ratingScore = (product.rating || 0) / 5; // Already normalized

    return (salesScore * salesWeight) + 
           (viewScore * viewWeight) + 
           (ratingScore * ratingWeight);
  }

  // Get trending products in category
  async getTrendingInCategory(category, options = {}) {
    try {
      const { limit = 10, timeframe = 7 } = options;

      return await userInteractionService.getTrendingProducts({
        category,
        timeframe,
        limit
      });
    } catch (error) {
      logger.error('Failed to get trending products in category:', error);
      return [];
    }
  }

  // Get personalized category recommendations
  async getCategoryRecommendations(userId, options = {}) {
    try {
      const { limit = 5 } = options;

      const preferences = await userInteractionService.getUserPreferences(userId);
      
      if (preferences.length === 0) {
        // Return popular categories
        const popularCategories = await Product.aggregate([
          {
            $match: {
              $or: [
                { isActive: true },
                { isActive: { $exists: false } }
              ]
            }
          },
          {
            $group: {
              _id: '$Category',
              productCount: { $sum: 1 },
              avgRating: { $avg: '$rating' },
              totalSales: { $sum: '$salesCount' }
            }
          },
          {
            $sort: { totalSales: -1, productCount: -1 }
          },
          {
            $limit: limit
          }
        ]);

        return popularCategories.map(cat => ({
          category: cat._id,
          score: cat.totalSales || 0,
          reason: 'Popular category'
        }));
      }

      return preferences.slice(0, limit).map(pref => ({
        category: pref.category,
        score: pref.score,
        reason: 'Based on your browsing history'
      }));
    } catch (error) {
      logger.error('Failed to get category recommendations:', error);
      return [];
    }
  }
}

export default new RecommendationService();