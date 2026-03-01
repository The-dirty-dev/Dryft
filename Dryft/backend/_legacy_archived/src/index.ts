import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
// SEC-006: CSRF protection middleware (used for web-based admin panel)
import { getCsrfTokenHandler, csrfProtection } from './middleware/csrf.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import matchingRoutes from './routes/matching.js';
import chatRoutes from './routes/chat.js';
import storyRoutes from './routes/stories.js';
import marketplaceRoutes from './routes/marketplace.js';
import giftRoutes from './routes/gifts.js';
import notificationRoutes from './routes/notifications.js';
import verificationRoutes from './routes/verification.js';
import creatorRoutes from './routes/creator.js';
import mapRoutes from './routes/map.js';
import pushRoutes from './routes/push.js';
import subscriptionRoutes from './routes/subscriptions.js';
import uploadRoutes from './routes/uploads.js';
import adminRoutes from './routes/admin.js';

// Couples & Gamification Routes
import coupleRoutes from './routes/couples.js';
import activityRoutes from './routes/activities.js';
import quizRoutes from './routes/quizzes.js';
import dateRoutes from './routes/dates.js';
import achievementRoutes from './routes/achievements.js';
import timelineRoutes from './routes/timeline.js';
import rewardRoutes from './routes/rewards.js';

// Monetization Routes
import coupleSubscriptionRoutes from './routes/coupleSubscription.js';
import tipsRoutes from './routes/tips.js';
import seasonPassRoutes from './routes/seasonPass.js';
import sharedSubscriptionRoutes from './routes/sharedSubscription.js';

// Safety & Moderation Routes
import moderationRoutes from './routes/moderation.js';
import scamDetectionRoutes from './routes/scamDetection.js';

// Socket handlers
import { initializeSocket } from './services/socket.js';

// Cache
import { initializeCache, closeCache } from './services/cache.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketServer(httpServer, {
  cors: {
    origin: config.security.corsOrigins,
    methods: ['GET', 'POST'],
  },
});

// =============================================================================
// Middleware
// =============================================================================

// Security
app.use(helmet());
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// =============================================================================
// Webhook Routes (MUST be before JSON body parser)
// =============================================================================
// Stripe webhooks need the raw body for signature verification
import webhookRoutes from './routes/webhooks.js';
app.use(`/${config.apiVersion}/webhooks`, express.raw({ type: 'application/json' }), webhookRoutes);

// Body parsing (for all other routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// SEC-006: Cookie parser for CSRF token handling
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// =============================================================================
// Health Check
// =============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.apiVersion,
  });
});

// SEC-006: CSRF token endpoint for web clients
// Mobile apps using Bearer tokens can skip CSRF
app.get('/csrf-token', getCsrfTokenHandler);

// =============================================================================
// API Routes
// =============================================================================

const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/matching', matchingRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/stories', storyRoutes);
apiRouter.use('/marketplace', marketplaceRoutes);
apiRouter.use('/gifts', giftRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/verification', verificationRoutes);
apiRouter.use('/creator', creatorRoutes);
apiRouter.use('/map', mapRoutes);
apiRouter.use('/push', pushRoutes);
apiRouter.use('/subscriptions', subscriptionRoutes);
apiRouter.use('/uploads', uploadRoutes);
apiRouter.use('/admin', adminRoutes);

// Couples & Gamification
apiRouter.use('/couples', coupleRoutes);
apiRouter.use('/activities', activityRoutes);
apiRouter.use('/quizzes', quizRoutes);
apiRouter.use('/dates', dateRoutes);
apiRouter.use('/achievements', achievementRoutes);
apiRouter.use('/timeline', timelineRoutes);
apiRouter.use('/rewards', rewardRoutes);

// Monetization
apiRouter.use('/couple-subscription', coupleSubscriptionRoutes);
apiRouter.use('/tips', tipsRoutes);
apiRouter.use('/season-pass', seasonPassRoutes);
apiRouter.use('/shared-subscription', sharedSubscriptionRoutes);

// Safety & Moderation
apiRouter.use('/moderation', moderationRoutes);
apiRouter.use('/scam-detection', scamDetectionRoutes);

app.use(`/${config.apiVersion}`, apiRouter);

// =============================================================================
// Error Handling
// =============================================================================

app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// =============================================================================
// Socket.IO
// =============================================================================

initializeSocket(io);

// =============================================================================
// Server Start
// =============================================================================

async function startServer() {
  // Initialize cache
  await initializeCache();

  httpServer.listen(config.port, () => {
    logger.info(`🚀 Drift API server running on port ${config.port}`);
    logger.info(`📍 Environment: ${config.env}`);
    logger.info(`🔗 Health check: http://localhost:${config.port}/health`);
  });
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await closeCache();
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, io };
