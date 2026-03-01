import dotenv from 'dotenv';

dotenv.config();

// =============================================================================
// Configuration Validation (SEC-013, ERR-005)
// =============================================================================

const MIN_JWT_SECRET_LENGTH = 32;

function validateConfig() {
  const errors: string[] = [];

  // Required environment variables
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET is required');
  } else if (process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters for security`);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    errors.push('STRIPE_SECRET_KEY is required');
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    errors.push('STRIPE_WEBHOOK_SECRET is required');
  }

  // Throw all errors at once for better DX
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n  - ${errors.join('\n  - ')}`);
  }
}

// Validate on module load (will fail fast at startup)
validateConfig();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  apiVersion: process.env.API_VERSION || 'v1',

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET!,
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.AWS_S3_BUCKET || 'drift-uploads',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // JSON service account key (alternative to individual fields)
    serviceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
  },

  apns: {
    keyId: process.env.APNS_KEY_ID,
    teamId: process.env.APNS_TEAM_ID,
    bundleId: process.env.APNS_BUNDLE_ID || 'com.drift.app',
  },

  email: {
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    from: process.env.EMAIL_FROM || 'noreply@drift.app',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },

  security: {
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:19006'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
} as const;

export default config;
