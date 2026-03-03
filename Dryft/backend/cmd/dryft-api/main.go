package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"github.com/dryft-app/backend/internal/admin"
	"github.com/dryft-app/backend/internal/agegate"
	"github.com/dryft-app/backend/internal/analytics"
	"github.com/dryft-app/backend/internal/auth"
	"github.com/dryft-app/backend/internal/avatar"
	"github.com/dryft-app/backend/internal/calls"
	"github.com/dryft-app/backend/internal/chat"
	"github.com/dryft-app/backend/internal/config"
	"github.com/dryft-app/backend/internal/database"
	"github.com/dryft-app/backend/internal/haptic"
	"github.com/dryft-app/backend/internal/links"
	"github.com/dryft-app/backend/internal/logger"
	"github.com/dryft-app/backend/internal/marketplace"
	"github.com/dryft-app/backend/internal/matching"
	"github.com/dryft-app/backend/internal/metrics"
	"github.com/dryft-app/backend/internal/safety"
	"github.com/dryft-app/backend/internal/session"
	"github.com/dryft-app/backend/internal/settings"
	"github.com/dryft-app/backend/internal/subscription"
	authmw "github.com/dryft-app/backend/internal/middleware"
	"github.com/dryft-app/backend/internal/notifications"
	"github.com/dryft-app/backend/internal/profile"
	"github.com/dryft-app/backend/internal/realtime"
	"github.com/dryft-app/backend/internal/storage"
	"github.com/dryft-app/backend/internal/verification"
)

// skipForWebSocket wraps a middleware so it is bypassed for WebSocket upgrade
// requests. This is needed because middleware like chi's Timeout wraps the
// http.ResponseWriter with a type that does not implement http.Hijacker,
// which gorilla/websocket requires to take over the TCP connection.
func skipForWebSocket(mw func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		wrapped := mw(next) // pre-build the wrapped handler
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
				next.ServeHTTP(w, r)
				return
			}
			wrapped.ServeHTTP(w, r)
		})
	}
}

// tokenValidatorAdapter wraps auth.Service to implement middleware.TokenValidator
type tokenValidatorAdapter struct {
	service *auth.Service
}

func (a *tokenValidatorAdapter) ValidateToken(token string) (*authmw.TokenClaims, error) {
	claims, err := a.service.ValidateToken(token)
	if err != nil {
		return nil, err
	}
	return &authmw.TokenClaims{
		UserID:   claims.UserID,
		Email:    claims.Email,
		Verified: claims.Verified,
	}, nil
}

// wsTokenValidatorAdapter wraps auth.Service to implement realtime.TokenValidator
type wsTokenValidatorAdapter struct {
	service *auth.Service
}

func (a *wsTokenValidatorAdapter) ValidateToken(token string) (*realtime.TokenClaims, error) {
	claims, err := a.service.ValidateToken(token)
	if err != nil {
		return nil, err
	}
	return &realtime.TokenClaims{
		UserID:   claims.UserID,
		Email:    claims.Email,
		Verified: claims.Verified,
	}, nil
}

// matchNotifierAdapter wraps realtime.Notifier to implement matching.MatchNotifier
type matchNotifierAdapter struct {
	notifier *realtime.Notifier
	db       *database.DB
	hub      *realtime.Hub
	notifSvc *notifications.Service
}

