/**
 * Migration: Update Legacy Users for OTP Implementation
 * 
 * This migration updates all existing users created before the OTP implementation
 * to mark them as verified so they can continue using the platform.
 * 
 * Run this migration once after deploying the OTP feature.
 */

import { User } from '../modules/user/user.model.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const migrateLegacyUsers = async () => {
    try {
        console.log('🔄 Starting legacy user migration...');

        // Connect to database if not already connected
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✅ Connected to database');
        }

        // Find all users where emailVerified is null or undefined
        const legacyUsers = await User.find({
            $or: [
                { emailVerified: { $exists: false } },
                { emailVerified: null }
            ]
        });

        console.log(`📊 Found ${legacyUsers.length} legacy users to migrate`);

        if (legacyUsers.length === 0) {
            console.log('✅ No legacy users found. Migration complete!');
            return {
                success: true,
                migratedCount: 0,
                message: 'No legacy users to migrate'
            };
        }

        // Update all legacy users
        const updateResult = await User.updateMany(
            {
                $or: [
                    { emailVerified: { $exists: false } },
                    { emailVerified: null }
                ]
            },
            {
                $set: {
                    emailVerified: true,
                    isVerified: true,
                    otp: null,
                    otpExpiry: null
                }
            }
        );

        console.log(`✅ Migration complete!`);
        console.log(`   - Matched: ${updateResult.matchedCount} users`);
        console.log(`   - Modified: ${updateResult.modifiedCount} users`);

        return {
            success: true,
            migratedCount: updateResult.modifiedCount,
            matchedCount: updateResult.matchedCount,
            message: `Successfully migrated ${updateResult.modifiedCount} legacy users`
        };

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    migrateLegacyUsers()
        .then((result) => {
            console.log('\n📋 Migration Summary:');
            console.log(JSON.stringify(result, null, 2));
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration failed:', error);
            process.exit(1);
        });
}

export default migrateLegacyUsers;
