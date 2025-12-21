import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import { Product } from '../models/product.models.js';

// Review Schema
const ReviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    sparse: true,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  pros: [{
    type: String,
    trim: true,
    maxlength: 100
  }],
  cons: [{
    type: String,
    trim: true,
    maxlength: 100
  }],
  images: [{
    url: String,
    caption: String
  }],
  
  // Verification and moderation
  isVerifiedPurchase: {
    type: Boolean,
    default: false,
    index: true
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'pending',
    index: true
  },
  moderationReason: String,
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  },
  moderatedAt: Date,
  
  // Helpfulness voting
  helpfulVotes: {
    type: Number,
    default: 0,
    index: true
  },
  unhelpfulVotes: {
    type: Number,
    default: 0
  },
  totalVotes: {
    type: Number,
    default: 0
  },
  helpfulnessScore: {
    type: Number,
    default: 0,
    index: true
  },
  
  // Spam detection
  spamScore: {
    type: Number,
    default: 0
  },
  spamFlags: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
    },
    reason: String,
    flaggedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Engagement metrics
  viewCount: {
    type: Number,
    default: 0
  },
  reportCount: {
    type: Number,
    default: 0
  },
  
  // Additional metadata
  deviceInfo: {
    platform: String,
    browser: String
  },
  ipAddress: String,
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes
ReviewSchema.index({ productId: 1, rating: -1 });
ReviewSchema.index({ productId: 1, createdAt: -1 });
ReviewSchema.index({ productId: 1, helpfulnessScore: -1 });
ReviewSchema.index({ userId: 1, createdAt: -1 });
ReviewSchema.index({ moderationStatus: 1, createdAt: -1 });
ReviewSchema.index({ isVerifiedPurchase: 1, rating: -1 });

// Unique constraint to prevent duplicate reviews
ReviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Pre-save middleware
ReviewSchema.pre('save', function(next) {
  // Calculate helpfulness score
  if (this.totalVotes > 0) {
    this.helpfulnessScore = (this.helpfulVotes / this.totalVotes) * 100;
  }
  next();
});

// Review Vote Schema
const ReviewVoteSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },
  reviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review',
    required: true
  },
  voteType: {
    type: String,
    enum: ['helpful', 'unhelpful'],
    required: true
  }
}, {
  timestamps: true
});

// Unique constraint for votes
ReviewVoteSchema.index({ userId: 1, reviewId: 1 }, { unique: true });

const Review = mongoose.model('Review', ReviewSchema);
const ReviewVote = mongoose.model('ReviewVote', ReviewVoteSchema);

class ReviewService {
  // Create a new review
  async createReview(reviewData) {
    try {
      const {
        userId,
        productId,
        orderId,
        rating,
        title,
        content,
        pros = [],
        cons = [],
        images = [],
        deviceInfo = {},
        ipAddress
      } = reviewData;

      // Check if user already reviewed this product
      const existingReview = await Review.findOne({ userId, productId, isActive: true });
      if (existingReview) {
        throw new Error('You have already reviewed this product');
      }

      // Verify product exists
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Check if it's a verified purchase
      let isVerifiedPurchase = false;
      if (orderId) {
        // Check if user actually purchased this product
        // This would integrate with your order system
        isVerifiedPurchase = await this.verifyPurchase(userId, productId, orderId);
      }

      // Calculate initial spam score
      const spamScore = await this.calculateSpamScore({
        title,
        content,
        userId,
        ipAddress
      });

      // Create review
      const review = new Review({
        userId,
        productId,
        orderId,
        rating,
        title,
        content,
        pros,
        cons,
        images,
        isVerifiedPurchase,
        spamScore,
        deviceInfo,
        ipAddress,
        moderationStatus: spamScore > 0.7 ? 'flagged' : 'pending'
      });

      await review.save();

      // Update product rating
      await this.updateProductRating(productId);

      // Track interaction
      try {
        const { default: userInteractionService } = await import('./userInteractionService.js');
        await userInteractionService.trackInteraction({
          userId,
          sessionId: `review_${review._id}`,
          productId,
          interactionType: 'review_created',
          metadata: {
            reviewId: review._id,
            rating,
            isVerifiedPurchase
          }
        });
      } catch (error) {
        logger.warn('Failed to track review interaction:', error);
      }

      return await Review.findById(review._id)
        .populate('userId', 'fullName avatar')
        .lean();
    } catch (error) {
      logger.error('Failed to create review:', error);
      throw error;
    }
  }

