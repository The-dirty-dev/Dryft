import { Router } from 'express';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// =============================================================================
// Timeline Helpers
// =============================================================================

interface TimelineEvent {
  id: string;
  type: 'milestone' | 'memory' | 'achievement' | 'activity' | 'auto';
  category?: string;
  title: string;
  description?: string | null;
  date: Date;
  photo_url?: string | null;
  media_url?: string | null;
  icon?: string;
  metadata?: Record<string, unknown>;
}

// Generate automatic timeline events (anniversaries, days together, etc.)
function generateAutoEvents(couple: {
  createdAt: Date;
  anniversary: Date | null;
  partner1: { displayName: string | null };
  partner2: { displayName: string | null };
}, userId: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = new Date();
  const startDate = couple.anniversary || couple.createdAt;
  const daysTogether = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // "X days together" milestones
  const dayMilestones = [7, 30, 50, 100, 200, 365, 500, 730, 1000, 1095, 1461];
  for (const days of dayMilestones) {
    if (daysTogether >= days) {
      const eventDate = new Date(startDate);
      eventDate.setDate(eventDate.getDate() + days);
      events.push({
        id: `auto-days-${days}`,
        type: 'auto',
        category: 'milestone',
        title: days === 365 ? '1 Year Together!' :
               days === 730 ? '2 Years Together!' :
               days === 1095 ? '3 Years Together!' :
               days === 1461 ? '4 Years Together!' :
               `${days} Days Together!`,
        description: days >= 365
          ? `You've been together for ${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? 's' : ''}!`
          : `You've reached ${days} days together!`,
        date: eventDate,
        icon: days >= 365 ? '🎉' : '💕',
      });
    }
  }

  // First week together
  if (daysTogether >= 7) {
    const weekDate = new Date(startDate);
    weekDate.setDate(weekDate.getDate() + 7);
    events.push({
      id: 'auto-first-week',
      type: 'auto',
      category: 'milestone',
      title: 'First Week Together',
      description: 'Your first week as a couple on Drift!',
      date: weekDate,
      icon: '✨',
    });
  }

  // Monthly anniversaries (first 6 months)
  for (let month = 1; month <= 6; month++) {
    const monthDate = new Date(startDate);
    monthDate.setMonth(monthDate.getMonth() + month);
    if (monthDate <= now) {
      events.push({
        id: `auto-month-${month}`,
        type: 'auto',
        category: 'anniversary',
        title: `${month} Month${month > 1 ? 's' : ''} Together`,
        description: `Happy ${month}-month anniversary!`,
        date: monthDate,
        icon: '💝',
      });
    }
  }

  // Connection date (when they started on Drift)
  events.push({
    id: 'auto-started',
    type: 'auto',
    category: 'milestone',
    title: 'Your Journey Began',
    description: 'The day you connected on Drift',
    date: couple.createdAt,
    icon: '💫',
  });

  return events;
}

