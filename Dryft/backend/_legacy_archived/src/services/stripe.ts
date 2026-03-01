import Stripe from 'stripe';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

// Initialize Stripe
const stripe = new Stripe(config.stripe.secretKey, {
  apiVersion: '2023-10-16',
});

// =============================================================================
// Customer Management
// =============================================================================

export async function getOrCreateCustomer(userId: string, email: string): Promise<string> {
  // Check if user already has a Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  // Save customer ID to user
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// =============================================================================
// Payment Intents
// =============================================================================

export async function createPaymentIntent(params: {
  userId: string;
  email: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.PaymentIntent> {
  const customerId = await getOrCreateCustomer(params.userId, params.email);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: params.amount,
    currency: params.currency,
    customer: customerId,
    metadata: {
      userId: params.userId,
      ...params.metadata,
    },
    automatic_payment_methods: {
      enabled: true,
    },
  });

  return paymentIntent;
}

export async function confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

// =============================================================================
// Subscriptions (Premium Features)
// =============================================================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'drift_plus_monthly',
    name: 'Drift+',
    price: 999, // $9.99
    currency: 'usd',
    interval: 'month',
    features: [
      'Unlimited likes',
      'See who liked you',
      'Advanced filters',
      'Priority in discovery',
      'No ads',
    ],
  },
  {
    id: 'drift_plus_yearly',
    name: 'Drift+ (Annual)',
    price: 7999, // $79.99
    currency: 'usd',
    interval: 'year',
    features: [
      'All Drift+ features',
      'Save 33%',
      'VIP badge',
    ],
  },
  {
    id: 'drift_platinum_monthly',
    name: 'Drift Platinum',
    price: 2999, // $29.99
    currency: 'usd',
    interval: 'month',
    features: [
      'All Drift+ features',
      'Unlimited rewinds',
      '5 Super Likes per day',
      'Message before matching',
      'Incognito mode',
      'Priority support',
    ],
  },
  // Couples Premium Plans
  {
    id: 'couples_premium_monthly',
    name: 'Couples Premium',
    price: 1499, // $14.99
    currency: 'usd',
    interval: 'month',
    features: [
      'Shared relationship timeline',
      'Unlimited activities & quizzes',
      'Premium date ideas',
      'Exclusive couple badges',
      'Priority couple support',
      '2x XP on all activities',
      'Custom milestone themes',
    ],
  },
  {
    id: 'couples_premium_yearly',
    name: 'Couples Premium (Annual)',
    price: 11999, // $119.99
    currency: 'usd',
    interval: 'year',
    features: [
      'All Couples Premium features',
      'Save 33%',
      'Anniversary gift reminder',
      'Exclusive yearly badge',
      'Relationship insights report',
    ],
  },
];

export async function createSubscription(params: {
  userId: string;
  email: string;
  planId: string;
  paymentMethodId: string;
}): Promise<Stripe.Subscription> {
  const plan = SUBSCRIPTION_PLANS.find(p => p.id === params.planId);
  if (!plan) {
    throw new Error('Invalid plan ID');
  }

  const customerId = await getOrCreateCustomer(params.userId, params.email);

  // Attach payment method to customer
  await stripe.paymentMethods.attach(params.paymentMethodId, {
    customer: customerId,
  });

  // Set as default payment method
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: params.paymentMethodId,
    },
  });

  // Create or retrieve price
  const price = await getOrCreatePrice(plan);

  // Create subscription
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
    metadata: {
      userId: params.userId,
      planId: params.planId,
    },
    expand: ['latest_invoice.payment_intent'],
  });

  return subscription;
}

export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.cancel(subscriptionId);
}

export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    return null;
  }
}

async function getOrCreatePrice(plan: SubscriptionPlan): Promise<Stripe.Price> {
  // Try to find existing price
  const prices = await stripe.prices.list({
    lookup_keys: [plan.id],
    limit: 1,
  });

  if (prices.data.length > 0) {
    return prices.data[0];
  }

  // Create product first
  const product = await stripe.products.create({
    name: plan.name,
    metadata: { planId: plan.id },
  });

  // Create price
  return stripe.prices.create({
    product: product.id,
    unit_amount: plan.price,
    currency: plan.currency,
    recurring: { interval: plan.interval },
    lookup_key: plan.id,
  });
}

