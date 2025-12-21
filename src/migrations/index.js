import mongoose from 'mongoose';
import logger from '../utils/logger.js';

// Migration system for database schema changes
export class MigrationManager {
  constructor() {
    this.migrations = new Map();
    this.migrationCollection = 'migrations';
  }

  // Register a migration
  register(version, name, up, down) {
    this.migrations.set(version, {
      version,
      name,
      up,
      down,
      createdAt: new Date()
    });
  }

  // Run pending migrations
  async runMigrations() {
    try {
      logger.info('Starting database migrations...');
      
      // Get completed migrations
      const completedMigrations = await this.getCompletedMigrations();
      const completedVersions = new Set(completedMigrations.map(m => m.version));
      
      // Sort migrations by version
      const sortedMigrations = Array.from(this.migrations.entries())
        .sort(([a], [b]) => a.localeCompare(b));
      
      let migrationsRun = 0;
      
      for (const [version, migration] of sortedMigrations) {
        if (!completedVersions.has(version)) {
          logger.info(`Running migration ${version}: ${migration.name}`);
          
          const session = await mongoose.startSession();
          session.startTransaction();
          
          try {
            await migration.up(session);
            await this.recordMigration(migration, session);
            await session.commitTransaction();
            
            logger.info(`Migration ${version} completed successfully`);
            migrationsRun++;
          } catch (error) {
            await session.abortTransaction();
            logger.error(`Migration ${version} failed`, { error: error.message });
            throw error;
          } finally {
            session.endSession();
          }
        }
      }
      
      logger.info(`Database migrations completed. ${migrationsRun} migrations run.`);
      return migrationsRun;
    } catch (error) {
      logger.error('Migration process failed', { error: error.message });
      throw error;
    }
  }

  // Rollback last migration
  async rollbackLastMigration() {
    try {
      const completedMigrations = await this.getCompletedMigrations();
      
      if (completedMigrations.length === 0) {
        logger.info('No migrations to rollback');
        return;
      }
      
      const lastMigration = completedMigrations[completedMigrations.length - 1];
      const migration = this.migrations.get(lastMigration.version);
      
      if (!migration || !migration.down) {
        throw new Error(`Cannot rollback migration ${lastMigration.version}: no rollback function`);
      }
      
      logger.info(`Rolling back migration ${lastMigration.version}: ${migration.name}`);
      
      const session = await mongoose.startSession();
      session.startTransaction();
      
      try {
        await migration.down(session);
        await this.removeMigrationRecord(lastMigration.version, session);
        await session.commitTransaction();
        
        logger.info(`Migration ${lastMigration.version} rolled back successfully`);
      } catch (error) {
        await session.abortTransaction();
        logger.error(`Rollback of migration ${lastMigration.version} failed`, { 
          error: error.message 
        });
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      logger.error('Rollback process failed', { error: error.message });
      throw error;
    }
  }

  // Get completed migrations from database
  async getCompletedMigrations() {
    try {
      const db = mongoose.connection.db;
      const collection = db.collection(this.migrationCollection);
      
      return await collection
        .find({})
        .sort({ completedAt: 1 })
        .toArray();
    } catch (error) {
      logger.error('Error getting completed migrations', { error: error.message });
      return [];
    }
  }

  // Record completed migration
  async recordMigration(migration, session) {
    const db = mongoose.connection.db;
    const collection = db.collection(this.migrationCollection);
    
    await collection.insertOne({
      version: migration.version,
      name: migration.name,
      completedAt: new Date()
    }, { session });
  }

  // Remove migration record
  async removeMigrationRecord(version, session) {
    const db = mongoose.connection.db;
    const collection = db.collection(this.migrationCollection);
    
    await collection.deleteOne({ version }, { session });
  }

  // Get migration status
  async getStatus() {
    const completedMigrations = await this.getCompletedMigrations();
    const completedVersions = new Set(completedMigrations.map(m => m.version));
    
    const allMigrations = Array.from(this.migrations.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([version, migration]) => ({
        version,
        name: migration.name,
        status: completedVersions.has(version) ? 'completed' : 'pending'
      }));
    
    return {
      total: allMigrations.length,
      completed: completedMigrations.length,
      pending: allMigrations.length - completedMigrations.length,
      migrations: allMigrations
    };
  }
}

// Export singleton instance
export default new MigrationManager();