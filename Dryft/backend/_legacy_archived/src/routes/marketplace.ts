import { Router } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { purchaseRateLimit, searchRateLimit } from '../middleware/rateLimit.js';
import * as cache from '../services/cache.js';

const router = Router();
const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' });

// =============================================================================
// Store Items
// =============================================================================

// Get store items
router.get('/items', searchRateLimit, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const {
      type,
      category,
      search,
      featured,
      sort = 'popular',
      limit = '20',
      offset = '0',
    } = req.query;

    const where: any = { status: 'APPROVED' };
    if (type) where.type = type;
    if (featured === 'true') where.isFeatured = true;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { tags: { has: search as string } },
      ];
    }

    const orderBy: any = {};
    switch (sort) {
      case 'price_low': orderBy.price = 'asc'; break;
      case 'price_high': orderBy.price = 'desc'; break;
      case 'newest': orderBy.createdAt = 'desc'; break;
      case 'rating': orderBy.rating = 'desc'; break;
      default: orderBy.purchaseCount = 'desc';
    }

    const [items, total] = await Promise.all([
      prisma.storeItem.findMany({
        where,
        orderBy,
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        include: {
          creator: {
            select: { id: true, displayName: true, profilePhoto: true },
          },
        },
      }),
      prisma.storeItem.count({ where }),
    ]);

    // Check ownership
    const ownedItems = await prisma.inventoryItem.findMany({
      where: {
        userId: req.user!.id,
        itemId: { in: items.map(i => i.id) },
      },
    });
    const ownedIds = new Set(ownedItems.map(i => i.itemId));

    res.json({
      items: items.map(item => ({
        id: item.id,
        creator_id: item.creatorId,
        creator_name: item.creator.displayName,
        type: item.type,
        name: item.name,
        description: item.description,
        price: item.price,
        currency: item.currency,
        thumbnail_url: item.thumbnailUrl,
        preview_url: item.previewUrl,
        tags: item.tags,
        purchase_count: item.purchaseCount,
        rating: item.rating,
        rating_count: item.ratingCount,
        is_featured: item.isFeatured,
        is_owned: ownedIds.has(item.id),
      })),
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    next(error);
  }
});

// Get featured items
router.get('/featured', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Use cache-aside pattern for featured items
    const items = await cache.getOrSet(
      cache.CacheKeys.featuredItems(),
      async () => {
        return prisma.storeItem.findMany({
          where: { status: 'APPROVED', isFeatured: true },
          take: 10,
          include: {
            creator: {
              select: { id: true, displayName: true },
            },
          },
        });
      },
      cache.CacheTTL.MEDIUM // Cache for 5 minutes
    );

    res.json({ items });
  } catch (error) {
    next(error);
  }
});

// Get item by ID
router.get('/items/:itemId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { itemId } = req.params;

    // Cache the item data (not user-specific)
    const item = await cache.getOrSet(
      cache.CacheKeys.storeItem(itemId),
      async () => {
        return prisma.storeItem.findUnique({
          where: { id: itemId },
          include: {
            creator: {
              select: { id: true, displayName: true, profilePhoto: true },
            },
          },
        });
      },
      cache.CacheTTL.MEDIUM
    );

    if (!item) throw new AppError(404, 'Item not found');

    // Check ownership (user-specific, not cached)
    const owned = await prisma.inventoryItem.findUnique({
      where: {
        userId_itemId: { userId: req.user!.id, itemId: item.id },
      },
    });

    res.json({
      ...item,
      is_owned: !!owned,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Purchases
// =============================================================================

// Create purchase
router.post('/purchase', purchaseRateLimit, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { item_id } = req.body;

    const item = await prisma.storeItem.findUnique({
      where: { id: item_id },
    });

    if (!item) throw new AppError(404, 'Item not found');

    // Check if already owned
    const existing = await prisma.inventoryItem.findUnique({
      where: {
        userId_itemId: { userId: req.user!.id, itemId: item_id },
      },
    });

    if (existing) throw new AppError(409, 'Already owned');

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: item.price,
      currency: item.currency,
      metadata: {
        user_id: req.user!.id,
        item_id: item.id,
      },
    });

    // Create pending purchase
    const purchase = await prisma.purchase.create({
      data: {
        buyerId: req.user!.id,
        sellerId: item.creatorId,
        itemId: item.id,
        amount: item.price,
        currency: item.currency,
        stripePaymentId: paymentIntent.id,
        status: 'PENDING',
      },
    });

    res.json({
      purchase_id: purchase.id,
      client_secret: paymentIntent.client_secret,
      amount: item.price,
      currency: item.currency,
    });
  } catch (error) {
    next(error);
  }
});

// Confirm purchase (webhook or client callback)
router.post('/purchase/confirm', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { purchase_id, payment_intent_id } = req.body;

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchase_id },
    });

    if (!purchase || purchase.buyerId !== req.user!.id) {
      throw new AppError(404, 'Purchase not found');
    }

    // Verify with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      throw new AppError(400, 'Payment not completed');
    }

    // Update purchase and add to inventory
    await prisma.$transaction([
      prisma.purchase.update({
        where: { id: purchase_id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
      prisma.inventoryItem.create({
        data: {
          userId: req.user!.id,
          itemId: purchase.itemId,
          purchaseId: purchase.id,
        },
      }),
      prisma.storeItem.update({
        where: { id: purchase.itemId },
        data: { purchaseCount: { increment: 1 } },
      }),
    ]);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Inventory
// =============================================================================

// Get user inventory
router.get('/inventory', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { userId: req.user!.id },
      include: { item: true },
      orderBy: { acquiredAt: 'desc' },
    });

    res.json({
      items: items.map(inv => ({
        id: inv.id,
        user_id: inv.userId,
        item_id: inv.itemId,
        is_equipped: inv.isEquipped,
        acquired_at: inv.acquiredAt,
        item: inv.item,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Equip/unequip item
router.post('/inventory/:itemId/equip', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { itemId } = req.params;
    const { equipped } = req.body;

    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: {
        userId_itemId: { userId: req.user!.id, itemId },
      },
    });

    if (!inventoryItem) throw new AppError(404, 'Item not in inventory');

    await prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { isEquipped: equipped },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// NOTE: Stripe Webhook moved to /routes/webhooks.ts
// Webhook URL: POST /v1/webhooks/stripe
// =============================================================================

export default router;
