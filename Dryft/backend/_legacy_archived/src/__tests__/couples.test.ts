import request from 'supertest';
import { app } from '../index';
import { prisma, cleanupTestData } from './setup';
import bcrypt from 'bcryptjs';

const API_PREFIX = '/v1';

describe('Couples API', () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;

  beforeEach(async () => {
    await cleanupTestData();

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: 'partner1@example.com',
        passwordHash,
        displayName: 'Partner One',
      },
    });
    user1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: 'partner2@example.com',
        passwordHash,
        displayName: 'Partner Two',
      },
    });
    user2Id = user2.id;

    // Login users
    const login1 = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: 'partner1@example.com', password: 'Password123!' });
    user1Token = login1.body.access_token;

    const login2 = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: 'partner2@example.com', password: 'Password123!' });
    user2Token = login2.body.access_token;
  });

  describe('POST /couples/invite', () => {
    it('should send couple invite', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/couples/invite`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_email: 'partner2@example.com',
          relationship_type: 'DATING',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('invite_code');
      expect(response.body).toHaveProperty('couple_id');

      // Verify couple was created
      const couple = await prisma.couple.findUnique({
        where: { id: response.body.couple_id },
      });
      expect(couple).not.toBeNull();
      expect(couple?.status).toBe('PENDING');
    });

    it('should reject invite to non-existent email', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/couples/invite`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_email: 'nonexistent@example.com',
          relationship_type: 'DATING',
        });

      expect(response.status).toBe(404);
    });

    it('should reject duplicate invite', async () => {
      // First invite
      await request(app)
        .post(`${API_PREFIX}/couples/invite`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_email: 'partner2@example.com',
        });

      // Duplicate invite
      const response = await request(app)
        .post(`${API_PREFIX}/couples/invite`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_email: 'partner2@example.com',
        });

      expect(response.status).toBe(409);
    });
  });

  describe('POST /couples/accept', () => {
    let inviteCode: string;

    beforeEach(async () => {
      // User1 sends invite to User2
      const inviteResponse = await request(app)
        .post(`${API_PREFIX}/couples/invite`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_email: 'partner2@example.com',
        });
      inviteCode = inviteResponse.body.invite_code;
    });

    it('should accept couple invite', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/couples/accept`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ invite_code: inviteCode });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('couple');

      // Verify couple is now active
      const couple = await prisma.couple.findFirst({
        where: {
          OR: [
            { partner1Id: user1Id, partner2Id: user2Id },
            { partner1Id: user2Id, partner2Id: user1Id },
          ],
        },
      });
      expect(couple?.status).toBe('ACTIVE');
    });

    it('should reject invalid invite code', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/couples/accept`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ invite_code: 'INVALID123' });

      expect(response.status).toBe(404);
    });

    it('should reject invite acceptance by wrong user', async () => {
      // Create third user
      const passwordHash = await bcrypt.hash('Password123!', 10);
      await prisma.user.create({
        data: {
          email: 'other@example.com',
          passwordHash,
          displayName: 'Other User',
        },
      });

      const login = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({ email: 'other@example.com', password: 'Password123!' });

      const response = await request(app)
        .post(`${API_PREFIX}/couples/accept`)
        .set('Authorization', `Bearer ${login.body.access_token}`)
        .send({ invite_code: inviteCode });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /couples/dashboard', () => {
    beforeEach(async () => {
      // Create active couple
      await prisma.couple.create({
        data: {
          partner1Id: user1Id,
          partner2Id: user2Id,
          status: 'ACTIVE',
          xp: 500,
          level: 6,
          currentStreak: 7,
          longestStreak: 14,
          relationshipScore: 250,
          startDate: new Date('2024-01-01'),
        },
      });
    });

    it('should return couple dashboard', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/couples/dashboard`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('couple');
      expect(response.body).toHaveProperty('partner');
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats.xp).toBe(500);
      expect(response.body.stats.level).toBe(6);
      expect(response.body.stats.streak).toBe(7);
    });

    it('should return 404 if no active couple', async () => {
      // Delete the couple
      await prisma.couple.deleteMany();

      const response = await request(app)
        .get(`${API_PREFIX}/couples/dashboard`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('Milestones', () => {
    let coupleId: string;

    beforeEach(async () => {
      const couple = await prisma.couple.create({
        data: {
          partner1Id: user1Id,
          partner2Id: user2Id,
          status: 'ACTIVE',
        },
      });
      coupleId = couple.id;
    });

    it('should add a milestone', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/couples/milestones`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'ANNIVERSARY',
          title: 'Our Anniversary',
          date: '2024-06-15',
          description: 'One year together!',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('milestone');
      expect(response.body.milestone.title).toBe('Our Anniversary');
    });

    it('should get milestones', async () => {
      // Create a milestone
      await prisma.coupleMilestone.create({
        data: {
          coupleId,
          type: 'FIRST_KISS',
          title: 'First Kiss',
          date: new Date('2024-01-15'),
        },
      });

      const response = await request(app)
        .get(`${API_PREFIX}/couples/milestones`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('milestones');
      expect(response.body.milestones.length).toBe(1);
    });
  });

  describe('Memories', () => {
    let coupleId: string;

    beforeEach(async () => {
      const couple = await prisma.couple.create({
        data: {
          partner1Id: user1Id,
          partner2Id: user2Id,
          status: 'ACTIVE',
        },
      });
      coupleId = couple.id;
    });

    it('should add a memory', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/couples/memories`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Beach Trip',
          description: 'Our first trip together',
          photo_urls: ['https://example.com/photo1.jpg'],
          date: '2024-03-10',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('memory');
      expect(response.body.memory.title).toBe('Beach Trip');
    });

    it('should get memories with pagination', async () => {
      // Create multiple memories
      for (let i = 0; i < 5; i++) {
        await prisma.coupleMemory.create({
          data: {
            coupleId,
            createdById: user1Id,
            title: `Memory ${i}`,
            date: new Date(),
          },
        });
      }

      const response = await request(app)
        .get(`${API_PREFIX}/couples/memories?limit=3`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.memories.length).toBe(3);
    });
  });
});

describe('Activities API', () => {
  let userToken: string;
  let userId: string;
  let partnerId: string;
  let coupleId: string;
  let activityId: string;

  beforeEach(async () => {
    await cleanupTestData();

    const passwordHash = await bcrypt.hash('Password123!', 10);

    const user = await prisma.user.create({
      data: {
        email: 'activityuser@example.com',
        passwordHash,
        displayName: 'Activity User',
      },
    });
    userId = user.id;

    const partner = await prisma.user.create({
      data: {
        email: 'activitypartner@example.com',
        passwordHash,
        displayName: 'Activity Partner',
      },
    });
    partnerId = partner.id;

    const couple = await prisma.couple.create({
      data: {
        partner1Id: userId,
        partner2Id: partnerId,
        status: 'ACTIVE',
      },
    });
    coupleId = couple.id;

    // Create test activity
    const activity = await prisma.coupleActivity.create({
      data: {
        title: 'Test Activity',
        description: 'A test activity',
        category: 'COMMUNICATION',
        difficulty: 'EASY',
        duration: 15,
        xpReward: 50,
        isActive: true,
        requiresBoth: false,
      },
    });
    activityId = activity.id;

    const login = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: 'activityuser@example.com', password: 'Password123!' });
    userToken = login.body.access_token;
  });

  describe('GET /activities', () => {
    it('should return available activities', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/activities`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activities');
      expect(response.body.activities.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/activities?category=COMMUNICATION`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      response.body.activities.forEach((a: any) => {
        expect(a.category).toBe('COMMUNICATION');
      });
    });
  });

  describe('POST /activities/:activityId/start', () => {
    it('should start an activity', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/activities/${activityId}/start`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('completion_id');
    });

    it('should not duplicate in-progress activity', async () => {
      // Start first time
      const first = await request(app)
        .post(`${API_PREFIX}/activities/${activityId}/start`)
        .set('Authorization', `Bearer ${userToken}`);

      // Start again
      const second = await request(app)
        .post(`${API_PREFIX}/activities/${activityId}/start`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(second.status).toBe(200);
      expect(second.body.already_started).toBe(true);
      expect(second.body.completion_id).toBe(first.body.completion_id);
    });
  });

  describe('POST /activities/:activityId/submit', () => {
    it('should complete activity and earn XP', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/activities/${activityId}/submit`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          response: 'My response',
          rating: 5,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.completed).toBe(true);
      expect(response.body.xp_earned).toBe(50);

      // Verify couple XP was updated
      const couple = await prisma.couple.findUnique({
        where: { id: coupleId },
      });
      expect(couple?.xp).toBe(50);
    });
  });
});
