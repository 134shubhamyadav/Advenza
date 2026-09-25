import { Queue, Worker } from 'bullmq';
import { getRedisClient, isRedisAvailable } from './redis.js';
import { generateReel } from '../reels/reel-engine.js';
import Reel from '../../models/Reel.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

const QUEUE_NAME = 'reel-rendering';
const isProd = env.NODE_ENV === 'production';

let reelQueue = null;
let reelWorker = null;

// In-memory fallback queue for local development when Redis is not running
const memoryQueue = [];
let isProcessingMemoryQueue = false;

/**
 * Process a job payload through the reel engine and update MongoDB.
 */
async function processReelJob(jobData, updateProgressFn = () => {}) {
  const { reelId, userId, tripId, memories, template, aspectRatio, resolution, targetDuration, musicPreset, customAudioUrl, textConfig } = jobData;

  logger.info(`Starting reel rendering for reelId: ${reelId}`);

  await Reel.findByIdAndUpdate(reelId, {
    status: 'processing',
    stage: 'initializing',
    progress: 5,
    startedAt: new Date()
  });

  const progressHandler = async ({ percent, stage, message }) => {
    try {
      await Reel.findByIdAndUpdate(reelId, {
        progress: percent,
        stage: stage,
        statusMessage: message
      });
      updateProgressFn(percent);
    } catch (e) {
      logger.warn(`Failed to update reel progress in DB for ${reelId}:`, e.message);
    }
  };

  try {
    const result = await generateReel({
      reelId,
      userId,
      tripId,
      memories,
      template,
      aspectRatio,
      resolution,
      targetDuration,
      musicPreset,
      customAudioUrl,
      textConfig,
      onProgress: progressHandler
    });

    await Reel.findByIdAndUpdate(reelId, {
      status: 'completed',
      stage: 'completed',
      progress: 100,
      'output.videoUrl': result.videoUrl,
      'output.storageKey': result.storageKey,
      'output.fileSizeBytes': result.fileSizeBytes,
      'output.renderTimeMs': result.renderTimeMs,
      duration: Math.round(result.duration),
      completedAt: new Date()
    });

    logger.info(`Reel ${reelId} rendered successfully in ${result.renderTimeMs}ms. URL: ${result.videoUrl}`);
    return result;
  } catch (err) {
    logger.error(`Reel ${reelId} generation failed:`, err);
    await Reel.findByIdAndUpdate(reelId, {
      status: 'failed',
      stage: 'failed',
      error: err.message || 'Video processing failed',
      completedAt: new Date()
    });
    throw err;
  }
}

/**
 * In-memory fallback worker loop (Strictly development/test only)
 */
async function processNextMemoryJob() {
  if (isProcessingMemoryQueue || memoryQueue.length === 0) return;
  isProcessingMemoryQueue = true;

  const job = memoryQueue.shift();
  try {
    await processReelJob(job.data);
  } catch (err) {
    logger.error(`[Development Fallback] Memory queue job ${job.data?.reelId} failed:`, err.message);
  } finally {
    isProcessingMemoryQueue = false;
    if (memoryQueue.length > 0) {
      setImmediate(processNextMemoryJob);
    }
  }
}

/**
 * Initialize Queue and Worker
 */
export function initReelQueue() {
  const redis = getRedisClient();

  if (isRedisAvailable() && redis) {
    try {
      reelQueue = new Queue(QUEUE_NAME, {
        connection: redis,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 200 }
        }
      });

      reelWorker = new Worker(
        QUEUE_NAME,
        async (job) => {
          return await processReelJob(job.data, (p) => job.updateProgress(p));
        },
        {
          connection: redis,
          concurrency: 1 // Single concurrency per worker to manage CPU/memory deterministically
        }
      );

      reelWorker.on('completed', (job) => {
        logger.info(`BullMQ reel job completed: ${job.id}`);
      });

      reelWorker.on('failed', (job, err) => {
        logger.error(`BullMQ reel job failed (attempt ${job?.attemptsMade}): ${job?.id}`, err?.message);
      });

      reelWorker.on('error', (err) => {
        logger.error('[BullMQ Worker Error]:', err?.message);
      });

      logger.info('Reels BullMQ queue and worker initialized with Redis');
    } catch (err) {
      logger.warn('Failed to initialize BullMQ with Redis:', err.message);
      reelQueue = null;
      reelWorker = null;
    }
  } else {
    if (isProd) {
      logger.warn('[BullMQ] Redis is not configured in production. Media queue is marked NOT_CONFIGURED.');
    } else {
      logger.info('[BullMQ] Redis not available in development. Reels will use in-memory asynchronous worker fallback.');
    }
  }
}

/**
 * Add a reel rendering job to the queue
 */
export async function addReelJob(jobData) {
  // If Redis & BullMQ are connected, use BullMQ
  if (reelQueue && isRedisAvailable()) {
    try {
      const job = await reelQueue.add('render-reel', jobData, {
        jobId: `reel_${jobData.reelId}`
      });
      return { queued: true, type: 'bullmq', jobId: job.id };
    } catch (e) {
      logger.warn('Failed to enqueue to BullMQ:', e.message);
      if (isProd) {
        throw new Error(`Production queue failure: ${e.message}`);
      }
    }
  }

  // IN PRODUCTION: Do NOT silently use an in-memory queue.
  if (isProd) {
    const errorMsg = 'Redis is not configured. Production requires a Redis instance for media processing queues.';
    logger.error(`[ReelQueue Production Error]: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // DEVELOPMENT / TEST ONLY: In-memory fallback
  logger.info(`[ReelQueue] Development fallback: Enqueueing reel ${jobData.reelId} to local in-memory worker.`);
  memoryQueue.push({ id: `mem_${jobData.reelId}`, data: jobData });
  setImmediate(processNextMemoryJob);
  return { queued: true, type: 'development_memory_fallback', jobId: `mem_${jobData.reelId}` };
}

/**
 * Health check reporter for BullMQ & worker
 */
export async function getReelQueueHealth() {
  if (isProd && !env.REDIS_URL) {
    return {
      status: 'NOT_CONFIGURED',
      provider: 'BullMQ / Redis',
      message: 'Redis is not configured. Media queue is inactive in production.',
      isLive: false
    };
  }

  if (reelQueue && isRedisAvailable()) {
    try {
      const counts = await reelQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
      return {
        status: 'HEALTHY',
        provider: 'BullMQ / Redis',
        message: 'BullMQ queue and worker operational.',
        isLive: true,
        jobs: counts
      };
    } catch (err) {
      return {
        status: 'DEGRADED',
        provider: 'BullMQ / Redis',
        message: `Queue query error: ${err.message}`,
        isLive: false
      };
    }
  }

  return {
    status: isProd ? 'UNAVAILABLE' : 'DEGRADED',
    provider: isProd ? 'BullMQ / Redis' : 'In-Memory Fallback (Dev)',
    message: isProd
      ? 'Redis queue is disconnected or unavailable.'
      : 'Running in development mode using local asynchronous worker.',
    isLive: false
  };
}

/**
 * Shutdown queue & worker gracefully
 */
export async function closeReelQueue() {
  if (reelWorker) {
    try {
      await reelWorker.close();
    } catch (e) {
      logger.warn('Error closing reel worker:', e.message);
    }
  }
  if (reelQueue) {
    try {
      await reelQueue.close();
    } catch (e) {
      logger.warn('Error closing reel queue:', e.message);
    }
  }
}

