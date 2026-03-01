import { Response } from 'express';

/**
 * Standardized API response format.
 * All API responses should follow this structure for consistency.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    page?: number;
    totalPages?: number;
  };
}

/**
 * Send a successful response with data.
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  return res.status(statusCode).json(response);
}

/**
 * Send a successful response with a message (no data).
 */
export function sendMessage(res: Response, message: string, statusCode = 200): Response {
  const response: ApiResponse = {
    success: true,
    message,
  };
  return res.status(statusCode).json(response);
}

/**
 * Send a paginated response.
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: { total: number; limit: number; offset: number }
): Response {
  const response: ApiResponse<T[]> = {
    success: true,
    data,
    meta: {
      total: meta.total,
      limit: meta.limit,
      offset: meta.offset,
      page: Math.floor(meta.offset / meta.limit) + 1,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  };
  return res.status(200).json(response);
}

/**
 * Send an error response.
 */
export function sendError(res: Response, error: string, statusCode = 400): Response {
  const response: ApiResponse = {
    success: false,
    error,
  };
  return res.status(statusCode).json(response);
}

/**
 * Send a created response (201).
 */
export function sendCreated<T>(res: Response, data: T): Response {
  return sendSuccess(res, data, 201);
}

/**
 * Send a no-content response (204).
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * Response helper object for cleaner usage.
 *
 * Usage:
 *   return respond(res).success(data);
 *   return respond(res).error('Not found', 404);
 *   return respond(res).paginated(items, { total, limit, offset });
 */
export function respond(res: Response) {
  return {
    success: <T>(data: T, statusCode = 200) => sendSuccess(res, data, statusCode),
    message: (message: string, statusCode = 200) => sendMessage(res, message, statusCode),
    paginated: <T>(data: T[], meta: { total: number; limit: number; offset: number }) =>
      sendPaginated(res, data, meta),
    error: (error: string, statusCode = 400) => sendError(res, error, statusCode),
    created: <T>(data: T) => sendCreated(res, data),
    noContent: () => sendNoContent(res),
  };
}

/**
 * Type guard to check if a response follows the standard format.
 */
export function isApiResponse(obj: unknown): obj is ApiResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'success' in obj &&
    typeof (obj as ApiResponse).success === 'boolean'
  );
}