func (a *matchNotifierAdapter) NotifyNewMatch(ctx context.Context, userID uuid.UUID, matchedUserName string, matchID uuid.UUID) error {
	// Look up match details to get conversation ID and photos
	var conversationID uuid.UUID
	var userAID, userBID uuid.UUID
	var userAName, userBName string
	var userAPhoto, userBPhoto *string
	var matchedAt time.Time

	err := a.db.Pool.QueryRow(ctx, `
		SELECT c.id, m.user_a, m.user_b, m.matched_at,
			ua.display_name, ua.profile_photo,
			ub.display_name, ub.profile_photo
		FROM matches m
		JOIN conversations c ON c.match_id = m.id
		JOIN users ua ON ua.id = m.user_a
		JOIN users ub ON ub.id = m.user_b
		WHERE m.id = $1
	`, matchID).Scan(&conversationID, &userAID, &userBID, &matchedAt,
		&userAName, &userAPhoto, &userBName, &userBPhoto)
	if err != nil {
		return err
	}

	// Send WebSocket notifications
	a.notifier.NotifyNewMatch(matchID, conversationID, userAID, userBID,
		userAName, userBName, userAPhoto, userBPhoto, matchedAt.UnixMilli())

	// Send push notifications to offline users
	if a.notifSvc != nil {
		// Notify user A if offline
		if !a.hub.IsUserOnline(userAID) {
			go a.notifSvc.SendToUser(ctx, userAID, &notifications.Notification{
				Type:  notifications.NotificationTypeNewMatch,
				Title: "New Match!",
				Body:  "You matched with " + userBName,
				Sound: "match.wav",
				Data: map[string]string{
					"type":     "new_match",
					"match_id": matchID.String(),
				},
			})
		}
		// Notify user B if offline
		if !a.hub.IsUserOnline(userBID) {
			go a.notifSvc.SendToUser(ctx, userBID, &notifications.Notification{
				Type:  notifications.NotificationTypeNewMatch,
				Title: "New Match!",
				Body:  "You matched with " + userAName,
				Sound: "match.wav",
				Data: map[string]string{
					"type":     "new_match",
					"match_id": matchID.String(),
				},
			})
		}
	}

	return nil
}

func (a *matchNotifierAdapter) NotifyNewLike(ctx context.Context, userID uuid.UUID) error {
	// Send push notification for new like (only when offline - no WebSocket event for privacy)
	if a.notifSvc != nil && !a.hub.IsUserOnline(userID) {
		go a.notifSvc.SendToUser(ctx, userID, &notifications.Notification{
			Type:  notifications.NotificationTypeNewLike,
			Title: "Someone Likes You!",
			Body:  "Open the app to see who",
			Sound: "like.wav",
			Data: map[string]string{
				"type": "new_like",
			},
		})
	}
	return nil
}

func (a *matchNotifierAdapter) NotifyUnmatch(ctx context.Context, matchID uuid.UUID, conversationID uuid.UUID, notifyUserID uuid.UUID) error {
	a.notifier.NotifyUnmatch(matchID, conversationID, notifyUserID)
	return nil
}

// chatNotifierAdapter sends push notifications for chat when user is offline
type chatNotifierAdapter struct {
	hub      *realtime.Hub
	notifSvc *notifications.Service
}

func (a *chatNotifierAdapter) NotifyNewMessage(ctx context.Context, userID uuid.UUID, senderName, messagePreview string, matchID uuid.UUID) error {
	// WebSocket message is already sent by conversation broadcast in realtime/client.go
	// Only send push notification if user is offline
	if !a.hub.IsUserOnline(userID) {
		// Truncate preview for push notification
		preview := messagePreview
		if len(preview) > 100 {
			preview = preview[:97] + "..."
		}

		return a.notifSvc.SendToUser(ctx, userID, &notifications.Notification{
			Type:  notifications.NotificationTypeNewMessage,
			Title: senderName,
			Body:  preview,
			Sound: "message.wav",
			Data: map[string]string{
				"type":     "new_message",
				"match_id": matchID.String(),
			},
		})
	}
	return nil
}

// callNotifierAdapter sends push notifications for incoming calls when user is offline
type callNotifierAdapter struct {
	notifSvc *notifications.Service
	db       *database.DB
}

func (a *callNotifierAdapter) NotifyIncomingCall(ctx context.Context, targetUserID uuid.UUID, callerName string, callerPhoto *string, callID string, matchID uuid.UUID, videoEnabled bool) error {
	if a.notifSvc == nil {
		return nil
	}

	// First try VoIP push for iOS (works when app is killed)
	// This will wake the app and display CallKit UI
	photo := ""
	if callerPhoto != nil {
		photo = *callerPhoto
	}

	voipErr := a.notifSvc.SendVoIPPush(ctx, targetUserID, &notifications.VoIPCallPayload{
		CallID:       callID,
		CallerID:     targetUserID.String(), // Will be replaced with actual caller ID
		CallerName:   callerName,
		CallerPhoto:  photo,
		MatchID:      matchID.String(),
		VideoEnabled: videoEnabled,
	})

	// Also send regular push for Android and web clients
	callType := "voice"
	if videoEnabled {
		callType = "video"
	}

	regularErr := a.notifSvc.SendToUser(ctx, targetUserID, &notifications.Notification{
		Type:  notifications.NotificationTypeSystem,
		Title: "Incoming Call",
		Body:  callerName + " is calling you",
		Sound: "call.wav",
		Data: map[string]string{
			"type":          "incoming_call",
			"call_id":       callID,
			"caller_name":   callerName,
			"match_id":      matchID.String(),
			"call_type":     callType,
			"video_enabled": fmt.Sprintf("%t", videoEnabled),
		},
	})

	// Return first error if any
	if voipErr != nil {
		return voipErr
	}
	return regularErr
}

