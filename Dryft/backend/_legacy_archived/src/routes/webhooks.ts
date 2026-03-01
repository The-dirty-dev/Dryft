import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

// =============================================================================
// Stripe Webhook Handler
// =============================================================================
// This route receives the RAW body (not JSON parsed) for signature verification
// The raw body middleware is applied in index.ts before this route is registered

router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  if (!sig) {
    logger.warn('Stripe webhook received without signature');
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    // req.body is raw Buffer here (not parsed JSON)
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.stripe.webhookSecret
    );
  } catch (err: any) {
    // Log detailed error server-side, return generic message to client (SEC-010)
    logger.error('Stripe webhook signature verification failed:', {
      error: err.message,
      stack: err.stack
    });
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  logger.info(`Stripe webhook received: ${event.type}`);

  try {
    switch (event.type) {
      // =======================================================================
      // Payment Events
      // =======================================================================
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(paymentIntent);
        break;
      }

      // =======================================================================
      // Subscription Events
      // =======================================================================
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoiceFailed(invoice);
        break;
      }

      // =======================================================================
      // Connect (Creator Payouts)
      // =======================================================================
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await handleConnectAccountUpdate(account);
        break;
      }

      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;
        logger.info(`Payout completed: ${payout.id}`);
        break;
      }

      default:
        logger.debug(`Unhandled webhook event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    // Log full error details server-side (ERR-002)
    logger.error('Webhook handler error:', {
      eventType: event.type,
      eventId: event.id,
      error: error.message,
      stack: error.stack
    });
    // Return 500 so Stripe will retry failed events
    res.status(500).json({ error: 'Internal handler error' });
  }
});

// =============================================================================
// Payment Handlers
// =============================================================================

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { user_id, item_id, type } = paymentIntent.metadata;

  logger.info(`Payment succeeded: ${paymentIntent.id} for user ${user_id}`);

  // ARCH-004: Wrap all operations in a transaction for consistency
  await prisma.$transaction(async (tx) => {
    // Record payment
    await tx.payment.create({
      data: {
        userId: user_id,
        stripePaymentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        type: (type as any) || 'MARKETPLACE',
        status: 'COMPLETED',
      },
    });

    // Handle marketplace purchase
    if (item_id) {
      const purchase = await tx.purchase.findFirst({
        where: { stripePaymentId: paymentIntent.id },
      });

      if (purchase && purchase.status === 'PENDING') {
        await tx.purchase.update({
          where: { id: purchase.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });

        await tx.inventoryItem.create({
          data: {
            userId: user_id,
            itemId: item_id,
            purchaseId: purchase.id,
          },
        });

        await tx.storeItem.update({
          where: { id: item_id },
          data: { purchaseCount: { increment: 1 } },
        });

        logger.info(`Purchase completed: ${purchase.id}`);
      }
    }
  });
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { user_id } = paymentIntent.metadata;

  logger.warn(`Payment failed: ${paymentIntent.id} for user ${user_id}`);

  // ARCH-004: Wrap in transaction for consistency
  await prisma.$transaction(async (tx) => {
    // Update any pending purchase
    await tx.purchase.updateMany({
      where: { stripePaymentId: paymentIntent.id },
      data: { status: 'FAILED' },
    });

    // Record failed payment
    await tx.payment.create({
      data: {
        userId: user_id,
        stripePaymentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        type: 'MARKETPLACE',
        status: 'FAILED',
      },
    });
  });
}

// =============================================================================
// Subscription Handlers
// =============================================================================

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    logger.warn(`No user found for Stripe customer: ${customerId}`);
    return;
  }

  // Map Stripe price to subscription tier
  const priceId = subscription.items.data[0]?.price?.id;
  let tier: 'FREE' | 'PREMIUM' | 'VIP' = 'FREE';

  if (priceId === config.stripe.premiumPriceId) {
    tier = 'PREMIUM';
  } else if (priceId === config.stripe.vipPriceId) {
    tier = 'VIP';
  }

  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionTier: isActive ? tier : 'FREE',
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionExpiresAt: new Date(subscription.current_period_end * 1000),
    },
  });

  logger.info(`Subscription updated for user ${user.id}: ${tier} (${subscription.status})`);
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionTier: 'FREE',
      subscriptionStatus: 'canceled',
      subscriptionExpiresAt: new Date(subscription.current_period_end * 1000),
    },
  });

  logger.info(`Subscription canceled for user ${user.id}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) return;

  // Record successful payment
  await prisma.payment.create({
    data: {
      userId: user.id,
      stripePaymentId: invoice.payment_intent as string,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      type: 'SUBSCRIPTION',
      status: 'COMPLETED',
    },
  });

  logger.info(`Invoice paid for user ${user.id}: ${invoice.amount_paid}`);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) return;

  // Notify user about failed payment (could trigger email/push)
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: 'SYSTEM',
      title: 'Payment Failed',
      body: 'Your subscription payment failed. Please update your payment method.',
    },
  });

  logger.warn(`Invoice payment failed for user ${user.id}`);
}

// =============================================================================
// Connect Account Handlers
// =============================================================================

async function handleConnectAccountUpdate(account: Stripe.Account) {
  const user = await prisma.user.findFirst({
    where: { stripeConnectId: account.id },
  });

  if (!user) return;

  // Check if account is fully onboarded
  const isOnboarded = account.details_submitted && account.charges_enabled;

  if (isOnboarded && !user.isCreator) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isCreator: true,
        creatorTier: 'BASIC',
      },
    });

    logger.info(`User ${user.id} became a creator`);
  }
}

export default router;