// Get upcoming milestones
function getUpcomingMilestones(couple: {
  createdAt: Date;
  anniversary: Date | null;
}): Array<{ title: string; date: Date; days_until: number; icon: string }> {
  const upcoming: Array<{ title: string; date: Date; days_until: number; icon: string }> = [];
  const now = new Date();
  const startDate = couple.anniversary || couple.createdAt;
  const daysTogether = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Next day milestones
  const dayMilestones = [100, 200, 365, 500, 730, 1000, 1095, 1461, 1826];
  for (const days of dayMilestones) {
    if (daysTogether < days) {
      const eventDate = new Date(startDate);
      eventDate.setDate(eventDate.getDate() + days);
      const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      upcoming.push({
        title: days === 365 ? '1 Year Anniversary' :
               days === 730 ? '2 Year Anniversary' :
               days === 1095 ? '3 Year Anniversary' :
               days === 1461 ? '4 Year Anniversary' :
               days === 1826 ? '5 Year Anniversary' :
               `${days} Days Together`,
        date: eventDate,
        days_until: daysUntil,
        icon: days >= 365 ? '🎉' : '🎯',
      });

      if (upcoming.length >= 3) break;
    }
  }

  // Next anniversary (if set)
  if (couple.anniversary) {
    const nextAnniversary = new Date(couple.anniversary);
    nextAnniversary.setFullYear(now.getFullYear());
    if (nextAnniversary < now) {
      nextAnniversary.setFullYear(now.getFullYear() + 1);
    }
    const daysUntil = Math.ceil((nextAnniversary.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const years = nextAnniversary.getFullYear() - couple.anniversary.getFullYear();

    upcoming.push({
      title: `${years} Year Anniversary`,
      date: nextAnniversary,
      days_until: daysUntil,
      icon: '💍',
    });
  }

  return upcoming.sort((a, b) => a.days_until - b.days_until).slice(0, 5);
}

// =============================================================================
// Routes
// =============================================================================

// Get full relationship timeline
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { limit = '50', offset = '0', type } = req.query;

    const couple = await prisma.couple.findFirst({
      where: {
        OR: [
          { partner1Id: req.user!.id },
          { partner2Id: req.user!.id },
        ],
        status: 'ACTIVE',
      },
      include: {
        partner1: { select: { id: true, displayName: true, profilePhoto: true } },
        partner2: { select: { id: true, displayName: true, profilePhoto: true } },
        milestones: { orderBy: { date: 'desc' } },
        memories: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    // Get achievements
    const achievements = await prisma.userAchievement.findMany({
      where: { userId: req.user!.id },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    });

    // Get completed activities
    const activities = await prisma.coupleActivityCompletion.findMany({
      where: { coupleId: couple.id, status: 'COMPLETED' },
      include: { activity: true },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });

    // Build timeline events
    let events: TimelineEvent[] = [];

    // Add milestones
    events.push(
      ...couple.milestones.map((m) => ({
        id: m.id,
        type: 'milestone' as const,
        category: m.type.toLowerCase(),
        title: m.title,
        description: m.description,
        date: m.date,
        photo_url: m.photoUrl,
        icon: getMilestoneIcon(m.type),
      }))
    );

    // Add memories
    events.push(
      ...couple.memories.map((m) => ({
        id: m.id,
        type: 'memory' as const,
        category: m.type.toLowerCase(),
        title: m.title || getMemoryTitle(m.type),
        description: m.content,
        date: m.createdAt,
        media_url: m.mediaUrl,
        icon: getMemoryIcon(m.type),
        metadata: { location: m.location, mood: m.mood },
      }))
    );

    // Add achievements
    events.push(
      ...achievements.map((a) => ({
        id: a.id,
        type: 'achievement' as const,
        category: a.achievement.category.toLowerCase(),
        title: `Earned: ${a.achievement.name}`,
        description: a.achievement.description,
        date: a.earnedAt,
        icon: getAchievementIcon(a.achievement.rarity),
        metadata: { badge_url: a.achievement.badgeUrl, xp: a.achievement.xpReward },
      }))
    );

    // Add completed activities
    events.push(
      ...activities
        .filter((a) => a.completedAt)
        .map((a) => ({
          id: a.id,
          type: 'activity' as const,
          category: a.activity.category.toLowerCase(),
          title: `Completed: ${a.activity.title}`,
          description: a.notes,
          date: a.completedAt!,
          icon: getActivityIcon(a.activity.category),
          metadata: { xp_earned: a.xpEarned, rating: a.rating },
        }))
    );

    // Add auto-generated events
    events.push(...generateAutoEvents(couple, req.user!.id));

    // Filter by type if specified
    if (type && typeof type === 'string') {
      events = events.filter((e) => e.type === type);
    }

    // Sort by date descending
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Paginate
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    const paginatedEvents = events.slice(offsetNum, offsetNum + limitNum);

    // Calculate stats
    const startDate = couple.anniversary || couple.createdAt;
    const daysTogether = Math.floor(
      (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const partner = couple.partner1Id === req.user!.id ? couple.partner2 : couple.partner1;

    res.json({
      timeline: paginatedEvents.map((e) => ({
        ...e,
        date: e.date.toISOString(),
      })),
      stats: {
        days_together: daysTogether,
        milestones_count: couple.milestones.length,
        memories_count: couple.memories.length,
        achievements_count: achievements.length,
        activities_completed: activities.length,
      },
      upcoming: getUpcomingMilestones(couple),
      partner: {
        id: partner.id,
        display_name: partner.displayName,
        profile_photo: partner.profilePhoto,
      },
      total: events.length,
      has_more: offsetNum + limitNum < events.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get "On This Day" / Throwback memories
router.get('/throwback', authenticate, async (req: AuthRequest, res, next) => {
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
      throw new AppError(404, 'No active relationship');
    }

    const today = new Date();
    const month = today.getMonth();
    const day = today.getDate();

    // Find memories and milestones from this day in previous years
    const memories = await prisma.coupleMemory.findMany({
      where: {
        coupleId: couple.id,
        createdAt: {
          // This is a simplification - in production you'd use raw SQL for exact date matching
          lte: new Date(today.getFullYear() - 1, month, day + 1),
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const milestones = await prisma.coupleMilestone.findMany({
      where: {
        coupleId: couple.id,
        date: {
          lte: new Date(today.getFullYear() - 1, month, day + 1),
        },
      },
      orderBy: { date: 'desc' },
    });

    // Filter for same month/day
    const filteredMemories = memories.filter((m) => {
      const d = new Date(m.createdAt);
      return d.getMonth() === month && d.getDate() === day;
    });

    const filteredMilestones = milestones.filter((m) => {
      const d = new Date(m.date);
      return d.getMonth() === month && d.getDate() === day;
    });

    // Combine and group by year
    const throwbacks: Array<{
      year: number;
      years_ago: number;
      items: Array<{
        id: string;
        type: string;
        title: string;
        content?: string | null;
        media_url?: string | null;
        photo_url?: string | null;
        date: string;
      }>;
    }> = [];

    const yearMap = new Map<number, typeof throwbacks[0]>();

    for (const memory of filteredMemories) {
      const year = new Date(memory.createdAt).getFullYear();
      const yearsAgo = today.getFullYear() - year;
      if (!yearMap.has(year)) {
        yearMap.set(year, { year, years_ago: yearsAgo, items: [] });
      }
      yearMap.get(year)!.items.push({
        id: memory.id,
        type: 'memory',
        title: memory.title || getMemoryTitle(memory.type),
        content: memory.content,
        media_url: memory.mediaUrl,
        date: memory.createdAt.toISOString(),
      });
    }

    for (const milestone of filteredMilestones) {
      const year = new Date(milestone.date).getFullYear();
      const yearsAgo = today.getFullYear() - year;
      if (!yearMap.has(year)) {
        yearMap.set(year, { year, years_ago: yearsAgo, items: [] });
      }
      yearMap.get(year)!.items.push({
        id: milestone.id,
        type: 'milestone',
        title: milestone.title,
        content: milestone.description,
        photo_url: milestone.photoUrl,
        date: milestone.date.toISOString(),
      });
    }

    // Sort by years ago
    const sortedThrowbacks = Array.from(yearMap.values()).sort(
      (a, b) => a.years_ago - b.years_ago
    );

    res.json({
      date: today.toISOString().split('T')[0],
      has_throwbacks: sortedThrowbacks.length > 0,
      throwbacks: sortedThrowbacks,
    });
  } catch (error) {
    next(error);
  }
});

// Get timeline summary (for dashboard widget)
router.get('/summary', authenticate, async (req: AuthRequest, res, next) => {
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
        partner1: { select: { displayName: true, profilePhoto: true } },
        partner2: { select: { displayName: true, profilePhoto: true } },
      },
    });

    if (!couple) {
      throw new AppError(404, 'No active relationship');
    }

    const startDate = couple.anniversary || couple.createdAt;
    const now = new Date();
    const daysTogether = Math.floor(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get recent highlights
    const [recentMilestones, recentMemories] = await Promise.all([
      prisma.coupleMilestone.findMany({
        where: { coupleId: couple.id },
        orderBy: { date: 'desc' },
        take: 3,
      }),
      prisma.coupleMemory.findMany({
        where: { coupleId: couple.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    const partner = couple.partner1Id === req.user!.id ? couple.partner2 : couple.partner1;

    res.json({
      days_together: daysTogether,
      weeks_together: Math.floor(daysTogether / 7),
      months_together: Math.floor(daysTogether / 30),
      started_date: startDate.toISOString(),
      anniversary: couple.anniversary?.toISOString() || null,
      upcoming: getUpcomingMilestones(couple).slice(0, 3),
      recent_highlights: [
        ...recentMilestones.map((m) => ({
          id: m.id,
          type: 'milestone',
          title: m.title,
          date: m.date.toISOString(),
          icon: getMilestoneIcon(m.type),
        })),
        ...recentMemories.map((m) => ({
          id: m.id,
          type: 'memory',
          title: m.title || getMemoryTitle(m.type),
          date: m.createdAt.toISOString(),
          icon: getMemoryIcon(m.type),
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
      partner: {
        display_name: partner.displayName,
        profile_photo: partner.profilePhoto,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Helper Functions
// =============================================================================

function getMilestoneIcon(type: string): string {
  const icons: Record<string, string> = {
    ANNIVERSARY: '💍',
    FIRST_DATE: '🌹',
    FIRST_KISS: '💋',
    FIRST_TRIP: '✈️',
    MOVED_IN: '🏠',
    ENGAGED: '💎',
    MARRIED: '👰',
    CUSTOM: '⭐',
  };
  return icons[type] || '📍';
}

function getMemoryIcon(type: string): string {
  const icons: Record<string, string> = {
    PHOTO: '📸',
    VIDEO: '🎬',
    NOTE: '📝',
    VOICE: '🎤',
    LOCATION: '📍',
  };
  return icons[type] || '💭';
}

function getMemoryTitle(type: string): string {
  const titles: Record<string, string> = {
    PHOTO: 'Photo Memory',
    VIDEO: 'Video Memory',
    NOTE: 'Shared Note',
    VOICE: 'Voice Message',
    LOCATION: 'Location Memory',
  };
  return titles[type] || 'Memory';
}

function getAchievementIcon(rarity: string): string {
  const icons: Record<string, string> = {
    COMMON: '🥉',
    UNCOMMON: '🥈',
    RARE: '🥇',
    EPIC: '💜',
    LEGENDARY: '👑',
  };
  return icons[rarity] || '🏆';
}

function getActivityIcon(category: string): string {
  const icons: Record<string, string> = {
    COMMUNICATION: '💬',
    GAMES: '🎮',
    CREATIVE: '🎨',
    WELLNESS: '🧘',
    LEARNING: '📚',
    ROMANCE: '❤️',
    ADVENTURE: '🌟',
    REFLECTION: '🪞',
  };
  return icons[category] || '⭐';
}

export default router;