func main() {
	migrateOnly := flag.Bool("migrate", false, "Run database migrations and exit")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	// Initialize structured logging
	logger.Init(cfg.Environment)

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Run migrations (always on startup, or exit if --migrate flag is set)
	if err := db.Migrate(context.Background()); err != nil {
		slog.Error("database migration failed", "error", err)
		os.Exit(1)
	}
	if *migrateOnly {
		slog.Info("migrations complete, exiting")
		return
	}

	// Initialize S3 storage client
	var s3Client *storage.S3Client
	if cfg.S3Bucket != "" {
		var err error
		s3Client, err = storage.NewS3Client(cfg)
		if err != nil {
			slog.Warn("Failed to initialize S3 client (photo signing disabled)", "error", err)
		} else {
			slog.Info("S3 client initialized", "bucket", cfg.S3Bucket, "region", cfg.S3Region)
		}
	}

	// Initialize GORM connection for packages that use it
	gormDB, err := database.OpenGorm(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to open GORM connection", "error", err)
		os.Exit(1)
	}

	// Initialize services
	authService := auth.NewService(cfg, db)
	if s3Client != nil {
		authService.SetPhotoSigner(s3Client)
	}
	authHandler := auth.NewHandler(authService)
	authMiddleware := authmw.NewAuthMiddleware(&tokenValidatorAdapter{service: authService})

	ageGateService := agegate.NewService(cfg, db)
	ageGateHandler := agegate.NewHandler(ageGateService)

	// Initialize WebSocket hub and handler
	wsHub := realtime.NewHub()
	go wsHub.Run() // Start hub in background
	wsNotifier := realtime.NewNotifier(wsHub)

	// Initialize notification service
	notifService, err := notifications.NewService(cfg, db)
	if err != nil {
		slog.Warn("notifications disabled", "error", err)
		notifService = nil
	}
	notifHandler := notifications.NewHandler(notifService)

	// Create chat notifier adapter and chat service
	var chatNotifier chat.ChatNotifier
	if notifService != nil {
		chatNotifier = &chatNotifierAdapter{
			hub:      wsHub,
			notifSvc: notifService,
		}
	}
	chatService := chat.NewService(db, chatNotifier)
	chatHandler := chat.NewHandler(chatService)

	// Create call notifier for incoming call push notifications
	var callNotifier realtime.CallNotifier
	if notifService != nil {
		callNotifier = &callNotifierAdapter{notifSvc: notifService, db: db}
	}

	wsHandler := realtime.NewHandlerWithAuth(wsHub, chatService, &wsTokenValidatorAdapter{service: authService}, callNotifier)

	// Configure WebSocket origin validation from config
	if cfg.Environment == "production" {
		realtime.SetAllowedOrigins(cfg.AllowedOrigins)
	}

	// Create match notifier adapter and matching service
	matchNotifier := &matchNotifierAdapter{
		notifier: wsNotifier,
		db:       db,
		hub:      wsHub,
		notifSvc: notifService,
	}
	matchingService := matching.NewService(db, matchNotifier)
	matchingHandler := matching.NewHandler(matchingService)

	// Wire presence filter so only matched users see each other's online status
	wsHub.SetPresenceFilter(matchingService)

	// Initialize calls signaling
	callRepo := calls.NewCallRepository(db.Pool)
	signalingHub := calls.NewSignalingHub(callRepo)
	callsHandler := calls.NewHandler(signalingHub, callRepo, matchingService)

	// Initialize marketplace services
	storeService := marketplace.NewStoreService(db)
	purchaseService := marketplace.NewPurchaseService(cfg, db)
	inventoryService := marketplace.NewInventoryService(db)
	creatorService := marketplace.NewCreatorService(cfg, db)
	marketplaceHandler := marketplace.NewHandler(cfg, storeService, purchaseService, inventoryService, creatorService)

	// Initialize admin services
	adminService := admin.NewService(db)
	adminHandler := admin.NewHandler(adminService)

	// Initialize haptic device services
	hapticService := haptic.NewService(db, wsHub)
	hapticHandler := haptic.NewHandler(hapticService)

	// Initialize companion session services
	sessionService := session.NewService(db.Pool, wsHub)
	sessionHandler := session.NewHandler(sessionService)

	// Initialize GORM-based services
	socialValidator := verification.NewSocialValidator(cfg.GoogleClientID)
	// Wire verification dependencies (real implementations when credentials available, stubs otherwise)
	var photoStore verification.PhotoStore = verification.LogPhotoStore{}
	if s3Client != nil {
		photoStore = verification.NewS3PhotoStore(s3Client)
		slog.Info("verification photo store: S3")
	}

	var smsService verification.SMSService = verification.LogSMSService{}
	if cfg.TwilioAccountSID != "" {
		smsService = verification.NewTwilioSMSService(cfg.TwilioAccountSID, cfg.TwilioAuthToken, cfg.TwilioFromNumber)
		slog.Info("verification SMS service: Twilio")
	}

	var emailService verification.EmailService = verification.LogEmailService{}
	if cfg.AWSAccessKeyID != "" && cfg.SESFromEmail != "" {
		sesService, err := verification.NewSESEmailService(cfg.AWSRegion, cfg.AWSAccessKeyID, cfg.AWSSecretAccessKey, cfg.SESFromEmail)
		if err != nil {
			slog.Warn("failed to initialize SES email service", "error", err)
		} else {
			emailService = sesService
			slog.Info("verification email service: SES")
		}
	}

	verificationService := verification.NewService(gormDB, photoStore, smsService, emailService)
	verificationHandler := verification.NewHandler(verificationService, socialValidator)

	analyticsService := analytics.NewService(gormDB)
	analyticsHandler := analytics.NewHandler(analyticsService)

	safetyService := safety.NewService(gormDB)
	safetyHandler := safety.NewHandler(safetyService)

	settingsService := settings.NewService(gormDB)
	settingsHandler := settings.NewHandler(settingsService)

	avatarService := avatar.NewService(gormDB)
	avatarHandler := avatar.NewHandler(avatarService)

	baseURL := "https://dryft.site"
	if cfg.IsDevelopment() {
		baseURL = "http://localhost:" + cfg.Port
	}
	linksService := links.NewService(gormDB, baseURL)
	linksHandler := links.NewHandler(linksService)

	// Initialize profile service (uses pgx DB, not GORM)
	profileService := profile.NewService(db)
	if s3Client != nil {
		profileService.SetPhotoSigner(s3Client)
	}
	var profileUploader profile.Uploader
	if s3Client != nil {
		profileUploader = s3Client
	}
	profileHandler := profile.NewHandler(profileService, profileUploader)

	// Wire subscription receipt validators
	var iosValidator subscription.ReceiptValidator = subscription.LogReceiptValidator{Platform: "ios"}
	if cfg.AppStoreSharedSecret != "" {
		iosValidator = subscription.NewAppStoreValidator(cfg.AppStoreSharedSecret, cfg.IsDevelopment())
		slog.Info("subscription iOS validator: App Store")
	}

	var androidValidator subscription.ReceiptValidator = subscription.LogReceiptValidator{Platform: "android"}
	if cfg.PlayStoreServiceAccountJSON != "" {
		psValidator, err := subscription.NewPlayStoreValidator(cfg.PlayStorePackageName, []byte(cfg.PlayStoreServiceAccountJSON))
		if err != nil {
			slog.Warn("failed to initialize Play Store validator", "error", err)
		} else {
			androidValidator = psValidator
			slog.Info("subscription Android validator: Play Store")
		}
	}

	subscriptionService := subscription.NewService(gormDB, iosValidator, androidValidator)
	subscriptionHandler := subscription.NewHandler(subscriptionService)

	// Connect to Redis (optional — falls back to in-memory if unavailable)
	var redisClient *redis.Client
	if cfg.RedisURL != "" {
		opts, err := redis.ParseURL(cfg.RedisURL)
		if err != nil {
			slog.Warn("invalid REDIS_URL, falling back to in-memory rate limiter", "error", err)
		} else {
			redisClient = redis.NewClient(opts)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := redisClient.Ping(ctx).Err(); err != nil {
				slog.Warn("Redis unreachable, falling back to in-memory rate limiter", "error", err)
				redisClient.Close()
				redisClient = nil
			} else {
				slog.Info("Redis connected", "addr", opts.Addr)
			}
			cancel()
		}
	}
	if redisClient != nil {
		defer redisClient.Close()
	}

	// Set up router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(skipForWebSocket(middleware.Timeout(60 * time.Second)))
	r.Use(metrics.Middleware)

	// Request body size limit: 10 MB
	r.Use(authmw.MaxBodySize(10 << 20))

	// Rate limiting (configurable via RATE_LIMIT_REQUESTS and RATE_LIMIT_WINDOW)
	if redisClient != nil {
		redisRL := authmw.NewRedisRateLimiter(redisClient, cfg.RateLimitRequests, cfg.RateLimitWindow)
		r.Use(redisRL.Limit)
	} else {
		memRL := authmw.NewRateLimiter(cfg.RateLimitRequests, cfg.RateLimitWindow)
		r.Use(memRL.Limit)
	}

	// Security headers
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			next.ServeHTTP(w, r)
		})
	})

	// CORS - configure for production
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check (liveness probe) - basic check that app is running
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		status := "healthy"
		httpStatus := http.StatusOK
		dbStatus := "ok"

		// Check database connectivity
		if err := db.Ping(r.Context()); err != nil {
			status = "degraded"
			dbStatus = "unreachable"
			httpStatus = http.StatusServiceUnavailable
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(httpStatus)
		fmt.Fprintf(w, `{"status":"%s","database":"%s","timestamp":"%s","version":"v1"}`,
			status, dbStatus, time.Now().UTC().Format(time.RFC3339))
	})

	// Ready check (readiness probe) - checks if app can serve traffic
	// Returns 200 only when all critical dependencies are available
	r.Get("/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		ready := true
		checks := make(map[string]string)

		// Check database connectivity
		if err := db.Ping(ctx); err != nil {
			ready = false
			checks["database"] = "unreachable"
		} else {
			checks["database"] = "ok"
		}

		// Check Redis connectivity (if configured)
		if redisClient != nil {
			if err := redisClient.Ping(ctx).Err(); err != nil {
				ready = false
				checks["redis"] = "unreachable"
			} else {
				checks["redis"] = "ok"
			}
		} else {
			checks["redis"] = "not_configured"
		}

		w.Header().Set("Content-Type", "application/json")
		if ready {
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, `{"ready":true,"checks":{"database":"%s","redis":"%s"},"timestamp":"%s"}`,
				checks["database"], checks["redis"], time.Now().UTC().Format(time.RFC3339))
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprintf(w, `{"ready":false,"checks":{"database":"%s","redis":"%s"},"timestamp":"%s"}`,
				checks["database"], checks["redis"], time.Now().UTC().Format(time.RFC3339))
		}
	})

	// Prometheus metrics endpoint
	r.Handle("/metrics", metrics.Handler())

	// API documentation
	r.Get("/docs/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
		data, err := os.ReadFile("openapi.yaml")
		if err != nil {
			http.Error(w, "openapi spec not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/yaml")
		w.Write(data)
	})
	r.Get("/docs", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, `<!DOCTYPE html>
<html><head><title>Dryft API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:"/docs/openapi.yaml",dom_id:"#swagger-ui"})</script>
</body></html>`)
	})

	// API v1 routes
	r.Route("/v1", func(r chi.Router) {
		// Public auth endpoints (no authentication required)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)
			r.Post("/refresh", authHandler.Refresh)
		})

		// Protected user endpoints
		r.Route("/users", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Get("/me", authHandler.GetCurrentUser)
			r.Put("/me", authHandler.UpdateProfile)
		})

		// Profile management (require auth + verification)
		r.Route("/profile", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Use(authMiddleware.RequireVerified)

			r.Get("/", profileHandler.GetProfile)
			r.Patch("/", profileHandler.UpdateProfile)
			r.Put("/location", profileHandler.UpdateLocation)
			r.Get("/preferences", profileHandler.GetPreferences)
			r.Put("/preferences", profileHandler.UpdatePreferences)
			r.Post("/photos", profileHandler.UploadPhoto)
			r.Delete("/photos/{index}", profileHandler.DeletePhoto)
			r.Put("/photos/reorder", profileHandler.ReorderPhotos)
			r.Get("/photos/{index}/url", profileHandler.GetPhotoURL)
			r.Post("/photos/upload-url", profileHandler.GetUploadURL)
			r.Post("/photos/confirm", profileHandler.ConfirmUpload)
		})

		// Age verification endpoints (require authentication)
		r.Route("/age-gate", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)

			// Card verification
			r.Post("/card/initiate", ageGateHandler.InitiateCardVerification)
			r.Post("/card/confirm", ageGateHandler.ConfirmCardVerification)

			// ID verification
			r.Post("/id/initiate", ageGateHandler.InitiateIDVerification)

			// Status
			r.Get("/status", ageGateHandler.GetVerificationStatus)
			r.Post("/retry", ageGateHandler.RetryVerification)
		})

		// Jumio webhook (no auth - uses webhook secret for verification)
		r.Post("/age-gate/id/webhook", ageGateHandler.HandleJumioWebhook)

		// Discovery endpoints (require verification)
		r.Route("/discover", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Use(authMiddleware.RequireVerified)

			r.Get("/", matchingHandler.GetDiscoverProfiles)
			r.Post("/swipe", matchingHandler.Swipe)
		})

		// Matches endpoints (require verification)
		r.Route("/matches", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Use(authMiddleware.RequireVerified)

			r.Get("/", matchingHandler.GetMatches)
			r.Get("/{matchID}", matchingHandler.GetMatch)
			r.Delete("/{matchID}", matchingHandler.Unmatch)
			r.Get("/{matchID}/conversation", chatHandler.GetConversationByMatch)
		})

		// Conversations endpoints (require verification)
		r.Route("/conversations", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Use(authMiddleware.RequireVerified)

			r.Get("/", chatHandler.GetConversations)
			r.Get("/{conversationID}", chatHandler.GetConversation)
			r.Get("/{conversationID}/messages", chatHandler.GetMessages)
			r.Post("/{conversationID}/messages", chatHandler.SendMessage)
			r.Post("/{conversationID}/read", chatHandler.MarkAsRead)
		})

		// Notifications endpoints (require auth)
		r.Route("/notifications", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)

			// Device registration (FCM - all platforms)
			r.Post("/devices", notifHandler.RegisterDevice)
			r.Delete("/devices/{deviceId}", notifHandler.UnregisterDevice)

			// VoIP device registration (APNs VoIP - iOS only)
			r.Post("/voip-devices", notifHandler.RegisterVoIPDevice)
			r.Delete("/voip-devices", notifHandler.UnregisterVoIPDevice)

			// Notification history
			r.Get("/", notifHandler.GetNotifications)
			r.Get("/unread-count", notifHandler.GetUnreadCount)
			r.Post("/{id}/read", notifHandler.MarkRead)
			r.Post("/read-all", notifHandler.MarkAllRead)
		})

		// WebSocket endpoint (OptionalAuth so ?token= query param fallback works;
		// ServeWS does its own auth check and rejects unauthenticated requests)
		r.Route("/ws", func(r chi.Router) {
			r.Use(authMiddleware.OptionalAuth)
			r.Get("/", wsHandler.ServeWS)
		})

		// Calls endpoints (require auth + verification)
		r.Route("/calls", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Use(authMiddleware.RequireVerified)
			callsHandler.RegisterRoutes(r)
		})

		// Haptic device endpoints (require auth + verification)
		r.Route("/haptic", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Use(authMiddleware.RequireVerified)

			// Device management
			r.Post("/devices", hapticHandler.RegisterDevice)
			r.Get("/devices", hapticHandler.GetDevices)
			r.Get("/devices/{deviceId}", hapticHandler.GetDevice)
			r.Patch("/devices/{deviceId}", hapticHandler.UpdateDevice)
			r.Delete("/devices/{deviceId}", hapticHandler.DeleteDevice)

			// Permission management
			r.Post("/permissions", hapticHandler.SetPermission)
			r.Get("/permissions/match/{matchId}", hapticHandler.GetMatchPermissions)
			r.Delete("/permissions", hapticHandler.RevokePermission)

			// Commands
			r.Post("/command", hapticHandler.SendCommand)

			// Patterns
			r.Get("/patterns", hapticHandler.GetPatterns)
			r.Get("/patterns/{patternId}", hapticHandler.GetPattern)

			// Match devices (view other user's devices in a match)
			r.Get("/match/{matchId}/devices", hapticHandler.GetMatchDevices)
		})

		// Companion session endpoints (VR <-> Mobile/Web interaction)
		r.Route("/sessions", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Use(authMiddleware.RequireVerified)
			sessionHandler.RegisterRoutes(r)
		})

		// Store endpoints (public browsing, auth optional for ownership check)
		r.Route("/store", func(r chi.Router) {
			r.Use(authMiddleware.OptionalAuth)

			r.Get("/items", marketplaceHandler.GetItems)
			r.Get("/items/{itemID}", marketplaceHandler.GetItem)
			r.Get("/featured", marketplaceHandler.GetFeaturedItems)
			r.Get("/popular", marketplaceHandler.GetPopularItems)
			r.Get("/categories", marketplaceHandler.GetCategories)
			r.Get("/categories/{slug}/items", marketplaceHandler.GetItemsByCategory)
			r.Get("/search", marketplaceHandler.SearchItems)

			// Purchase endpoints (require auth + verification)
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware.RequireAuth)
				r.Use(authMiddleware.RequireVerified)

				r.Post("/purchase", marketplaceHandler.InitiatePurchase)
				r.Get("/purchases", marketplaceHandler.GetPurchaseHistory)
			})
		})

		// Inventory endpoints (require auth + verification)
		r.Route("/inventory", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Use(authMiddleware.RequireVerified)

			r.Get("/", marketplaceHandler.GetInventory)
			r.Get("/equipped", marketplaceHandler.GetEquippedItems)
			r.Post("/equip", marketplaceHandler.EquipItem)
			r.Post("/unequip", marketplaceHandler.UnequipItem)
			r.Get("/{itemID}/asset", marketplaceHandler.GetAssetBundle)
		})

		// Creator endpoints
		r.Route("/creators", func(r chi.Router) {
			// Public endpoints (no auth required for discovery)
			r.Get("/featured", marketplaceHandler.GetFeaturedCreators)
			r.Get("/{creatorID}", marketplaceHandler.GetCreator)
			r.Get("/{creatorID}/items", marketplaceHandler.GetCreatorItems)

			// Protected creator management
			r.Group(func(r chi.Router) {
				r.Use(authMiddleware.RequireAuth)
				r.Use(authMiddleware.RequireVerified)

				r.Post("/", marketplaceHandler.BecomeCreator)
				r.Get("/me", marketplaceHandler.GetMyCreatorAccount)
				r.Patch("/me", marketplaceHandler.UpdateCreatorProfile)
				r.Post("/onboarding-link", marketplaceHandler.GetOnboardingLink)
				r.Get("/earnings", marketplaceHandler.GetMyEarnings)
				r.Get("/items", marketplaceHandler.GetMyItems)
			})
		})

		// Stripe webhooks (no auth - uses webhook signatures)
		r.Post("/webhooks/stripe/marketplace", marketplaceHandler.HandleStripeWebhook)
		r.Post("/webhooks/stripe/connect", marketplaceHandler.HandleStripeConnectWebhook)

		// Verification endpoints (require auth; handler registers /verification prefix)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			verificationHandler.RegisterRoutes(r)
		})

		// Analytics endpoints (require auth; handler registers /analytics prefix)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			analyticsHandler.RegisterRoutes(r)
		})

		// Safety endpoints (require auth + verified; handler registers /safety prefix)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Use(authMiddleware.RequireVerified)
			safetyHandler.RegisterRoutes(r)
		})

		// User settings (require auth; handler registers /settings prefix)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			settingsHandler.RegisterRoutes(r)
		})

		// Avatar endpoints (require auth + verified; handler registers /avatar prefix)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			r.Use(authMiddleware.RequireVerified)
			avatarHandler.RegisterRoutes(r)
		})

		// Deep links and invite links (require auth; handler registers /links prefix)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			linksHandler.RegisterRoutes(r)
		})

		// Subscription and entitlements (require auth; handler registers /subscriptions prefix)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			subscriptionHandler.RegisterRoutes(r)
		})

		// Admin endpoints (require auth + admin role)
		r.Route("/admin", func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			adminHandler.RegisterRoutes(r)
		})

		// Safety admin endpoints (require auth; handler registers /admin/safety prefix)
		r.Group(func(r chi.Router) {
			r.Use(authMiddleware.RequireAuth)
			safetyHandler.RegisterAdminRoutes(r)
		})
	})

	// Server setup
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		slog.Info("server starting", "port", cfg.Port, "environment", cfg.Environment)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-done
	slog.Info("server stopping...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped")
}
