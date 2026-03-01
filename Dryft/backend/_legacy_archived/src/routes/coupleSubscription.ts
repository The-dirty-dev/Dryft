import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  SUBSCRIPTION_PLANS,
  createSubscription,
  cancelSubscription,
  getSubscription,
  getOrCreateCustomer,
} from '../services/stripe.js';

const router = Router();

// Couples Premium Plans
const COUPLES_PLANS = SUBSCRIPTION_PLANS.filter(p => p.id.startsWith('couples_'));

// =============================================================================
// Get Couples Premium Plans
// =============================================================================

router.get('/plans', authenticate, async (req: AuthRequest, res, next) => {
  try {
    res.json({
      plans: COUPLES_PLANS.map(plan => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        currency: plan.currency,
        interval: plan.interval,
        features: plan.features,
        price_formatted: `$${(plan.price / 100).toFixed(2)}`,
        monthly_equivalent: plan.interval === 'year'
          ? `$${(plan.price / 12 / 100).toFixed(2)}/mo`
          : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Get Current Couple Subscription
// =============================================================================

router.get('/current', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
      include: {
        partner1: { select: { id: true, displayName: true } },
        partner2: { select: { id: true, displayName: true } },
      },
    });

    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    if (!couple.subscriptionId) {
      res.json({
        active: false,
        tier: 'FREE',
        couple_id: couple.id,
      });
      return;
    }

    // Get fresh status from Stripe
    const subscription = await getSubscription(couple.subscriptionId);

    res.json({
      active: subscription?.status === 'active',
      tier: couple.premiumTier,
      status: subscription?.status || couple.subscriptionStatus,
      current_period_end: subscription?.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : couple.subscriptionEndsAt?.toISOString(),
      cancel_at_period_end: subscription?.cancel_at_period_end,
      couple_id: couple.id,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Subscribe to Couples Premium
// =============================================================================

router.post('/subscribe', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { plan_id, payment_method_id } = req.body;

    if (!plan_id || !payment_method_id) {
      throw new AppError(400, 'Plan ID and payment method required');
    }

    const plan = COUPLES_PLANS.find(p => p.id === plan_id);
    if (!plan) {
      throw new AppError(400, 'Invalid couples plan');
    }

    // Get couple
    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
    });

    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    // Check if already subscribed
    if (couple.subscriptionId) {
      const existing = await getSubscription(couple.subscriptionId);
      if (existing?.status === 'active') {
        throw new AppError(409, 'Couple already has an active subscription');
      }
    }

    // Get user for email
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { email: true },
    });

    // Create subscription (using user's payment, attached to couple)
    const subscription = await createSubscription({
      userId: req.user!.id,
      email: user!.email,
      planId: plan_id,
      paymentMethodId: payment_method_id,
    });

    // Update couple with subscription info
    await prisma.couple.update({
      where: { id: couple.id },
      data: {
        premiumTier: 'PREMIUM',
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
      },
    });

    // Notify both partners
    const partnerIds = [couple.partner1Id, couple.partner2Id];
    await prisma.notification.createMany({
      data: partnerIds.map(partnerId => ({
        userId: partnerId,
        type: 'SYSTEM' as const,
        title: 'Couples Premium Activated!',
        body: 'Your relationship just got premium! Enjoy exclusive features together.',
      })),
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

// =============================================================================
// Cancel Couples Premium
// =============================================================================

router.post('/cancel', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
    });

    if (!couple?.subscriptionId) {
      throw new AppError(404, 'No active subscription');
    }

    await cancelSubscription(couple.subscriptionId);

    await prisma.couple.update({
      where: { id: couple.id },
      data: {
        subscriptionStatus: 'canceled',
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Premium Features Check
// =============================================================================

router.get('/features', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
    });

    if (!couple) {
      res.json({ has_couple: false, features: {} });
      return;
    }

    const isPremium =
      couple.premiumTier === 'PREMIUM' &&
      couple.subscriptionStatus === 'active' &&
      couple.subscriptionEndsAt &&
      couple.subscriptionEndsAt > new Date();

    const features = {
      unlimited_activities: isPremium,
      unlimited_quizzes: isPremium,
      premium_date_ideas: isPremium,
      custom_milestone_themes: isPremium,
      relationship_insights: isPremium,
      xp_multiplier: isPremium ? 2 : 1,
      exclusive_badges: isPremium,
      priority_support: isPremium,
      anniversary_reminders: isPremium,
      ad_free: isPremium,
      // Free features
      basic_activities: true,
      basic_quizzes: true,
      milestones: true,
      memories: true,
      timeline: true,
    };

    res.json({
      has_couple: true,
      is_premium: isPremium,
      tier: couple.premiumTier,
      features,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
