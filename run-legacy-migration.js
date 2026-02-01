/**
 * Script to run legacy user migration
 * 
 * This script migrates all existing users to the new OTP system
 * by marking them as verified.
 * 
 * Usage:
 *   node run-legacy-migration.js
 */

import migrateLegacyUsers from './src/migrations/002_migrate_legacy_users.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const runMigration = async () => {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     Legacy User Migration for OTP Implementation      ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    try {
        // Connect to database
        console.log('🔌 Connecting to database...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to database\n');

        // Run migration
        const result = await migrateLegacyUsers();

        // Display results
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║                  Migration Complete!                   ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log(`\n✅ ${result.migratedCount} users migrated successfully`);
        console.log(`📊 ${result.matchedCount} legacy users found`);
        console.log(`\n💡 These users can now login without OTP verification`);
        console.log(`   (They will be auto-migrated on their next login)\n`);

        // Close connection
        await mongoose.connection.close();
        console.log('🔌 Database connection closed\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('\nStack trace:', error.stack);
        
        // Close connection on error
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        
        process.exit(1);
    }
};

// Run the migration
runMigration();
