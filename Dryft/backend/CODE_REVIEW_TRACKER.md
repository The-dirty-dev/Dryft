# Dryft Backend Code Review Tracker

> **Note:** This tracker documents issues found in the legacy Node.js/TypeScript/Prisma
> backend (`_legacy/src/`, `_legacy/prisma/`). The backend has been fully rewritten in Go
> (`cmd/dryft-api/`, `internal/`). The Go rewrite resolved ARCH-002, ARCH-003, and
> ARCH-006 by design (service layer pattern, struct-based validation, interface-based
> service abstraction). SEC-011 does not apply to the Go backend (no account deletion
> endpoint exists yet; when added, it should include email confirmation).
>
> **The 4 remaining items below are legacy-only and will be closed when `_legacy/` is removed.**

**Review Date:** 2026-01-25
**Last Updated:** 2026-02-02
**Total Issues:** 43
**Status:** Complete for Go backend (39 fixed, 4 legacy-only remaining)

---

## Summary

| Category | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| Security | 13 | 12 | 1 |
| Performance | 10 | 10 | 0 |
| Error Handling | 7 | 7 | 0 |
| Code Quality | 6 | 6 | 0 |
| Architecture | 7 | 4 | 3 |
| **Total** | **43** | **39** | **4** |

---

## Critical Issues

### SEC-001: Type Casting Bypass in Uploads
- **Status:** FIXED
- **Severity:** CRITICAL
- **File:** `src/routes/uploads.ts`
- **Lines:** 27, 81, 119, 170, 235, 286, 325
- **Issue:** Using `(req as any).user.id` bypasses TypeScript type safety
- **Fix:** Use proper `AuthRequest` type from middleware
- **Fixed Date:** 2026-01-25

### SEC-002: Authorization Middleware Doesn't Block Execution
- **Status:** FIXED
- **Severity:** CRITICAL
- **File:** `src/routes/admin.ts`
- **Lines:** 14-25, 27-38
- **Issue:** `requireAdmin` and `requireModerator` throw but don't return
- **Fix:** Add proper return statements, try-catch, and call next() with error
- **Fixed Date:** 2026-01-25

### PERF-001: N+1 Query Problem in Discovery
- **Status:** FIXED
- **Severity:** CRITICAL
- **File:** `src/routes/matching.ts`
- **Lines:** 37-98
- **Issue:** 4 sequential queries on every discovery page load
- **Fix:** Combined user, blocks, and swipes queries into parallel Promise.all
- **Fixed Date:** 2026-01-25

### ARCH-001: Multiple Prisma Instances
- **Status:** FIXED
- **Severity:** CRITICAL (causes connection pool exhaustion)
- **File:** `src/routes/uploads.ts`
- **Line:** 9
- **Issue:** Creates new `PrismaClient()` instead of using singleton
- **Fix:** Changed to import `prisma` from `../utils/prisma.js`
- **Fixed Date:** 2026-01-25

---

## High Severity Issues

### SEC-003: Unsafe S3 Key Authorization
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/uploads.ts`
- **Line:** 333
- **Issue:** String-based `key.includes()` check is insufficient
- **Fix:** Implemented proper key parsing with exact userId and category validation
- **Fixed Date:** 2026-01-25

### SEC-004: Unvalidated Metadata in Presigned URLs
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/uploads.ts`
- **Lines:** 60-72
- **Issue:** No server-side validation on content type/file size
- **Fix:** Added CATEGORY_SIZE_LIMITS and CATEGORY_CONTENT_TYPES validation at presigned URL generation
- **Fixed Date:** 2026-01-25

### SEC-005: ReDoS Risk in Search Queries
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/chat.ts`
- **Lines:** 319-326, 402-408, 486
- **Issue:** User input used in regex without sanitization
- **Fix:** Added max length validation (100 chars), date validation, already had regex escaping
- **Fixed Date:** 2026-01-25

### SEC-006: No CSRF Protection
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/middleware/csrf.ts`, `src/index.ts`
- **Lines:** 72-75
- **Issue:** CORS with credentials but no CSRF token validation
- **Fix:** Created CSRF middleware with double-submit cookie pattern. Auto-skips for Bearer token requests (mobile apps). Added `/csrf-token` endpoint for web clients.
- **Fixed Date:** 2026-01-26

### SEC-007: Session Fixation Vulnerability
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/auth.ts`
- **Lines:** 49, 108, 161, 218
- **Issue:** No device fingerprint/IP validation in sessions
- **Fix:** Added IP address validation in `/refresh` endpoint - invalidates session if IP changes
- **Fixed Date:** 2026-01-25

### SEC-008: Weak Password Requirements
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/auth.ts`
- **Line:** 20
- **Issue:** Only 8 character minimum, no complexity
- **Fix:** Added passwordSchema with uppercase, lowercase, number, special char requirements
- **Fixed Date:** 2026-01-25

