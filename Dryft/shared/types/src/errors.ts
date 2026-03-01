// =============================================================================
// Error Codes & Messages
// =============================================================================

export const ERROR_CODES = {
  NETWORK: 'network',
  AUTH: 'auth',
  VALIDATION: 'validation',
  NOT_FOUND: 'not_found',
  RATE_LIMITED: 'rate_limited',
  SERVER: 'server',
  TIMEOUT: 'timeout',
  UNKNOWN: 'unknown',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  network: 'Unable to connect. Please check your internet connection.',
  auth: 'Your session has expired. Please log in again.',
  validation: 'Some fields are invalid. Please check your input.',
  not_found: 'We could not find what you were looking for.',
  rate_limited: 'Too many requests. Please wait and try again.',
  server: 'Server error. Please try again later.',
  timeout: 'Request timed out. Please try again.',
  unknown: 'An unexpected error occurred.',
};

// =============================================================================
// i18n Key Mapping
// =============================================================================

/**
 * Maps error codes to i18n translation keys.
 * Use with i18next: t(ERROR_I18N_KEYS[errorCode])
 */
export const ERROR_I18N_KEYS: Record<ErrorCode, string> = {
  network: 'errors.network',
  auth: 'errors.unauthorized',
  validation: 'errors.validation',
  not_found: 'errors.notFound',
  rate_limited: 'errors.rateLimited',
  server: 'errors.serverError',
  timeout: 'errors.timeout',
  unknown: 'errors.generic',
};

/**
 * Get the i18n key for an error code.
 * Returns the key for use with translation function.
 */
export const getErrorI18nKey = (code: ErrorCode): string =>
  ERROR_I18N_KEYS[code] ?? ERROR_I18N_KEYS.unknown;

export interface ApiError {
  code: ErrorCode;
  message: string;
  status?: number;
  details?: Record<string, string>;
}

export const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: ERROR_CODES.VALIDATION,
  401: ERROR_CODES.AUTH,
  403: ERROR_CODES.AUTH,
  404: ERROR_CODES.NOT_FOUND,
  408: ERROR_CODES.TIMEOUT,
  409: ERROR_CODES.VALIDATION,
  429: ERROR_CODES.RATE_LIMITED,
  500: ERROR_CODES.SERVER,
  502: ERROR_CODES.SERVER,
  503: ERROR_CODES.SERVER,
  504: ERROR_CODES.TIMEOUT,
};

export const createApiError = (
  code: ErrorCode,
  message?: string,
  status?: number,
  details?: Record<string, string>
): ApiError => ({
  code,
  message: message ?? ERROR_MESSAGES[code],
  status,
  details,
});

export const getErrorCodeForStatus = (status?: number): ErrorCode => {
  if (!status) return ERROR_CODES.UNKNOWN;
  return HTTP_STATUS_TO_ERROR_CODE[status] ?? ERROR_CODES.UNKNOWN;
};

export const isRetryableError = (code: ErrorCode): boolean =>
  code === ERROR_CODES.NETWORK || code === ERROR_CODES.TIMEOUT || code === ERROR_CODES.SERVER;
