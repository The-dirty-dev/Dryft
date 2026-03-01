import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  altitude: z.number().optional(),
  heading: z.number().optional(),
  speed: z.number().optional(),
});

// Update user location
router.post('/location', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const data = updateLocationSchema.parse(req.body);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        lastLatitude: data.latitude,
        lastLongitude: data.longitude,
        lastLocationUpdate: new Date(),
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get nearby users
router.get('/nearby', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const {
      latitude,
      longitude,
      radius = '50',
      limit = '20',
    } = req.query;

    if (!latitude || !longitude) {
      throw new AppError(400, 'Location required');
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);
    const radiusKm = parseFloat(radius as string);
    const maxResults = parseInt(limit as string);

    // Get user's preferences
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { preferences: true },
    });

    // Get blocked/reported users
    const blockedUsers = await prisma.block.findMany({
      where: {
        OR: [
          { blockerId: req.user!.id },
          { blockedId: req.user!.id },
        ],
      },
    });
    const blockedIds = blockedUsers.map(b =>
      b.blockerId === req.user!.id ? b.blockedId : b.blockerId
    );

    // Get users who already matched or swiped
    const existingInteractions = await prisma.swipe.findMany({
      where: { swiperId: req.user!.id },
    });
    const swipedIds = existingInteractions.map(s => s.targetId);

    // Build age range filter
    const now = new Date();
    const minAge = user?.preferences?.ageMin || 18;
    const maxAge = user?.preferences?.ageMax || 100;
    const minBirthDate = new Date(now.getFullYear() - maxAge - 1, now.getMonth(), now.getDate());
    const maxBirthDate = new Date(now.getFullYear() - minAge, now.getMonth(), now.getDate());

    // Fetch potential users with location
    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: [...blockedIds, ...swipedIds, req.user!.id] },
        lastLatitude: { not: null },
        lastLongitude: { not: null },
        birthDate: {
          gte: minBirthDate,
          lte: maxBirthDate,
        },
        // In production, add gender preference filtering
      },
      select: {
        id: true,
        displayName: true,
        profilePhoto: true,
        birthDate: true,
        bio: true,
        lastLatitude: true,
        lastLongitude: true,
        lastLocationUpdate: true,
        verified: true,
      },
      take: 100, // Get more than needed for distance filtering
    });

    // Filter by distance and sort
    const nearbyUsers = candidates
      .map(candidate => {
        const distance = calculateDistance(
          lat,
          lon,
          candidate.lastLatitude!,
          candidate.lastLongitude!
        );
        return { ...candidate, distance };
      })
      .filter(u => u.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxResults);

    // Calculate age
    const calculateAge = (birthDate: Date) => {
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    res.json({
      users: nearbyUsers.map(u => ({
        id: u.id,
        name: u.displayName,
        photo: u.profilePhoto,
        age: u.birthDate ? calculateAge(u.birthDate) : null,
        bio: u.bio,
        distance: Math.round(u.distance * 10) / 10, // Round to 1 decimal
        distance_unit: 'km',
        is_verified: u.verified,
        last_active: u.lastLocationUpdate,
      })),
      center: { latitude: lat, longitude: lon },
      radius: radiusKm,
    });
  } catch (error) {
    next(error);
  }
});

// Get venues/events nearby
router.get('/venues', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const {
      latitude,
      longitude,
      radius = '10',
      category,
    } = req.query;

    if (!latitude || !longitude) {
      throw new AppError(400, 'Location required');
    }

    // In production, this would query a venues/events database
    // or integrate with external APIs (Yelp, Google Places, etc.)

    res.json({
      venues: [],
      events: [],
    });
  } catch (error) {
    next(error);
  }
});

// Get popular areas
router.get('/hotspots', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const {
      latitude,
      longitude,
      radius = '50',
    } = req.query;

    if (!latitude || !longitude) {
      throw new AppError(400, 'Location required');
    }

    const lat = parseFloat(latitude as string);
    const lon = parseFloat(longitude as string);
    const radiusKm = parseFloat(radius as string);

    // Get recent user locations to identify popular areas
    const recentUsers = await prisma.user.findMany({
      where: {
        lastLatitude: { not: null },
        lastLongitude: { not: null },
        lastLocationUpdate: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      select: {
        lastLatitude: true,
        lastLongitude: true,
      },
    });

    // Filter by radius
    const usersInRadius = recentUsers.filter(u => {
      const distance = calculateDistance(lat, lon, u.lastLatitude!, u.lastLongitude!);
      return distance <= radiusKm;
    });

    // Cluster users into hotspots (simplified grid-based clustering)
    const gridSize = 0.01; // ~1km grid cells
    const grid = new Map<string, { lat: number; lon: number; count: number }>();

    usersInRadius.forEach(u => {
      const gridLat = Math.round(u.lastLatitude! / gridSize) * gridSize;
      const gridLon = Math.round(u.lastLongitude! / gridSize) * gridSize;
      const key = `${gridLat},${gridLon}`;

      const existing = grid.get(key) || { lat: gridLat, lon: gridLon, count: 0 };
      existing.count++;
      grid.set(key, existing);
    });

    // Get top hotspots
    const hotspots = Array.from(grid.values())
      .filter(h => h.count >= 3) // Minimum users for a hotspot
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((h, index) => ({
        id: `hotspot_${index}`,
        latitude: h.lat,
        longitude: h.lon,
        user_count: h.count,
        intensity: Math.min(h.count / 10, 1), // Normalized intensity
      }));

    res.json({ hotspots });
  } catch (error) {
    next(error);
  }
});

// Check into a location
router.post('/checkin', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { latitude, longitude, venue_id, venue_name } = req.body;

    // Update user location
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        lastLatitude: latitude,
        lastLongitude: longitude,
        lastLocationUpdate: new Date(),
      },
    });

    // In production, this would create a check-in record
    // and potentially notify nearby users

    res.json({
      success: true,
      checked_in_at: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Get user's location history
router.get('/history', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // In production, this would return location history
    // For privacy, only return recent check-ins, not continuous tracking

    res.json({
      locations: [],
    });
  } catch (error) {
    next(error);
  }
});

// Update location visibility settings
router.put('/visibility', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { show_on_map, precise_location, distance_only } = req.body;

    await prisma.preferences.upsert({
      where: { userId: req.user!.id },
      update: {
        showOnMap: show_on_map,
        // Add more location privacy settings as needed
      },
      create: {
        userId: req.user!.id,
        showOnMap: show_on_map,
      },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
