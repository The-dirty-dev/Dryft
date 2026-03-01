import request from 'supertest';
import { app } from '../index';
import { prisma, cleanupTestData, createTestUser, authHeader } from './setup';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';

const API_PREFIX = '/v1';

// Helper to generate auth token for test user
function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, config.jwt.secret, { expiresIn: '1h' });
}

// Helper to create a test store item
async function createTestStoreItem(creatorId: string, overrides: any = {}) {
  return prisma.storeItem.create({
    data: {
      creatorId,
      type: 'AVATAR',
      name: 'Test Item',
      description: 'A test item for testing',
      price: 999, // $9.99 in cents
      currency: 'usd',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      status: 'APPROVED',
      ...overrides,
    },
  });
}

describe('Marketplace API', () => {
  let testUser: any;
  let testCreator: any;
  let authToken: string;
  let creatorToken: string;

  beforeEach(async () => {
    await cleanupTestData();

    // Create test users
    testUser = await createTestUser({ email: 'buyer@example.com' });
    testCreator = await createTestUser({
      email: 'creator@example.com',
      isCreator: true,
    });

    authToken = generateToken(testUser.id, testUser.email);
    creatorToken = generateToken(testCreator.id, testCreator.email);
  });

  describe('GET /marketplace/items', () => {
    it('should return empty list when no items exist', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/items`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should return approved items only', async () => {
      // Create approved item
      await createTestStoreItem(testCreator.id, { status: 'APPROVED' });
      // Create pending item (should not be returned)
      await createTestStoreItem(testCreator.id, {
        status: 'PENDING',
        name: 'Pending Item',
      });

      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/items`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe('Test Item');
    });

    it('should filter by type', async () => {
      await createTestStoreItem(testCreator.id, { type: 'AVATAR' });
      await createTestStoreItem(testCreator.id, { type: 'ACCESSORY', name: 'Accessory' });

      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/items?type=AVATAR`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].type).toBe('AVATAR');
    });

    it('should search items by name', async () => {
      await createTestStoreItem(testCreator.id, { name: 'Cool Hat' });
      await createTestStoreItem(testCreator.id, { name: 'Fancy Shoes' });

      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/items?search=hat`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe('Cool Hat');
    });

    it('should paginate results', async () => {
      // Create 5 items
      for (let i = 0; i < 5; i++) {
        await createTestStoreItem(testCreator.id, { name: `Item ${i}` });
      }

      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/items?limit=2&offset=0`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(2);
      expect(response.body.total).toBe(5);
      expect(response.body.limit).toBe(2);
      expect(response.body.offset).toBe(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/items`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /marketplace/items/:itemId', () => {
    it('should return item details', async () => {
      const item = await createTestStoreItem(testCreator.id);

      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/items/${item.id}`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(item.id);
      expect(response.body.name).toBe('Test Item');
      expect(response.body.is_owned).toBe(false);
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/items/non-existent-id`)
        .set(authHeader(authToken));

      expect(response.status).toBe(404);
    });

    it('should indicate if user owns the item', async () => {
      const item = await createTestStoreItem(testCreator.id);

      // Add to user's inventory
      await prisma.inventoryItem.create({
        data: {
          userId: testUser.id,
          itemId: item.id,
        },
      });

      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/items/${item.id}`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.is_owned).toBe(true);
    });
  });

  describe('GET /marketplace/featured', () => {
    it('should return featured items', async () => {
      await createTestStoreItem(testCreator.id, { isFeatured: true });
      await createTestStoreItem(testCreator.id, { isFeatured: false, name: 'Regular' });

      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/featured`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].isFeatured).toBe(true);
    });
  });

  describe('POST /marketplace/purchase', () => {
    it('should reject purchase of already owned item', async () => {
      const item = await createTestStoreItem(testCreator.id);

      // Add to inventory first
      await prisma.inventoryItem.create({
        data: {
          userId: testUser.id,
          itemId: item.id,
        },
      });

      const response = await request(app)
        .post(`${API_PREFIX}/marketplace/purchase`)
        .set(authHeader(authToken))
        .send({ item_id: item.id });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('Already owned');
    });

    it('should reject purchase of non-existent item', async () => {
      const response = await request(app)
        .post(`${API_PREFIX}/marketplace/purchase`)
        .set(authHeader(authToken))
        .send({ item_id: 'non-existent-id' });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /marketplace/inventory', () => {
    it('should return user inventory', async () => {
      const item = await createTestStoreItem(testCreator.id);

      await prisma.inventoryItem.create({
        data: {
          userId: testUser.id,
          itemId: item.id,
        },
      });

      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/inventory`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].item_id).toBe(item.id);
    });

    it('should return empty inventory for new user', async () => {
      const response = await request(app)
        .get(`${API_PREFIX}/marketplace/inventory`)
        .set(authHeader(authToken));

      expect(response.status).toBe(200);
      expect(response.body.items).toEqual([]);
    });
  });

  describe('POST /marketplace/inventory/:itemId/equip', () => {
    it('should equip an owned item', async () => {
      const item = await createTestStoreItem(testCreator.id);

      await prisma.inventoryItem.create({
        data: {
          userId: testUser.id,
          itemId: item.id,
          isEquipped: false,
        },
      });

      const response = await request(app)
        .post(`${API_PREFIX}/marketplace/inventory/${item.id}/equip`)
        .set(authHeader(authToken))
        .send({ equipped: true });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify in database
      const inventoryItem = await prisma.inventoryItem.findFirst({
        where: { userId: testUser.id, itemId: item.id },
      });
      expect(inventoryItem?.isEquipped).toBe(true);
    });

    it('should reject equipping unowned item', async () => {
      const item = await createTestStoreItem(testCreator.id);

      const response = await request(app)
        .post(`${API_PREFIX}/marketplace/inventory/${item.id}/equip`)
        .set(authHeader(authToken))
        .send({ equipped: true });

      expect(response.status).toBe(404);
    });
  });
});
