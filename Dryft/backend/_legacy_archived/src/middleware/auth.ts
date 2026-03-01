import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';
import { AppError } from './errorHandler.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      throw new AppError(401, 'User not found');
    }

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'Token expired'));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError(401, 'Invalid token'));
    }
    next(error);
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true },
    });

    if (user) {
      req.user = {
        id: user.id,
        email: user.email,
      };
    }

    next();
  } catch {
    // Silently continue without auth
    next();
  }
};