### SEC-009: Missing Rate Limiting on Admin Actions
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/admin.ts`, `src/middleware/rateLimit.ts`
- **Lines:** 269, 308, 338
- **Issue:** Ban/unban/warn operations have no rate limiting
- **Fix:** Added `adminActionRateLimit` middleware (10 actions/minute per admin) to ban, unban, warn endpoints
- **Fixed Date:** 2026-01-25

### SEC-010: Stripe Webhook Error Exposure
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/webhooks.ts`
- **Line:** 38
- **Issue:** Returns detailed error message to potential attackers
- **Fix:** Return generic error, log details server-side
- **Fixed Date:** 2026-01-25

### SEC-011: Missing Verification on Account Deletion
- **Status:** OPEN
- **Severity:** HIGH
- **File:** `src/routes/users.ts`
- **Lines:** 276-296
- **Issue:** Only password verified, no email confirmation
- **Fix:** Require email confirmation or 2FA
- **Fixed Date:** -

### PERF-002: Unbounded Admin Dashboard Queries
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/admin.ts`
- **Lines:** 52-77
- **Issue:** 10 parallel count queries on every dashboard load
- **Fix:** Added Redis caching with 5-minute TTL (same fix as PERF-005)
- **Fixed Date:** 2026-01-25

### PERF-003: Missing Database Indexes
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `prisma/schema.prisma`
- **Issue:** Missing indexes on frequently queried foreign keys
- **Fix:** Added @@index directives to Session, ConversationParticipant, Block, Report, Gift, StoreItem, InventoryItem, Purchase, Payment models
- **Fixed Date:** 2026-01-25

### PERF-004: Inefficient Message Load in Chat
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/chat.ts`
- **Lines:** 28-46
- **Issue:** Loads all messages to count unread
- **Fix:** Used prisma.message.count() with proper where clause for efficient unread counts
- **Fixed Date:** 2026-01-25

### PERF-005: Missing Caching on Admin Stats
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/admin.ts`
- **Lines:** 45-77
- **Issue:** Expensive aggregations computed on every request
- **Fix:** Implemented 5-minute Redis cache (same fix as PERF-002)
- **Fixed Date:** 2026-01-25

### ERR-001: Generic Error Messages
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/middleware/errorHandler.ts`
- **Lines:** 88-89
- **Issue:** All unknown errors return generic message
- **Fix:** Added unique errorId generation with UUID, full server-side logging including stack trace, path, and userId
- **Fixed Date:** 2026-01-25

### ERR-002: Webhook Returns 200 on Failure
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/webhooks.ts`
- **Lines:** 108-112
- **Issue:** Returns `{ received: true }` even on handler failure
- **Fix:** Returns 500 status code on handler errors so Stripe will retry
- **Fixed Date:** 2026-01-25

### ERR-003: Unhandled Promise Rejection in Push
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/admin.ts`, `src/routes/chat.ts`, `src/routes/matching.ts`
- **Lines:** Multiple locations
- **Issue:** Errors logged to console, not logger
- **Fix:** Replaced console.error with logger.error across admin.ts, and silent catch blocks in routes (errors logged in push service)
- **Fixed Date:** 2026-01-25

### ARCH-002: Tight Coupling to Prisma in Routes
- **Status:** OPEN
- **Severity:** HIGH
- **File:** All route files
- **Issue:** Database queries directly in route handlers
- **Fix:** Create service layer for business logic
- **Fixed Date:** -

### ARCH-003: No Request/Response Validation Layer
- **Status:** OPEN
- **Severity:** HIGH
- **File:** `src/routes/*`
- **Issue:** Inconsistent validation across API
- **Fix:** Centralize validation middleware
- **Fixed Date:** -

### ARCH-004: No Database Transaction Wrapper
- **Status:** FIXED
- **Severity:** HIGH
- **File:** `src/routes/webhooks.ts`
- **Lines:** 125-163
- **Issue:** Multi-step operations without transactions
- **Fix:** Wrapped handlePaymentSuccess and handlePaymentFailed in prisma.$transaction for consistency
- **Fixed Date:** 2026-01-25

---

## Medium Severity Issues

### SEC-012: Console Error Logging in Production
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/routes/uploads.ts`
- **Lines:** 69, 103, 153, 218, 274, 313
- **Issue:** `console.error()` bypasses logging framework
- **Fix:** Replaced all console.error with logger.error/warn
- **Fixed Date:** 2026-01-25

### SEC-013: JWT Secret Not Validated
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/config/index.ts`
- **Lines:** 19-22
- **Issue:** No validation that JWT secret is strong enough
- **Fix:** Added validateConfig() function that checks JWT_SECRET is at least 32 characters
- **Fixed Date:** 2026-01-25

