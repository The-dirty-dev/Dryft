import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Standardized error response format (CODE-004).
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Array<{ field: string; message: string }>;
  errorId?: string;
  [key: string]: any; // Allow additional fields like retry_after, limit, etc.
}

/**
 * Helper to send standardized error responses from routes.
 * Use this instead of res.status(xxx).json({ error: 'message' }) for consistency.
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  error: string,
  options?: {
    code?: string;
    details?: Array<{ field: string; message: string }>;
    errorId?: string;
    extra?: Record<string, any>;
  }
): Response {
  const response: ErrorResponse = {
    success: false,
    error,
  };
  if (options?.code) {
    response.code = options.code;
  }
  if (options?.details) {
    response.details = options.details;
  }
  if (options?.errorId) {
    response.errorId = options.errorId;
  }
  if (options?.extra) {
    Object.assign(response, options.extra);
  }
  return res.status(statusCode).json(response);
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    logger.warn('Validation error:', { path: req.path, errors: err.errors });
    return sendErrorResponse(res, 400, 'Validation error', {
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Handle known operational errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error('Operational error:', { statusCode: err.statusCode, message: err.message });
    } else {
      logger.warn('Client error:', { statusCode: err.statusCode, message: err.message });
    }
    return sendErrorResponse(res, err.statusCode, err.message);
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as any;
    if (prismaError.code === 'P2002') {
      return sendErrorResponse(res, 409, 'A record with this value already exists');
    }
    if (prismaError.code === 'P2025') {
      return sendErrorResponse(res, 404, 'Record not found');
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendErrorResponse(res, 401, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return sendErrorResponse(res, 401, 'Token expired');
  }

  // ERR-001: Generate unique error ID for unknown errors
  // Log full details server-side, return generic message with ID to client
  const errorId = randomUUID();
  logger.error('Unhandled error:', {
    errorId,
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
  });

  return sendErrorResponse(res, 500, 'An unexpected error occurred. Please try again or contact support.', {
    errorId,
  });
};
