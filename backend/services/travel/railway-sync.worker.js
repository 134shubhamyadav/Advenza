import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { logger } from '../../utils/logger.js';
import { buildDatabase } from '../../scripts/build_railways_sqlite.js';
import { localRailwayService } from './local-railway.service.js';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // Exactly 6 hours
const DB_PATH = path.resolve('./data/railways/railways.db');

class RailwaySyncWorker {
  constructor() {
    this.isSyncing = false;
    this.timer = null;
  }

  /**
   * Check when the database was last updated
   */
  getLastSyncAgeHours() {
    if (!fs.existsSync(DB_PATH)) return Infinity;
    try {
      const db = new DatabaseSync(DB_PATH, { readOnly: true });
      const row = db.prepare("SELECT value FROM metadata WHERE key = 'last_synced_at'").get();
      db.close();

      if (!row || !row.value) return Infinity;
      const lastSynced = new Date(row.value + 'Z').getTime();
      const ageHours = (Date.now() - lastSynced) / (1000 * 60 * 60);
      return ageHours;
    } catch (err) {
      logger.warn(`[RailwaySyncWorker] Could not check last sync timestamp: ${err.message}`);
      return Infinity;
    }
  }

  /**
   * Run background update safely with atomic swap
   */
  async runSync(reason = 'scheduled') {
    if (this.isSyncing) {
      logger.info(`[RailwaySyncWorker] Sync already in progress. Skipping trigger.`);
      return;
    }

    this.isSyncing = true;
    logger.info(`[RailwaySyncWorker] Starting parallel background Indian Railways sync (reason: ${reason})...`);

    try {
      const result = await buildDatabase();
      if (result && result.success) {
        logger.info(`[RailwaySyncWorker] Sync completed successfully! ${result.trainsCount} trains, ${result.stationsCount} stations, ${result.schedulesCount} schedules.`);
        // Gracefully notify local service to reconnect to freshly updated database
        localRailwayService.reloadDatabase();
      }
    } catch (err) {
      logger.error(`[RailwaySyncWorker] Background sync encountered error: ${err.message}. Existing dataset remains active without downtime.`);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Initialize worker on server boot
   */
  init() {
    const ageHours = this.getLastSyncAgeHours();
    logger.info(`[RailwaySyncWorker] Initialized. Last sync was ${ageHours.toFixed(1)} hours ago.`);

    // If never synced or older than 6 hours, run sync in background without blocking server boot
    if (ageHours >= 6) {
      setTimeout(() => {
        this.runSync('stale_dataset_detected');
      }, 5000).unref(); // 5 second grace period after server boot
    }

    // Schedule automatic recurring sync every 6 hours
    this.timer = setInterval(() => {
      this.runSync('6_hour_interval');
    }, SYNC_INTERVAL_MS);

    if (this.timer.unref) {
      this.timer.unref(); // Do not prevent clean Node.js process exit
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const railwaySyncWorker = new RailwaySyncWorker();
