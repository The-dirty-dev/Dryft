import request from 'supertest';
import { app } from '../index';
import { prisma, cleanupTestData } from './setup';
import bcrypt from 'bcryptjs';

const API_PREFIX = '/v1';

describe('Matching API', () => {
  let user1Token: string;
  let user2Token: string;
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;

  beforeEach(async () => {
    await cleanupTestData();

    const passwordHash = await bcrypt.hash('Password123!', 10);

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: 'user1@example.com',
        passwordHash,
        displayName: 'User One',
        gender: 'MALE',
        birthDate: new Date('1995-01-01'),
      },
    });
    user1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: 'user2@example.com',
        passwordHash,
        displayName: 'User Two',
        gender: 'FEMALE',
        birthDate: new Date('1996-01-01'),
      },
    });
    user2Id = user2.id;

    const user3 = await prisma.user.create({
      data: {
        email: 'user3@example.com',
        passwordHash,
        displayName: 'User Three',
        gender: 'FEMALE',
        birthDate: new Date('1997-01-01'),
      },
    });
    user3Id = user3.id;

    // Create preferences
    await prisma.preferences.createMany({
      data: [
        { userId: user1Id, genderPreference: ['FEMALE'] },
        { userId: user2Id, genderPreference: ['MALE'] },
        { userId: user3Id, genderPreference: ['MALE'] },
      ],
    });

    // Login users
    const login1 = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: 'user1@example.com', password: 'Password123!' });
    user1Token = login1.body.access_token;

    const login2 = await request(app)
      .post(`${API_PREFIX}/auth/login`)
      .send({ email: 'user2@example.com', password: 'Password123!' });
    user2Token = login2.body.access_token;
  });

  describe('GET /matching/discover', () => {
    it('should return discovery profiles', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/matching/discover`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profiles');
      expect(Array.isArray(response.body.profiles)).toBe(true);
    });

    it('should exclude already swiped users', async () => {
      // User1 swipes left on User2
      await prisma.swipe.create({
        data: {
          swiperId: user1Id,
          swipedId: user2Id,
          direction: 'LEFT',
        },
      });

      const response = await request(app)
        .get(`${API_PREFIX}/matching/discover`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      const profileIds = response.body.profiles.map((p: any) => p.id);
      expect(profileIds).not.toContain(user2Id);
    });

    it('should exclude blocked users', async () => {
      await prisma.block.create({
        data: {
          blockerId: user1Id,
          blockedId: user2Id,
        },
      });

      const response = await request(app)
        .get(`${API_PREFIX}/matching/discover`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      const profileIds = response.body.profiles.map((p: any) => p.id);
      expect(profileIds).not.toContain(user2Id);
    });
  });

  describe('POST /matching/swipe', () => {
    it('should create a swipe left', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/matching/swipe`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          user_id: user2Id,
          direction: 'left',
        });

      expect(response.status).toBe(200);
      expect(response.body.matched).toBe(false);

      // Verify swipe was created
      const swipe = await prisma.swipe.findUnique({
        where: {
          swiperId_swipedId: {
            swiperId: user1Id,
            swipedId: user2Id,
          },
        },
      });
      expect(swipe).not.toBeNull();
      expect(swipe?.direction).toBe('LEFT');
    });

    it('should create a swipe right without match', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/matching/swipe`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          user_id: user2Id,
          direction: 'right',
        });

      expect(response.status).toBe(200);
      expect(response.body.matched).toBe(false);
    });

    it('should create a match when both swipe right', async () => {
      // User2 swipes right on User1 first
      await prisma.swipe.create({
        data: {
          swiperId: user2Id,
          swipedId: user1Id,
          direction: 'RIGHT',
        },
      });

      // User1 swipes right on User2
      const response = await request(app)
        .post(`${API_PREFIX}/matching/swipe`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          user_id: user2Id,
          direction: 'right',
        });

      expect(response.status).toBe(200);
      expect(response.body.matched).toBe(true);
      expect(response.body).toHaveProperty('match_id');
      expect(response.body).toHaveProperty('matched_user');

      // Verify match was created
      const match = await prisma.match.findUnique({
        where: { id: response.body.match_id },
      });
      expect(match).not.toBeNull();

      // Verify conversation was created
      const conversation = await prisma.conversation.findFirst({
        where: { matchId: response.body.match_id },
      });
      expect(conversation).not.toBeNull();
    });

    it('should reject duplicate swipe', async () => {
      // First swipe
      await request(app)
        .post(`${API_PREFIX}/matching/swipe`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          user_id: user2Id,
          direction: 'right',
        });

      // Duplicate swipe
      const response = await request(app)
        .post(`${API_PREFIX}/matching/swipe`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          user_id: user2Id,
          direction: 'left',
        });

      expect(response.status).toBe(409);
    });

    it('should handle super like', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/matching/swipe`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          user_id: user2Id,
          direction: 'right',
          is_super_like: true,
        });

      expect(response.status).toBe(200);

      const swipe = await prisma.swipe.findUnique({
        where: {
          swiperId_swipedId: {
            swiperId: user1Id,
            swipedId: user2Id,
          },
        },
      });
      expect(swipe?.isSuperLike).toBe(true);
    });
  });

  describe('GET /matching/matches', () => {
    beforeEach(async () => {
      // Create a match between user1 and user2
      await prisma.swipe.createMany({
        data: [
          { swiperId: user1Id, swipedId: user2Id, direction: 'RIGHT' },
          { swiperId: user2Id, swipedId: user1Id, direction: 'RIGHT' },
        ],
      });

      const match = await prisma.match.create({
        data: {
          user1Id,
          user2Id,
        },
      });

      await prisma.conversation.create({
        data: {
          matchId: match.id,
          participants: {
            create: [
              { userId: user1Id },
              { userId: user2Id },
            ],
          },
        },
      });
    });

    it('should return user matches', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/matching/matches`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('matches');
      expect(response.body.matches.length).toBe(1);
      expect(response.body.matches[0].user.id).toBe(user2Id);
    });
  });

  describe('POST /matching/unmatch/:matchId', () => {
    let matchId: string;

    beforeEach(async () => {
      const match = await prisma.match.create({
        data: {
          user1Id,
          user2Id,
        },
      });
      matchId = match.id;
    });

    it('should unmatch successfully', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/matching/unmatch/${matchId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const match = await prisma.match.findUnique({
        where: { id: matchId },
      });
      expect(match?.unmatched).toBe(true);
      expect(match?.unmatchedBy).toBe(user1Id);
    });

    it('should reject unmatch from non-participant', async () => {
      const passwordHash = await bcrypt.hash('Password123!', 10);
      const otherUser = await prisma.user.create({
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
        .post(`${API_PREFIX}/matching/unmatch/${matchId}`)
        .set('Authorization', `Bearer ${login.body.access_token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /matching/likes', () => {
    beforeEach(async () => {
      // User2 and User3 like User1
      await prisma.swipe.createMany({
        data: [
          { swiperId: user2Id, swipedId: user1Id, direction: 'RIGHT' },
          { swiperId: user3Id, swipedId: user1Id, direction: 'RIGHT', isSuperLike: true },
        ],
      });
    });

    it('should return users who liked current user', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/matching/likes`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('profiles');
      expect(response.body.profiles.length).toBe(2);
      expect(response.body).toHaveProperty('count', 2);
    });
  });
});