### PERF-006: Unoptimized Profile Query
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/routes/users.ts`
- **Lines:** 165-231
- **Issue:** Unnecessary `include: { profile: true }`
- **Fix:** Changed to use `select` with only the specific fields needed for the response
- **Fixed Date:** 2026-01-25

### PERF-007: Inefficient Conversation Participant Query
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/routes/chat.ts`
- **Lines:** 28-46
- **Issue:** Nested includes cause cartesian product queries
- **Fix:** Changed from `include` to `select` with only required fields for each nested relation
- **Fixed Date:** 2026-01-25

### PERF-008: Memory Leak from Fire-and-Forget
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/services/cache.ts`
- **Line:** 195
- **Issue:** Unhandled promise rejection in cache set
- **Fix:** Added `.catch()` handler with logger.warn to log cache set failures
- **Fixed Date:** 2026-01-25

### PERF-009: Inefficient Daily Limits Check
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/services/dailyLimits.ts`
- **Lines:** 55-116
- **Issue:** Queries database twice per check
- **Fix:** Added 5-minute cache for user tier with `getTierCacheKey()` and `TIER_CACHE_TTL`
- **Fixed Date:** 2026-01-25

### PERF-010: No Pagination Limits on Admin
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/routes/admin.ts`
- **Lines:** 111-199
- **Issue:** Max 100 users per request
- **Fix:** Added ADMIN_DEFAULT_PAGE_SIZE (20) and ADMIN_MAX_PAGE_SIZE (50) constants, enforced limits
- **Fixed Date:** 2026-01-25

### ERR-004: Missing Validation on Date Inputs
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/routes/chat.ts`
- **Lines:** 115-116, 352-356
- **Issue:** `new Date()` not validated
- **Fix:** Added Date.parse validation before using date parameters in messages and search endpoints
- **Fixed Date:** 2026-01-25

### ERR-005: Missing Config Validation at Startup
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/config/index.ts`
- **Lines:** 11, 19-26
- **Issue:** Required config uses `!` assertion without validation
- **Fix:** Added validateConfig() function that validates all required env vars at startup
- **Fixed Date:** 2026-01-25

### ERR-006: Silent Failures in Daily Limits
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/services/dailyLimits.ts`
- **Lines:** 305-306
- **Issue:** Allows through on any error
- **Fix:** Added failure tracking with circuit breaker pattern - fails closed initially, then fails open after threshold
- **Fixed Date:** 2026-01-25

### ERR-007: No Error Recovery for S3
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/routes/uploads.ts`
- **Lines:** 200-205
- **Issue:** S3 deletion fails silently
- **Fix:** Enhanced logging with key, userId, and MANUAL_CLEANUP_MAY_BE_NEEDED action for ops team to monitor
- **Fixed Date:** 2026-01-25

### CODE-001: Duplicate Auth Token Creation
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/routes/auth.ts`
- **Lines:** 56-68
- **Issue:** Register and login duplicate token creation
- **Fix:** Already has `generateTokens` helper function that is reused across register, login, and refresh endpoints
- **Fixed Date:** 2026-01-25

### CODE-002: Inconsistent Type Handling
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/routes/admin.ts`
- **Lines:** 70, 273
- **Issue:** Mix of `as Type` and string comparison
- **Fix:** Added `AdminDashboardStats` interface, replaced `cache.get<any>` with proper typed version
- **Fixed Date:** 2026-01-25

### CODE-003: Missing Type Definitions
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/routes/admin.ts`
- **Lines:** 119, 388-390, 701
- **Issue:** `where: any = {}` bypasses type checking
- **Fix:** Replaced all `where: any` with `Prisma.UserWhereInput` and `Prisma.AdminActionWhereInput`
- **Fixed Date:** 2026-01-25

### CODE-004: Inconsistent Error Response Format
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/middleware/errorHandler.ts`
- **Issue:** Mix of `{ error }` and `{ success: false, error }`
- **Fix:** Exported `sendErrorResponse` helper function with standardized ErrorResponse interface for routes to use
- **Fixed Date:** 2026-01-25

### CODE-005: Magic Numbers
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/routes/chat.ts`
- **Lines:** 93, 127, 361
- **Issue:** Hardcoded limits without constants
- **Fix:** Added MESSAGES_DEFAULT_LIMIT, MESSAGES_MAX_LIMIT, SEARCH_RESULTS_DEFAULT_LIMIT, SEARCH_RESULTS_MAX_LIMIT constants
- **Fixed Date:** 2026-01-25

