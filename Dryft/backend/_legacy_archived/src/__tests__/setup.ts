import { PrismaClient } from '@prisma/client';

// Use test database
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient();

beforeAll(async () => {
  // Connect to database
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Helper to clean up test data
export async function cleanupTestData() {
  const deleteOrder = [
    'adminAction',
    'quizAttempt',
    'coupleActivityCompletion',
    'userAchievement',
    'datePlan',
    'coupleMemory',
    'coupleMilestone',
    'couple',
    'storyView',
    'story',
    'message',
    'conversationParticipant',
    'conversation',
    'match',
    'swipe',
    'gift',
    'notification',
    'pushToken',
    'report',
    'block',
    'userPhoto',
    'preferences',
    'profile',
    'session',
    'inventoryItem',
    'purchase',
    'storeItem',
    'payment',
    'user',
  ];

  for (const table of deleteOrder) {
    try {
      await (prisma as any)[table].deleteMany({});
    } catch {
      // Table might not exist or have cascade
    }
  }
}

// Helper to create test user
export async function createTestUser(overrides: any = {}) {
  const timestamp = Date.now();
  return prisma.user.create({
    data: {
      email: `test-${timestamp}@example.com`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuuZ', // dummy hash
      displayName: `Test User ${timestamp}`,
      ...overrides,
    },
  });
}

// Helper to create authenticated request
export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export { prisma };
