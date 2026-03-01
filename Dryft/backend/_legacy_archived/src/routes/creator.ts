import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

const createItemSchema = z.object({
  type: z.enum(['AVATAR', 'BACKGROUND', 'EFFECT', 'SOUND', 'GIFT']),
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  price: z.number().int().min(0),
  currency: z.enum(['USD', 'EUR', 'GBP']).optional(),
  thumbnail_url: z.string().url(),
  preview_url: z.string().url().optional(),
  asset_url: z.string().url(),
  tags: z.array(z.string()).optional(),
});

// =============================================================================
// Analytics
// =============================================================================

// Get creator analytics
router.get('/analytics', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case '7d': startDate.setDate(now.getDate() - 7); break;
      case '30d': startDate.setDate(now.getDate() - 30); break;
      case '90d': startDate.setDate(now.getDate() - 90); break;
      case 'all': startDate = new Date(0); break;
      default: startDate.setDate(now.getDate() - 30);
    }

    // Get creator's items
    const items = await prisma.storeItem.findMany({
      where: { creatorId: req.user!.id },
    });

    const itemIds = items.map(i => i.id);

    // Get purchases in period
    const purchases = await prisma.purchase.findMany({
      where: {
        itemId: { in: itemIds },
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
    });

    // Calculate metrics
    const totalRevenue = purchases.reduce((sum, p) => sum + p.amount, 0);
    const totalSales = purchases.length;
    const uniqueBuyers = new Set(purchases.map(p => p.buyerId)).size;

    // Get daily breakdown
    const dailyStats = new Map<string, { revenue: number; sales: number }>();
    purchases.forEach(p => {
      const day = p.completedAt!.toISOString().split('T')[0];
      const existing = dailyStats.get(day) || { revenue: 0, sales: 0 };
      existing.revenue += p.amount;
      existing.sales += 1;
      dailyStats.set(day, existing);
    });

    // Get top items
    const itemSales = new Map<string, { count: number; revenue: number }>();
    purchases.forEach(p => {
      const existing = itemSales.get(p.itemId) || { count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += p.amount;
      itemSales.set(p.itemId, existing);
    });

    const topItems = items
      .map(item => ({
        id: item.id,
        name: item.name,
        thumbnail_url: item.thumbnailUrl,
        sales: itemSales.get(item.id)?.count || 0,
        revenue: itemSales.get(item.id)?.revenue || 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    res.json({
      period,
      summary: {
        total_revenue: totalRevenue,
        total_sales: totalSales,
        unique_buyers: uniqueBuyers,
        total_items: items.length,
        average_price: items.length > 0
          ? Math.round(items.reduce((sum, i) => sum + i.price, 0) / items.length)
          : 0,
      },
      daily: Array.from(dailyStats.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      top_items: topItems,
    });
  } catch (error) {
    next(error);
  }
});

// Get earnings breakdown
router.get('/earnings', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { period = '30d' } = req.query;

    const now = new Date();
    let startDate = new Date();
    switch (period) {
      case '7d': startDate.setDate(now.getDate() - 7); break;
      case '30d': startDate.setDate(now.getDate() - 30); break;
      case '90d': startDate.setDate(now.getDate() - 90); break;
      default: startDate.setDate(now.getDate() - 30);
    }

    const items = await prisma.storeItem.findMany({
      where: { creatorId: req.user!.id },
    });

    const purchases = await prisma.purchase.findMany({
      where: {
        itemId: { in: items.map(i => i.id) },
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
    });

    const grossEarnings = purchases.reduce((sum, p) => sum + p.amount, 0);
    const platformFee = Math.round(grossEarnings * 0.15); // 15% platform fee
    const netEarnings = grossEarnings - platformFee;

    // Previous period for comparison
    const prevStartDate = new Date(startDate);
    const periodDays = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    prevStartDate.setDate(prevStartDate.getDate() - periodDays);

    const prevPurchases = await prisma.purchase.findMany({
      where: {
        itemId: { in: items.map(i => i.id) },
        status: 'COMPLETED',
        completedAt: { gte: prevStartDate, lt: startDate },
      },
    });

    const prevGrossEarnings = prevPurchases.reduce((sum, p) => sum + p.amount, 0);
    const growthPercent = prevGrossEarnings > 0
      ? Math.round(((grossEarnings - prevGrossEarnings) / prevGrossEarnings) * 100)
      : 0;

    res.json({
      period,
      gross_earnings: grossEarnings,
      platform_fee: platformFee,
      platform_fee_percent: 15,
      net_earnings: netEarnings,
      previous_period_earnings: prevGrossEarnings,
      growth_percent: growthPercent,
      currency: 'USD',
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Items Management
// =============================================================================

// Get creator's items
router.get('/items', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { status, type, sort = 'newest' } = req.query;

    const where: any = { creatorId: req.user!.id };
    if (status) where.status = status;
    if (type) where.type = type;

    const orderBy: any = {};
    switch (sort) {
      case 'sales': orderBy.purchaseCount = 'desc'; break;
      case 'rating': orderBy.rating = 'desc'; break;
      case 'price_low': orderBy.price = 'asc'; break;
      case 'price_high': orderBy.price = 'desc'; break;
      default: orderBy.createdAt = 'desc';
    }

    const items = await prisma.storeItem.findMany({
      where,
      orderBy,
    });

    res.json({
      items: items.map(item => ({
        id: item.id,
        type: item.type,
        name: item.name,
        description: item.description,
        price: item.price,
        currency: item.currency,
        thumbnail_url: item.thumbnailUrl,
        preview_url: item.previewUrl,
        asset_url: item.assetUrl,
        tags: item.tags,
        status: item.status,
        purchase_count: item.purchaseCount,
        rating: item.rating,
        rating_count: item.ratingCount,
        is_featured: item.isFeatured,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Create new item
router.post('/items', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = createItemSchema.parse(req.body);

    const item = await prisma.storeItem.create({
      data: {
        creatorId: req.user!.id,
        type: data.type,
        name: data.name,
        description: data.description,
        price: data.price,
        currency: data.currency || 'USD',
        thumbnailUrl: data.thumbnail_url,
        previewUrl: data.preview_url,
        assetUrl: data.asset_url,
        tags: data.tags || [],
        status: 'PENDING', // Requires approval
      },
    });

    res.status(201).json({
      id: item.id,
      status: item.status,
      message: 'Item submitted for review',
    });
  } catch (error) {
    next(error);
  }
});

// Update item
router.put('/items/:itemId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { itemId } = req.params;
    const data = createItemSchema.partial().parse(req.body);

    const item = await prisma.storeItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.creatorId !== req.user!.id) {
      throw new AppError(404, 'Item not found');
    }

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.thumbnail_url) updateData.thumbnailUrl = data.thumbnail_url;
    if (data.preview_url) updateData.previewUrl = data.preview_url;
    if (data.asset_url) updateData.assetUrl = data.asset_url;
    if (data.tags) updateData.tags = data.tags;

    // If approved item is updated, set back to pending for re-review
    if (item.status === 'APPROVED' && Object.keys(updateData).length > 0) {
      updateData.status = 'PENDING';
    }

    await prisma.storeItem.update({
      where: { id: itemId },
      data: updateData,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete item
router.delete('/items/:itemId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { itemId } = req.params;

    const item = await prisma.storeItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.creatorId !== req.user!.id) {
      throw new AppError(404, 'Item not found');
    }

    // Check if item has been purchased
    const purchaseCount = await prisma.purchase.count({
      where: { itemId, status: 'COMPLETED' },
    });

    if (purchaseCount > 0) {
      // Soft delete by setting status
      await prisma.storeItem.update({
        where: { id: itemId },
        data: { status: 'DELETED' },
      });
    } else {
      // Hard delete if no purchases
      await prisma.storeItem.delete({
        where: { id: itemId },
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Payouts
// =============================================================================

// Get payout history
router.get('/payouts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // In production, this would fetch from a payouts table
    // For now, return mock data
    res.json({
      payouts: [],
      pending_balance: 0,
      next_payout_date: null,
      payout_method: null,
    });
  } catch (error) {
    next(error);
  }
});

// Request payout
router.post('/payouts/request', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // In production, this would create a payout request
    res.json({
      success: true,
      message: 'Payout request submitted',
    });
  } catch (error) {
    next(error);
  }
});

// Update payout method
router.put('/payouts/method', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { method, details } = req.body;

    // In production, this would update the payout method
    // (Stripe Connect, PayPal, bank transfer, etc.)

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