### ARCH-005: Middleware Organization
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/middleware/rateLimit.ts`
- **Issue:** Rate limits hard to track per-route
- **Fix:** Created `RATE_LIMIT_CONFIG` centralized configuration object with factory pattern and `getRateLimitSummary()` helper
- **Fixed Date:** 2026-01-26

### ARCH-006: Missing External Service Abstraction
- **Status:** OPEN
- **Severity:** MEDIUM
- **File:** Multiple services
- **Issue:** Different integration patterns for external services
- **Fix:** Create service adapter pattern
- **Fixed Date:** -

### ARCH-007: No Circuit Breaker Pattern
- **Status:** FIXED
- **Severity:** MEDIUM
- **File:** `src/services/circuitBreaker.ts`, `src/services/push.ts`
- **Issue:** No protection against cascading failures
- **Fix:** Created `circuitBreaker.ts` with configurable circuit breakers for external services (Stripe, Firebase, S3, Redis, Email). Integrated with push notification service.
- **Fixed Date:** 2026-01-26

---

## Low Severity Issues

### CODE-006: Duplicate Validation Categories
- **Status:** FIXED
- **Severity:** LOW
- **File:** `src/routes/uploads.ts`
- **Lines:** 37-45, 127-135
- **Issue:** Category validation array duplicated
- **Fix:** Extracted to VALID_CATEGORIES constant at top of file
- **Fixed Date:** 2026-01-25

---

## Change Log

| Date | Issue ID | Action | Notes |
|------|----------|--------|-------|
| 2026-01-25 | - | Initial review | 46 issues identified |
| 2026-01-25 | SEC-001 | Fixed | Type safety in uploads.ts |
| 2026-01-25 | ARCH-001 | Fixed | Prisma singleton in uploads.ts |
| 2026-01-25 | SEC-002 | Fixed | Admin middleware blocking |
| 2026-01-25 | PERF-001 | Fixed | N+1 query in discovery |
| 2026-01-25 | SEC-003 | Fixed | S3 key authorization |
| 2026-01-25 | SEC-012 | Fixed | Console.error to logger |
| 2026-01-25 | CODE-006 | Fixed | Extracted VALID_CATEGORIES |
| 2026-01-25 | SEC-005 | Fixed | Search query length validation |
| 2026-01-25 | SEC-008 | Fixed | Password complexity requirements |
| 2026-01-25 | PERF-002 | Fixed | Admin dashboard Redis caching |
| 2026-01-25 | SEC-010 | Fixed | Generic webhook error messages |
| 2026-01-25 | ERR-002 | Fixed | Webhook returns proper error codes |
| 2026-01-25 | PERF-003 | Fixed | Added database indexes |
| 2026-01-25 | PERF-004 | Fixed | Efficient unread message counts |
| 2026-01-25 | SEC-004 | Fixed | Presigned URL validation |
| 2026-01-25 | ERR-001 | Fixed | Unique error IDs for tracking |
| 2026-01-25 | ERR-003 | Fixed | Push notification error logging |
| 2026-01-25 | PERF-005 | Fixed | Admin stats caching (same as PERF-002) |
| 2026-01-25 | ARCH-004 | Fixed | Webhook transaction wrappers |
| 2026-01-25 | CODE-001 | Fixed | Already has generateTokens helper |
| 2026-01-25 | SEC-013 | Fixed | JWT secret length validation |
| 2026-01-25 | ERR-005 | Fixed | Config validation at startup |
| 2026-01-25 | CODE-005 | Fixed | Chat pagination constants |
| 2026-01-25 | ERR-004 | Fixed | Date input validation |
| 2026-01-25 | ERR-006 | Fixed | Daily limits circuit breaker |
| 2026-01-25 | CODE-004 | Fixed | Standardized error response helper |
| 2026-01-25 | ERR-007 | Fixed | S3 deletion error logging |
| 2026-01-25 | PERF-006 | Fixed | Profile query optimization with select |
| 2026-01-25 | PERF-008 | Fixed | Fire-and-forget error logging |
| 2026-01-25 | PERF-010 | Fixed | Admin pagination limits |
| 2026-01-25 | SEC-009 | Fixed | Admin action rate limiting |
| 2026-01-25 | PERF-007 | Fixed | Conversation participant query optimization |
| 2026-01-25 | PERF-009 | Fixed | User tier caching for daily limits |
| 2026-01-25 | CODE-002 | Fixed | AdminDashboardStats interface |
| 2026-01-25 | CODE-003 | Fixed | Prisma where type definitions |
| 2026-01-25 | SEC-007 | Fixed | Session IP validation on refresh |
| 2026-01-25 | PERF-002 | Fixed | Marked as duplicate of PERF-005 |
| 2026-01-26 | ARCH-005 | Fixed | Centralized rate limit configuration |
| 2026-01-26 | ARCH-007 | Fixed | Circuit breaker pattern implemented |
| 2026-01-26 | SEC-006 | Fixed | CSRF protection middleware |