// =============================================================================
// Webhook Handling
// =============================================================================

export function constructWebhookEvent(
  payload: Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    config.stripe.webhookSecret
  );
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case 'invoice.payment_succeeded':
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case 'invoice.payment_failed':
      await handleInvoiceFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      logger.debug(`Unhandled webhook event: ${event.type}`);
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  logger.info(`Payment succeeded: ${paymentIntent.id}`);

  const { userId, itemId, purchaseId } = paymentIntent.metadata;

  if (purchaseId) {
    // Update marketplace purchase
    await prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Add to inventory
    if (userId && itemId) {
      await prisma.inventoryItem.create({
        data: {
          userId,
          itemId,
          purchaseId,
        },
      });

      await prisma.storeItem.update({
        where: { id: itemId },
        data: { purchaseCount: { increment: 1 } },
      });
    }
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  logger.warn(`Payment failed: ${paymentIntent.id}`);

  const { purchaseId } = paymentIntent.metadata;

  if (purchaseId) {
    await prisma.purchase.update({
      where: { id: purchaseId },
      data: { status: 'FAILED' },
    });
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const { userId, planId } = subscription.metadata;
  logger.info(`Subscription created: ${subscription.id} for user ${userId}`);

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        subscriptionPlan: planId,
        subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
      },
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Welcome to Premium!',
        body: 'Your subscription is now active. Enjoy all premium features!',
      },
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const { userId } = subscription.metadata;
  logger.info(`Subscription updated: ${subscription.id}`);

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: subscription.status,
        subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
      },
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const { userId } = subscription.metadata;
  logger.info(`Subscription cancelled: ${subscription.id}`);

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionId: null,
        subscriptionStatus: 'canceled',
        subscriptionPlan: null,
      },
    });

    // Send notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        title: 'Subscription Ended',
        body: 'Your premium subscription has ended. Resubscribe to continue enjoying premium features.',
      },
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  logger.info(`Invoice paid: ${invoice.id}`);
  // Additional logic for invoice payments if needed
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  logger.warn(`Invoice payment failed: ${invoice.id}`);

  // Notify user about failed payment
  const customer = invoice.customer as string;
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customer },
  });

  if (user) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'SYSTEM',
        title: 'Payment Failed',
        body: 'We couldn\'t process your subscription payment. Please update your payment method.',
      },
    });
  }
}

// =============================================================================
// Tipping
// =============================================================================

export const TIP_AMOUNTS = [
  { id: 'tip_small', amount: 100, label: '$1' },
  { id: 'tip_medium', amount: 500, label: '$5' },
  { id: 'tip_large', amount: 1000, label: '$10' },
  { id: 'tip_xlarge', amount: 2500, label: '$25' },
  { id: 'tip_custom', amount: 0, label: 'Custom' },
];

export async function createTipPayment(params: {
  senderId: string;
  senderEmail: string;
  recipientId: string;
  recipientConnectId: string;
  amount: number;
  message?: string;
}): Promise<Stripe.PaymentIntent> {
  const customerId = await getOrCreateCustomer(params.senderId, params.senderEmail);

  // Platform takes 10% fee
  const platformFee = Math.round(params.amount * 0.10);
  const transferAmount = params.amount - platformFee;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: params.amount,
    currency: 'usd',
    customer: customerId,
    metadata: {
      type: 'tip',
      senderId: params.senderId,
      recipientId: params.recipientId,
      message: params.message || '',
    },
    transfer_data: {
      destination: params.recipientConnectId,
      amount: transferAmount,
    },
    automatic_payment_methods: {
      enabled: true,
    },
  });

  return paymentIntent;
}

// =============================================================================
// Connect (for Creator Payouts)
// =============================================================================

export async function createConnectAccount(userId: string, email: string): Promise<Stripe.Account> {
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    metadata: { userId },
    capabilities: {
      transfers: { requested: true },
    },
  });

  // Save account ID to user
  await prisma.user.update({
    where: { id: userId },
    data: { stripeConnectId: account.id },
  });

  return account;
}

export async function createConnectAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

export async function createPayout(params: {
  connectAccountId: string;
  amount: number;
  currency: string;
}): Promise<Stripe.Transfer> {
  return stripe.transfers.create({
    amount: params.amount,
    currency: params.currency,
    destination: params.connectAccountId,
  });
}

export default stripe;
