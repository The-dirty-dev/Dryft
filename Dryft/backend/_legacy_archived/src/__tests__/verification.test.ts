import request from 'supertest';
import { app } from '../index';
import { prisma, cleanupTestData, createTestUser, authHeader } from './setup';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';

const API_PREFIX = '/v1';

function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, config.jwt.secret, { expiresIn: '1h' });
}

describe('Verification API', () => {
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    await cleanupTestData();
    testUser = await createTestUser({
      email: 'verify@example.com',
      verified: false,
      verificationStatus: 'UNVERIFIED',
    });
    authToken = generateToken(testUser.id, testUser.email);
  });

  describe('POST /verification/start', () => {
    it('should start a new verification session', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/verification/start`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('session_id');
      expect(response.body).toHaveProperty('challenges');
      expect(response.body).toHaveProperty('expires_at');
      expect(response.body.challenges).toBeInstanceOf(Array);
      expect(response.body.challenges.length).toBeGreaterThan(0);
    });

    it('should reject if user is already verified', async () => {
      // Update user to verified
      await prisma.user.update({
        where: { id: testUser.id },
        data: { verified: true, verificationStatus: 'VERIFIED' },
      });

      const response = await request(app)
        .post(`${API_PREFIX}/verification/start`)
        .set(authHeader(authToken));

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Already verified');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/verification/start`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /verification/status', () => {
    it('should return unverified status for new user', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/verification/status`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(false);
      expect(response.body.status).toBe('unverified');
    });

    it('should return verified status for verified user', async () => {
      const verifiedAt = new Date();
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          verified: true,
          verifiedAt,
          verificationStatus: 'VERIFIED',
        },
      });

      const response = await request(app)
        .get(`${API_PREFIX}/verification/status`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.verified).toBe(true);
      expect(response.body.status).toBe('verified');
      expect(response.body.badge).toBeDefined();
    });

    it('should return pending status', async () => {
      await prisma.user.update({
        where: { id: testUser.id },
        data: { verificationStatus: 'PENDING' },
      });

      const response = await request(app)
        .get(`${API_PREFIX}/verification/status`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('pending');
    });
  });

  describe('POST /verification/challenge/complete', () => {
    it('should reject without session_id', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/verification/challenge/complete`)
        .set(authHeader(authToken))
        .send({
          challenge_id: 'test-challenge',
          image_data: 'base64data',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('session_id');
    });

    it('should reject invalid session', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/verification/challenge/complete`)
        .set(authHeader(authToken))
        .send({
          session_id: 'invalid-session',
          challenge_id: 'test-challenge',
          image_data: 'base64data',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /verification/cancel', () => {
    it('should cancel verification session', async () => {
      // Start a session first
      const startResponse = await request(app)
        .post(`${API_PREFIX}/verification/start`)
        .set(authHeader(authToken));

      const sessionId = startResponse.body.session_id;

      // Cancel the session
      const response = await request(app)
        .post(`${API_PREFIX}/verification/cancel`)
        .set(authHeader(authToken))
        .send({ session_id: sessionId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should succeed even without session_id', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/verification/cancel`)
        .set(authHeader(authToken))
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
