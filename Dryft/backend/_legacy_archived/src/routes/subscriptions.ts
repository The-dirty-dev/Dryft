import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  SUBSCRIPTION_PLANS,
  createSubscription,
  cancelSubscription,
  getSubscription,
} from '../services/stripe.js';

const router = Router();

// Get available plans
router.get('/plans', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({
      plans: SUBSCRIPTION_PLANS.map(plan => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// Get current subscription
router.get('/current', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        subscriptionId: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionTier: true,
        subscriptionEndsAt: true,
      },
    });

    if (!user?.subscriptionId) {
      res.json({
        active: false,
        tier: 'FREE',
      });
      return;
    }

    // Get fresh status from Stripe
    const subscription = await getSubscription(user.subscriptionId);

    res.json({
      active: subscription?.status === 'active',
      tier: user.subscriptionTier,
      plan_id: user.subscriptionPlan,
      status: subscription?.status || user.subscriptionStatus,
      current_period_end: subscription?.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : user.subscriptionEndsAt?.toISOString(),
      cancel_at_period_end: subscription?.cancel_at_period_end,
    });
  } catch (error) {
    next(error);
  }
});

// Subscribe to a plan
router.post('/subscribe', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { plan_id, payment_method_id } = req.body;

    if (!plan_id || !payment_method_id) {
      throw new AppError(400, 'Plan ID and payment method required');
    }

    const plan = SUBSCRIPTION_PLANS.find(p => p.id === plan_id);
    if (!plan) {
      throw new AppError(400, 'Invalid plan');
    }

    // Check if already subscribed
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { subscriptionId: true, email: true },
    });

    if (user?.subscriptionId) {
      const existing = await getSubscription(user.subscriptionId);
      if (existing?.status === 'active') {
        throw new AppError(409, 'Already subscribed');
      }
    }

    // Create subscription
    const subscription = await createSubscription({
      userId: req.user!.id,
      email: user!.email,
      planId: plan_id,
      paymentMethodId: payment_method_id,
    });

    // Update user
    const tier = plan_id.includes('platinum') ? 'VIP' : 'PLUS';
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionPlan: plan_id,
        subscriptionTier: tier,
        subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
      },
    });

    // Return client secret if payment needed
    const invoice = subscription.latest_invoice as any;
    const clientSecret = invoice?.payment_intent?.client_secret;

    res.json({
      subscription_id: subscription.id,
      status: subscription.status,
      client_secret: clientSecret,
    });
  } catch (error) {
    next(error);
  }
});

// Cancel subscription
router.post('/cancel', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { subscriptionId: true },
    });

    if (!user?.subscriptionId) {
      throw new AppError(404, 'No active subscription');
    }

    await cancelSubscription(user.subscriptionId);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        subscriptionStatus: 'canceled',
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Check premium features
router.get('/features', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    const isActive =
      user?.subscriptionStatus === 'active' &&
      user?.subscriptionEndsAt &&
      user.subscriptionEndsAt > new Date();

    const tier = isActive ? user?.subscriptionTier : 'FREE';

    // Define features by tier
    const features = {
      unlimited_likes: tier !== 'FREE',
      see_who_liked: tier !== 'FREE',
      advanced_filters: tier !== 'FREE',
      priority_discovery: tier !== 'FREE',
      no_ads: tier !== 'FREE',
      unlimited_rewinds: tier === 'VIP' || tier === 'PREMIUM',
      super_likes_per_day: tier === 'FREE' ? 1 : tier === 'PLUS' ? 3 : 5,
      message_before_match: tier === 'VIP',
      incognito_mode: tier === 'VIP',
      vip_badge: tier === 'VIP',
      read_receipts: tier !== 'FREE',
      priority_support: tier === 'VIP',
    };

    res.json({
      tier,
      is_premium: tier !== 'FREE',
      features,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
