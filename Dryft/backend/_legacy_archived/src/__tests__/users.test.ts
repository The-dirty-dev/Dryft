import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../index';
import { prisma, cleanupTestData, authHeader } from './setup';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';

const API_PREFIX = '/v1';

function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, config.jwt.secret, { expiresIn: '1h' });
}

// Create test user with real password hash
async function createUserWithPassword(email: string, password: string, overrides: any = {}) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: 'Test User',
      ...overrides,
    },
  });
}

describe('Users API', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('DELETE /users/me (Account Deletion)', () => {
    it('should delete account with correct password', async () => {
      const password = 'TestPassword123!';
      const user = await createUserWithPassword('delete-me@example.com', password);
      const token = generateToken(user.id, user.email);

      const response = await request(app)
        .delete(`${API_PREFIX}/users/me`)
        .set(authHeader(token))
        .send({ password });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted');

      // Verify user is soft-deleted
      const deletedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(deletedUser?.deletedAt).not.toBeNull();
      expect(deletedUser?.email).toContain('deleted_');
      expect(deletedUser?.displayName).toBe('Deleted User');
    });

    it('should reject with incorrect password', async () => {
      const user = await createUserWithPassword('keep-me@example.com', 'CorrectPassword123!');
      const token = generateToken(user.id, user.email);

      const response = await request(app)
        .delete(`${API_PREFIX}/users/me`)
        .set(authHeader(token))
        .send({ password: 'WrongPassword123!' });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Incorrect password');

      // Verify user still exists
      const existingUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(existingUser?.deletedAt).toBeNull();
    });

    it('should reject without password', async () => {
      const user = await createUserWithPassword('no-pass@example.com', 'TestPassword123!');
      const token = generateToken(user.id, user.email);

      const response = await request(app)
        .delete(`${API_PREFIX}/users/me`)
        .set(authHeader(token))
        .send({});

      expect(response.status).toBe(400);
    });

    it('should accept optional deletion reason', async () => {
      const password = 'TestPassword123!';
      const user = await createUserWithPassword('reason@example.com', password);
      const token = generateToken(user.id, user.email);

      const response = await request(app)
        .delete(`${API_PREFIX}/users/me`)
        .set(authHeader(token))
        .send({
          password,
          reason: 'Found a partner, no longer need the app',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should clear all sessions on deletion', async () => {
      const password = 'TestPassword123!';
      const user = await createUserWithPassword('sessions@example.com', password);
      const token = generateToken(user.id, user.email);

      // Create some sessions
      await prisma.session.createMany({
        data: [
          { userId: user.id, refreshToken: 'token1', expiresAt: new Date(Date.now() + 86400000) },
          { userId: user.id, refreshToken: 'token2', expiresAt: new Date(Date.now() + 86400000) },
        ],
      });

      await request(app)
        .delete(`${API_PREFIX}/users/me`)
        .set(authHeader(token))
        .send({ password });

      // Verify sessions are deleted
      const sessions = await prisma.session.findMany({
        where: { userId: user.id },
      });
      expect(sessions).toHaveLength(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`${API_PREFIX}/users/me`)
        .send({ password: 'anything' });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /users/profile', () => {
    it('should update user profile', async () => {
      const user = await createUserWithPassword('profile@example.com', 'Password123!');
      const token = generateToken(user.id, user.email);

      const response = await request(app)
        .patch(`${API_PREFIX}/users/profile`)
        .set(authHeader(token))
        .send({
          displayName: 'Updated Name',
          bio: 'New bio text',
        });

      expect(response.status).toBe(200);
      expect(response.body.display_name).toBe('Updated Name');
      expect(response.body.bio).toBe('New bio text');
    });

    it('should validate display name length', async () => {
      const user = await createUserWithPassword('validate@example.com', 'Password123!');
      const token = generateToken(user.id, user.email);

      const response = await request(app)
        .patch(`${API_PREFIX}/users/profile`)
        .set(authHeader(token))
        .send({
          displayName: 'A', // Too short
        });

      expect(response.status).toBe(400);
    });

    it('should validate bio length', async () => {
      const user = await createUserWithPassword('bio@example.com', 'Password123!');
      const token = generateToken(user.id, user.email);

      const response = await request(app)
        .patch(`${API_PREFIX}/users/profile`)
        .set(authHeader(token))
        .send({
          bio: 'a'.repeat(501), // Too long
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /users/location', () => {
    it('should update user location', async () => {
      const user = await createUserWithPassword('location@example.com', 'Password123!');
      const token = generateToken(user.id, user.email);

      const response = await request(app)
        .patch(`${API_PREFIX}/users/location`)
        .set(authHeader(token))
        .send({
          latitude: 40.7128,
          longitude: -74.006,
          city: 'New York',
          country: 'USA',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser?.latitude).toBeCloseTo(40.7128);
      expect(updatedUser?.city).toBe('New York');
    });

    it('should validate latitude range', async () => {
      const user = await createUserWithPassword('lat@example.com', 'Password123!');
      const token = generateToken(user.id, user.email);

      const response = await request(app)
        .patch(`${API_PREFIX}/users/location`)
        .set(authHeader(token))
        .send({
          latitude: 100, // Invalid
          longitude: 0,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /users/:userId', () => {
    it('should return user profile', async () => {
      const targetUser = await createUserWithPassword('target@example.com', 'Password123!', {
        displayName: 'Target User',
        bio: 'Hello world',
      });
      const viewer = await createUserWithPassword('viewer@example.com', 'Password123!');
      const token = generateToken(viewer.id, viewer.email);

      const response = await request(app)
        .get(`${API_PREFIX}/users/${targetUser.id}`)
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.display_name).toBe('Target User');
      expect(response.body.bio).toBe('Hello world');
      // Should not include sensitive data
      expect(response.body.email).toBeUndefined();
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('should return 404 for deleted user', async () => {
      const deletedUser = await createUserWithPassword('deleted@example.com', 'Password123!', {
        deletedAt: new Date(),
      });
      const viewer = await createUserWithPassword('viewer2@example.com', 'Password123!');
      const token = generateToken(viewer.id, viewer.email);

      const response = await request(app)
        .get(`${API_PREFIX}/users/${deletedUser.id}`)
        .set(authHeader(token));

      expect(response.status).toBe(404);
    });

    it('should return 404 for blocked user', async () => {
      const blockedUser = await createUserWithPassword('blocked@example.com', 'Password123!');
      const blocker = await createUserWithPassword('blocker@example.com', 'Password123!');
      const token = generateToken(blocker.id, blocker.email);

      // Create block
      await prisma.block.create({
        data: {
          blockerId: blocker.id,
          blockedId: blockedUser.id,
        },
      });

      const response = await request(app)
        .get(`${API_PREFIX}/users/${blockedUser.id}`)
        .set(authHeader(token));

      expect(response.status).toBe(404);
    });
  });
});