  // Get reviews for a product
  async getProductReviews(productId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'newest',
        rating,
        verified = null,
        withImages = null
      } = options;

      const query = {
        productId,
        isActive: true,
        moderationStatus: 'approved'
      };

      if (rating) {
        query.rating = parseInt(rating);
      }

      if (verified !== null) {
        query.isVerifiedPurchase = verified === 'true';
      }

      if (withImages !== null) {
        if (withImages === 'true') {
          query['images.0'] = { $exists: true };
        }
      }

      let sortOptions = {};
      switch (sortBy) {
        case 'newest':
          sortOptions = { createdAt: -1 };
          break;
        case 'oldest':
          sortOptions = { createdAt: 1 };
          break;
        case 'highest_rating':
          sortOptions = { rating: -1, createdAt: -1 };
          break;
        case 'lowest_rating':
          sortOptions = { rating: 1, createdAt: -1 };
          break;
        case 'most_helpful':
          sortOptions = { helpfulnessScore: -1, helpfulVotes: -1 };
          break;
        default:
          sortOptions = { createdAt: -1 };
      }

      const skip = (page - 1) * limit;

      const [reviews, total, ratingDistribution] = await Promise.all([
        Review.find(query)
          .populate('userId', 'fullName avatar')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Review.countDocuments(query),
        this.getRatingDistribution(productId)
      ]);

