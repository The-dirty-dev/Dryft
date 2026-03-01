import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { randomBytes } from 'crypto';
import * as push from '../services/push.js';

const router = Router();

// =============================================================================
// Configuration
// =============================================================================

// Maximum shared members by subscription tier
const SHARING_LIMITS: Record<string, number> = {
  FREE: 0,
  PLUS: 0,
  PREMIUM: 1,
  VIP: 2,
};

// =============================================================================
// Schemas
// =============================================================================

const inviteSchema = z.object({
  email: z.string().email(),
});

// =============================================================================
// Helper Functions
// =============================================================================

function generateInviteCode(): string {
  return randomBytes(16).toString('hex');
}

async function getActiveSubscriptionTier(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionTier: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
    },
  });

  if (!user) return 'FREE';

  // Check if subscription is active
  if (user.subscriptionTier !== 'FREE') {
    const isActive = user.subscriptionStatus === 'active' &&
      (!user.subscriptionEndsAt || user.subscriptionEndsAt > new Date());
    if (!isActive) return 'FREE';
  }

  return user.subscriptionTier;
}

// =============================================================================
// Get Sharing Status
// =============================================================================

router.get('/status', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const tier = await getActiveSubscriptionTier(userId);
    const maxSlots = SHARING_LIMITS[tier] || 0;

    // Check if user owns a shared subscription
    const ownedShare = await prisma.sharedSubscription.findUnique({
      where: { ownerId: userId },
      include: {
        members: {
          orderBy: { invitedAt: 'asc' },
        },
      },
    });

    // Check if user is a member of someone else's shared subscription
    const memberOf = await prisma.sharedSubscriptionMember.findFirst({
      where: {
        userId: userId,
        status: 'ACCEPTED',
        sharedSubscription: {
          status: 'ACTIVE',
        },
      },
      include: {
        sharedSubscription: true,
      },
    });

    // Get owner info if member
    let sharedFrom = null;
    if (memberOf) {
      const owner = await prisma.user.findUnique({
        where: { id: memberOf.sharedSubscription.ownerId },
        select: { id: true, displayName: true, email: true, profilePhoto: true },
      });
      sharedFrom = {
        owner: owner ? {
          id: owner.id,
          display_name: owner.displayName,
          profile_photo: owner.profilePhoto,
        } : null,
        tier: memberOf.sharedSubscription.sharedTier,
        accepted_at: memberOf.acceptedAt,
      };
    }

    // Get member info for owned shares
    let sharedWith: any[] = [];
    if (ownedShare) {
      const memberUserIds = ownedShare.members
        .filter(m => m.userId)
        .map(m => m.userId!);

      const memberUsers = await prisma.user.findMany({
        where: { id: { in: memberUserIds } },
        select: { id: true, displayName: true, email: true, profilePhoto: true },
      });
      const userMap = new Map(memberUsers.map(u => [u.id, u]));

      sharedWith = ownedShare.members.map(m => ({
        id: m.id,
        email: m.inviteEmail,
        user: m.userId ? {
          id: userMap.get(m.userId)?.id,
          display_name: userMap.get(m.userId)?.displayName,
          profile_photo: userMap.get(m.userId)?.profilePhoto,
        } : null,
        status: m.status,
        invited_at: m.invitedAt,
        accepted_at: m.acceptedAt,
      }));
    }

    // Pending invitations for current user
    const pendingInvites = await prisma.sharedSubscriptionMember.findMany({
      where: {
        OR: [
          { userId: userId, status: 'PENDING' },
          { inviteEmail: req.user!.id }, // In case invited by email before registration
        ],
        sharedSubscription: { status: 'ACTIVE' },
      },
      include: {
        sharedSubscription: true,
      },
    });

    // Get owners of pending invites
    const pendingOwnerIds = pendingInvites.map(p => p.sharedSubscription.ownerId);
    const pendingOwners = await prisma.user.findMany({
      where: { id: { in: pendingOwnerIds } },
      select: { id: true, displayName: true, profilePhoto: true },
    });
    const pendingOwnerMap = new Map(pendingOwners.map(o => [o.id, o]));

    res.json({
      // Current user's subscription
      subscription: {
        tier,
        can_share: maxSlots > 0,
        max_slots: maxSlots,
        used_slots: ownedShare?.members.filter(m =>
          m.status === 'ACCEPTED' || m.status === 'PENDING'
        ).length || 0,
      },
      // Sharing as owner
      sharing: ownedShare ? {
        id: ownedShare.id,
        status: ownedShare.status,
        shared_tier: ownedShare.sharedTier,
        members: sharedWith,
      } : null,
      // Receiving shared access
      shared_from: sharedFrom,
      // Pending invitations to accept
      pending_invitations: pendingInvites.map(p => ({
        id: p.id,
        invite_code: p.inviteCode,
        from: pendingOwnerMap.get(p.sharedSubscription.ownerId) ? {
          id: pendingOwnerMap.get(p.sharedSubscription.ownerId)!.id,
          display_name: pendingOwnerMap.get(p.sharedSubscription.ownerId)!.displayName,
          profile_photo: pendingOwnerMap.get(p.sharedSubscription.ownerId)!.profilePhoto,
        } : null,
        tier: p.sharedSubscription.sharedTier,
        invited_at: p.invitedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Send Invitation
// =============================================================================

router.post('/invite', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { email } = inviteSchema.parse(req.body);

    // Can't invite yourself
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, displayName: true },
    });

    if (currentUser?.email.toLowerCase() === email.toLowerCase()) {
      throw new AppError(400, 'Cannot invite yourself');
    }

    // Check subscription tier
    const tier = await getActiveSubscriptionTier(userId);
    const maxSlots = SHARING_LIMITS[tier] || 0;

    if (maxSlots === 0) {
      throw new AppError(403, 'Your subscription tier does not support sharing. Upgrade to Premium or VIP to share your subscription.');
    }

    // Get or create shared subscription
    let sharedSub = await prisma.sharedSubscription.findUnique({
      where: { ownerId: userId },
      include: {
        members: {
          where: { status: { in: ['PENDING', 'ACCEPTED'] } },
        },
      },
    });

    if (!sharedSub) {
      sharedSub = await prisma.sharedSubscription.create({
        data: {
          ownerId: userId,
          sharedTier: tier as any,
          status: 'ACTIVE',
        },
        include: {
          members: true,
        },
      });
    }

    // Check slot availability
    if (sharedSub.members.length >= maxSlots) {
      throw new AppError(400, `You can only share with ${maxSlots} ${maxSlots === 1 ? 'person' : 'people'} on your ${tier} plan.`);
    }

    // Check if already invited this email
    const existingInvite = await prisma.sharedSubscriptionMember.findFirst({
      where: {
        sharedSubscriptionId: sharedSub.id,
        inviteEmail: email.toLowerCase(),
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
    });

    if (existingInvite) {
      throw new AppError(409, 'This person has already been invited');
    }

    // Check if the invited user exists
    const invitedUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    // Check if invited user already has their own premium subscription
    if (invitedUser) {
      const invitedTier = await getActiveSubscriptionTier(invitedUser.id);
      if (invitedTier !== 'FREE') {
        throw new AppError(400, 'This user already has their own premium subscription');
      }

      // Check if they're already receiving a shared subscription
      const alreadyShared = await prisma.sharedSubscriptionMember.findFirst({
        where: {
          userId: invitedUser.id,
          status: 'ACCEPTED',
          sharedSubscription: { status: 'ACTIVE' },
        },
      });

      if (alreadyShared) {
        throw new AppError(400, 'This user is already receiving a shared subscription');
      }
    }

    // Create invitation
    const inviteCode = generateInviteCode();
    const member = await prisma.sharedSubscriptionMember.create({
      data: {
        sharedSubscriptionId: sharedSub.id,
        userId: invitedUser?.id || null,
        inviteEmail: email.toLowerCase(),
        inviteCode,
        status: 'PENDING',
      },
    });

    // Notify the invited user if they exist
    if (invitedUser) {
      await prisma.notification.create({
        data: {
          userId: invitedUser.id,
          type: 'SYSTEM',
          title: 'Subscription Sharing Invitation',
          body: `${currentUser?.displayName || 'Someone'} wants to share their ${tier} subscription with you!`,
          data: { type: 'shared_subscription_invite', inviteId: member.id },
        },
      });

      push.sendNotification(
        invitedUser.id,
        'Subscription Sharing Invitation',
        `${currentUser?.displayName || 'Someone'} wants to share their ${tier} subscription with you!`,
        { type: 'shared_subscription_invite', inviteId: member.id }
      ).catch(console.error);
    }

    // TODO: Send email invitation for non-users

    res.status(201).json({
      success: true,
      invitation: {
        id: member.id,
        email: member.inviteEmail,
        invite_code: inviteCode,
        status: member.status,
        user_exists: !!invitedUser,
      },
      message: invitedUser
        ? 'Invitation sent! They will be notified in the app.'
        : 'Invitation created! Share the invite code with them.',
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Accept Invitation
// =============================================================================

router.post('/accept/:inviteId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { inviteId } = req.params;

    // Find the invitation
    const invite = await prisma.sharedSubscriptionMember.findFirst({
      where: {
        OR: [
          { id: inviteId },
          { inviteCode: inviteId },
        ],
        status: 'PENDING',
        sharedSubscription: { status: 'ACTIVE' },
      },
      include: {
        sharedSubscription: true,
      },
    });

    if (!invite) {
      throw new AppError(404, 'Invitation not found or expired');
    }

    // Verify this invitation is for this user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const isForThisUser =
      invite.userId === userId ||
      (invite.inviteEmail && currentUser?.email.toLowerCase() === invite.inviteEmail.toLowerCase());

    if (!isForThisUser && invite.userId) {
      throw new AppError(403, 'This invitation is for someone else');
    }

    // Check if user already has premium
    const userTier = await getActiveSubscriptionTier(userId);
    if (userTier !== 'FREE') {
      throw new AppError(400, 'You already have a premium subscription');
    }

    // Check if already receiving shared subscription
    const existingShare = await prisma.sharedSubscriptionMember.findFirst({
      where: {
        userId: userId,
        status: 'ACCEPTED',
        sharedSubscription: { status: 'ACTIVE' },
      },
    });

    if (existingShare) {
      throw new AppError(400, 'You are already receiving a shared subscription');
    }

    // Accept the invitation
    await prisma.sharedSubscriptionMember.update({
      where: { id: invite.id },
      data: {
        userId: userId,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    // Notify the owner
    const owner = await prisma.user.findUnique({
      where: { id: invite.sharedSubscription.ownerId },
      select: { displayName: true },
    });

    await prisma.notification.create({
      data: {
        userId: invite.sharedSubscription.ownerId,
        type: 'SYSTEM',
        title: 'Invitation Accepted!',
        body: `${currentUser?.email} has accepted your subscription sharing invitation.`,
      },
    });

    res.json({
      success: true,
      shared_tier: invite.sharedSubscription.sharedTier,
      message: `You now have access to ${invite.sharedSubscription.sharedTier} features!`,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Decline Invitation
// =============================================================================

router.post('/decline/:inviteId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { inviteId } = req.params;

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const invite = await prisma.sharedSubscriptionMember.findFirst({
      where: {
        OR: [
          { id: inviteId, userId: userId },
          { id: inviteId, inviteEmail: currentUser?.email.toLowerCase() },
          { inviteCode: inviteId, inviteEmail: currentUser?.email.toLowerCase() },
        ],
        status: 'PENDING',
      },
    });

    if (!invite) {
      throw new AppError(404, 'Invitation not found');
    }

    await prisma.sharedSubscriptionMember.delete({
      where: { id: invite.id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Revoke Access (Owner removes a member)
// =============================================================================

router.post('/revoke/:memberId', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const { memberId } = req.params;

    // Find member and verify ownership
    const member = await prisma.sharedSubscriptionMember.findUnique({
      where: { id: memberId },
      include: {
        sharedSubscription: true,
      },
    });

    if (!member || member.sharedSubscription.ownerId !== userId) {
      throw new AppError(404, 'Member not found');
    }

    // Update status to revoked
    await prisma.sharedSubscriptionMember.update({
      where: { id: memberId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    // Notify the user if they had accepted
    if (member.userId && member.status === 'ACCEPTED') {
      await prisma.notification.create({
        data: {
          userId: member.userId,
          type: 'SYSTEM',
          title: 'Shared Subscription Ended',
          body: 'Your shared subscription access has been revoked by the owner.',
        },
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Leave Shared Subscription (Member leaves voluntarily)
// =============================================================================

router.post('/leave', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const membership = await prisma.sharedSubscriptionMember.findFirst({
      where: {
        userId: userId,
        status: 'ACCEPTED',
        sharedSubscription: { status: 'ACTIVE' },
      },
      include: {
        sharedSubscription: true,
      },
    });

    if (!membership) {
      throw new AppError(404, 'You are not currently receiving a shared subscription');
    }

    await prisma.sharedSubscriptionMember.update({
      where: { id: membership.id },
      data: {
        status: 'LEFT',
        revokedAt: new Date(),
      },
    });

    // Notify owner
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, email: true },
    });

    await prisma.notification.create({
      data: {
        userId: membership.sharedSubscription.ownerId,
        type: 'SYSTEM',
        title: 'Member Left Shared Subscription',
        body: `${currentUser?.displayName || currentUser?.email} has left your shared subscription.`,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Cancel Sharing (Owner stops all sharing)
// =============================================================================

router.post('/cancel', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;

    const sharedSub = await prisma.sharedSubscription.findUnique({
      where: { ownerId: userId },
      include: {
        members: {
          where: { status: 'ACCEPTED' },
        },
      },
    });

    if (!sharedSub) {
      throw new AppError(404, 'No shared subscription found');
    }

    // Update all members to expired
    await prisma.sharedSubscriptionMember.updateMany({
      where: {
        sharedSubscriptionId: sharedSub.id,
        status: { in: ['PENDING', 'ACCEPTED'] },
      },
      data: {
        status: 'EXPIRED',
        revokedAt: new Date(),
      },
    });

    // Update shared subscription status
    await prisma.sharedSubscription.update({
      where: { id: sharedSub.id },
      data: { status: 'CANCELLED' },
    });

    // Notify all affected members
    for (const member of sharedSub.members) {
      if (member.userId) {
        await prisma.notification.create({
          data: {
            userId: member.userId,
            type: 'SYSTEM',
            title: 'Shared Subscription Ended',
            body: 'The subscription sharing has been cancelled by the owner.',
          },
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
