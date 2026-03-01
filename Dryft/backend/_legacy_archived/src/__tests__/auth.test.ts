import request from 'supertest';
import { app } from '../index';
import { prisma, cleanupTestData, createTestUser } from './setup';
import bcrypt from 'bcryptjs';

const API_PREFIX = '/v1';

describe('Auth API', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: 'newuser@example.com',
          password: 'Password123!',
          display_name: 'New User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe('newuser@example.com');
    });

    it('should reject duplicate email', async () => {
      await createTestUser({ email: 'existing@example.com' });

      const response = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: 'existing@example.com',
          password: 'Password123!',
          display_name: 'Another User',
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: 'newuser@example.com',
          password: '123',
          display_name: 'New User',
        });

      expect(response.status).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/auth/register`)
        .send({
          email: 'not-an-email',
          password: 'Password123!',
          display_name: 'New User',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a user with known password
      const passwordHash = await bcrypt.hash('TestPassword123!', 10);
      await prisma.user.create({
        data: {
          email: 'testlogin@example.com',
          passwordHash,
          displayName: 'Test Login User',
        },
      });
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: 'testlogin@example.com',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body.user.email).toBe('testlogin@example.com');
    });

    it('should reject incorrect password', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: 'testlogin@example.com',
          password: 'WrongPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-existent email', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('TestPassword123!', 10);
      await prisma.user.create({
        data: {
          email: 'refreshtest@example.com',
          passwordHash,
          displayName: 'Refresh Test User',
        },
      });

      // Login to get refresh token
      const loginResponse = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: 'refreshtest@example.com',
          password: 'TestPassword123!',
        });

      refreshToken = loginResponse.body.refresh_token;
    });

    it('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .send({ refresh_token: refreshToken });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/auth/refresh`)
        .send({ refresh_token: 'invalid-token' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const passwordHash = await bcrypt.hash('TestPassword123!', 10);
      const user = await prisma.user.create({
        data: {
          email: 'metest@example.com',
          passwordHash,
          displayName: 'Me Test User',
        },
      });
      userId = user.id;

      const loginResponse = await request(app)
        .post(`${API_PREFIX}/auth/login`)
        .send({
          email: 'metest@example.com',
          password: 'TestPassword123!',
        });

      accessToken = loginResponse.body.access_token;
    });

    it('should return current user info', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/auth/me`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(userId);
      expect(response.body.user.email).toBe('metest@example.com');
    });

    it('should reject unauthorized request', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/auth/me`);

      expect(response.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/auth/me`)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