      return {
        reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        ratingDistribution
      };
    } catch (error) {
      logger.error('Failed to get product reviews:', error);
      throw error;
    }
  }

  // Get user's reviews
  async getUserReviews(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'newest'
      } = options;

      const query = { userId, isActive: true };

      let sortOptions = {};
      switch (sortBy) {
        case 'newest':
          sortOptions = { createdAt: -1 };
          break;
        case 'oldest':
          sortOptions = { createdAt: 1 };
          break;
        case 'highest_rating':
          sortOptions = { rating: -1, createdAt: -1 };
          break;
        case 'lowest_rating':
          sortOptions = { rating: 1, createdAt: -1 };
          break;
        default:
          sortOptions = { createdAt: -1 };
      }

      const skip = (page - 1) * limit;

      const [reviews, total] = await Promise.all([
        Review.find(query)
          .populate('productId', 'name ProductImage price Category')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Review.countDocuments(query)
      ]);

      return {
        reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get user reviews:', error);
      throw error;
    }
  }

  // Vote on review helpfulness
  async voteOnReview(userId, reviewId, voteType) {
    try {
      if (!['helpful', 'unhelpful'].includes(voteType)) {
        throw new Error('Invalid vote type');
      }

      const review = await Review.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      // Check if user already voted
      const existingVote = await ReviewVote.findOne({ userId, reviewId });

      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // Remove vote if same type
          await ReviewVote.deleteOne({ _id: existingVote._id });
          
          if (voteType === 'helpful') {
            review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
          } else {
            review.unhelpfulVotes = Math.max(0, review.unhelpfulVotes - 1);
          }
          review.totalVotes = Math.max(0, review.totalVotes - 1);
        } else {
          // Change vote type
          existingVote.voteType = voteType;
          await existingVote.save();
          
          if (voteType === 'helpful') {
            review.helpfulVotes += 1;
            review.unhelpfulVotes = Math.max(0, review.unhelpfulVotes - 1);
          } else {
            review.unhelpfulVotes += 1;
            review.helpfulVotes = Math.max(0, review.helpfulVotes - 1);
          }
        }
      } else {
        // Create new vote
        await new ReviewVote({ userId, reviewId, voteType }).save();
        
        if (voteType === 'helpful') {
          review.helpfulVotes += 1;
        } else {
          review.unhelpfulVotes += 1;
        }
        review.totalVotes += 1;
      }

      await review.save();

      return {
        helpfulVotes: review.helpfulVotes,
        unhelpfulVotes: review.unhelpfulVotes,
        totalVotes: review.totalVotes,
        helpfulnessScore: review.helpfulnessScore
      };
    } catch (error) {
      logger.error('Failed to vote on review:', error);
      throw error;
    }
  }

  // Report review as spam/inappropriate
  async reportReview(userId, reviewId, reason) {
    try {
      const review = await Review.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      // Check if user already reported this review
      const existingFlag = review.spamFlags.find(flag => 
        flag.userId.toString() === userId.toString()
      );

      if (existingFlag) {
        throw new Error('You have already reported this review');
      }

      // Add spam flag
      review.spamFlags.push({
        userId,
        reason,
        flaggedAt: new Date()
      });

      review.reportCount += 1;

      // Auto-flag if too many reports
      if (review.reportCount >= 5) {
        review.moderationStatus = 'flagged';
      }

      await review.save();

      return { success: true, message: 'Review reported successfully' };
    } catch (error) {
      logger.error('Failed to report review:', error);
      throw error;
    }
  }

  // Update review (by author only)
  async updateReview(userId, reviewId, updateData) {
    try {
      const review = await Review.findOne({ 
        _id: reviewId, 
        userId, 
        isActive: true 
      });

      if (!review) {
        throw new Error('Review not found or access denied');
      }

      const allowedUpdates = ['title', 'content', 'pros', 'cons', 'images'];
      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          review[field] = updateData[field];
        }
      });

      // Reset moderation status if content changed
      if (updateData.title || updateData.content) {
        review.moderationStatus = 'pending';
        review.spamScore = await this.calculateSpamScore({
          title: review.title,
          content: review.content,
          userId,
          ipAddress: review.ipAddress
        });
      }

      await review.save();

      return await Review.findById(review._id)
        .populate('userId', 'fullName avatar')
        .lean();
    } catch (error) {
      logger.error('Failed to update review:', error);
      throw error;
    }
  }

  // Delete review (by author only)
  async deleteReview(userId, reviewId) {
    try {
      const review = await Review.findOne({ 
        _id: reviewId, 
        userId, 
        isActive: true 
      });

      if (!review) {
        throw new Error('Review not found or access denied');
      }

      review.isActive = false;
      await review.save();

      // Update product rating
      await this.updateProductRating(review.productId);

      return { success: true, message: 'Review deleted successfully' };
    } catch (error) {
      logger.error('Failed to delete review:', error);
      throw error;
    }
  }

  // Moderate review (admin only)
  async moderateReview(reviewId, moderatorId, status, reason = '') {
    try {
      const review = await Review.findById(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      review.moderationStatus = status;
      review.moderationReason = reason;
      review.moderatedBy = moderatorId;
      review.moderatedAt = new Date();

      await review.save();

      // Update product rating if status changed to approved/rejected
      if (['approved', 'rejected'].includes(status)) {
        await this.updateProductRating(review.productId);
      }

      return review;
    } catch (error) {
      logger.error('Failed to moderate review:', error);
      throw error;
    }
  }

  // Get reviews pending moderation
  async getPendingReviews(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'newest'
      } = options;

      const query = {
        moderationStatus: { $in: ['pending', 'flagged'] },
        isActive: true
      };

      let sortOptions = {};
      switch (sortBy) {
        case 'newest':
          sortOptions = { createdAt: -1 };
          break;
        case 'oldest':
          sortOptions = { createdAt: 1 };
          break;
        case 'most_reported':
          sortOptions = { reportCount: -1, createdAt: -1 };
          break;
        case 'highest_spam_score':
          sortOptions = { spamScore: -1, createdAt: -1 };
          break;
        default:
          sortOptions = { createdAt: -1 };
      }

      const skip = (page - 1) * limit;

      const [reviews, total] = await Promise.all([
        Review.find(query)
          .populate('userId', 'fullName email')
          .populate('productId', 'name ProductImage')
          .sort(sortOptions)
          .skip(skip)
          .limit(limit)
          .lean(),
        Review.countDocuments(query)
      ]);

      return {
        reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get pending reviews:', error);
      throw error;
    }
  }

  // Get rating distribution for a product
  async getRatingDistribution(productId) {
    try {
      const distribution = await Review.aggregate([
        {
          $match: {
            productId: new mongoose.Types.ObjectId(productId),
            isActive: true,
            moderationStatus: 'approved'
          }
        },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: -1 }
        }
      ]);

      // Fill in missing ratings with 0
      const result = {};
      for (let i = 1; i <= 5; i++) {
        result[i] = 0;
      }

      distribution.forEach(item => {
        result[item._id] = item.count;
      });

      const total = Object.values(result).reduce((sum, count) => sum + count, 0);

      return {
        distribution: result,
        total,
        percentages: Object.keys(result).reduce((acc, rating) => {
          acc[rating] = total > 0 ? ((result[rating] / total) * 100).toFixed(1) : 0;
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Failed to get rating distribution:', error);
      return { distribution: {}, total: 0, percentages: {} };
    }
  }

  // Update product rating
  async updateProductRating(productId) {
    try {
      const stats = await Review.aggregate([
        {
          $match: {
            productId: new mongoose.Types.ObjectId(productId),
            isActive: true,
            moderationStatus: 'approved'
          }
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 }
          }
        }
      ]);

      const rating = stats.length > 0 ? Math.round(stats[0].avgRating * 10) / 10 : 0;
      const reviewCount = stats.length > 0 ? stats[0].totalReviews : 0;

      await Product.findByIdAndUpdate(productId, {
        rating,
        reviewCount
      });

      return { rating, reviewCount };
    } catch (error) {
      logger.error('Failed to update product rating:', error);
      throw error;
    }
  }

  // Calculate spam score
  async calculateSpamScore(reviewData) {
    try {
      const { title, content, userId, ipAddress } = reviewData;
      let score = 0;

      // Check for spam keywords
      const spamKeywords = [
        'fake', 'scam', 'terrible', 'worst', 'amazing', 'perfect', 'best ever',
        'buy now', 'click here', 'free', 'guarantee', 'limited time'
      ];

      const text = `${title} ${content}`.toLowerCase();
      const spamMatches = spamKeywords.filter(keyword => text.includes(keyword));
      score += spamMatches.length * 0.1;

      // Check for excessive capitalization
      const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
      if (capsRatio > 0.3) score += 0.2;

      // Check for excessive punctuation
      const punctRatio = (text.match(/[!?]{2,}/g) || []).length;
      if (punctRatio > 2) score += 0.2;

      // Check for very short or very long content
      if (content.length < 10) score += 0.3;
      if (content.length > 1500) score += 0.1;

      // Check for duplicate content from same user
      const duplicateCount = await Review.countDocuments({
        userId,
        $or: [
          { title: { $regex: title, $options: 'i' } },
          { content: { $regex: content.substring(0, 50), $options: 'i' } }
        ],
        isActive: true
      });

      if (duplicateCount > 0) score += 0.4;

      // Check for multiple reviews from same IP
      if (ipAddress) {
        const ipCount = await Review.countDocuments({
          ipAddress,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });

        if (ipCount > 3) score += 0.3;
      }

      return Math.min(score, 1); // Cap at 1.0
    } catch (error) {
      logger.error('Failed to calculate spam score:', error);
      return 0;
    }
  }

  // Verify purchase
  async verifyPurchase(userId, productId, orderId) {
    try {
      // This would integrate with your order system
      // For now, return true if orderId is provided
      return !!orderId;
    } catch (error) {
      logger.error('Failed to verify purchase:', error);
      return false;
    }
  }

  // Get review analytics
  async getReviewAnalytics(options = {}) {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        productId
      } = options;

      const matchStage = {
        createdAt: { $gte: startDate, $lte: endDate },
        isActive: true
      };

      if (productId) {
        matchStage.productId = new mongoose.Types.ObjectId(productId);
      }

      const analytics = await Review.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            avgRating: { $avg: '$rating' },
            verifiedReviews: {
              $sum: { $cond: ['$isVerifiedPurchase', 1, 0] }
            },
            pendingReviews: {
              $sum: { $cond: [{ $eq: ['$moderationStatus', 'pending'] }, 1, 0] }
            },
            flaggedReviews: {
              $sum: { $cond: [{ $eq: ['$moderationStatus', 'flagged'] }, 1, 0] }
            },
            totalHelpfulVotes: { $sum: '$helpfulVotes' },
            avgSpamScore: { $avg: '$spamScore' }
          }
        }
      ]);

      return analytics[0] || {};
    } catch (error) {
      logger.error('Failed to get review analytics:', error);
      return {};
    }
  }
}

export default new ReviewService();