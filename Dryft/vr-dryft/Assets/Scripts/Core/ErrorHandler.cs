using UnityEngine;
using System;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace Drift.Core
{
    /// <summary>
    /// Error types for categorization.
    /// </summary>
    public enum ErrorType
    {
        Network,
        Auth,
        Validation,
        Server,
        Timeout,
        Unknown
    }

    /// <summary>
    /// Represents an application error with metadata.
    /// </summary>
    public class AppError : Exception
    {
        public ErrorType Type { get; }
        public string Code { get; }
        public bool Retryable { get; }

        public AppError(ErrorType type, string message, string code = null, bool retryable = true)
            : base(message)
        {
            Type = type;
            Code = code;
            Retryable = retryable;
        }

        public static AppError FromException(Exception ex)
        {
            if (ex == null)
            {
                return new AppError(ErrorType.Unknown, "Unknown error occurred");
            }

            var message = ex.Message.ToLower();

            // Network errors
            if (message.Contains("network") ||
                message.Contains("connection") ||
                message.Contains("socket") ||
                message.Contains("unreachable"))
            {
                return new AppError(ErrorType.Network, "Unable to connect. Please check your internet connection.", retryable: true);
            }

            // Timeout errors
            if (message.Contains("timeout") || message.Contains("timed out"))
            {
                return new AppError(ErrorType.Timeout, "Request timed out. Please try again.", retryable: true);
            }

            // Auth errors
            if (message.Contains("unauthorized") || message.Contains("401") || message.Contains("token"))
            {
                return new AppError(ErrorType.Auth, "Session expired. Please log in again.", "AUTH_EXPIRED", retryable: false);
            }

            // Server errors
            if (message.Contains("500") || message.Contains("server error"))
            {
                return new AppError(ErrorType.Server, "Server error. Please try again later.", retryable: true);
            }

            return new AppError(ErrorType.Unknown, ex.Message, retryable: true);
        }
    }

    /// <summary>
    /// Configuration for retry logic.
    /// </summary>
    public class RetryConfig
    {
        public int MaxRetries { get; set; } = 3;
        public float InitialDelaySeconds { get; set; } = 1f;
        public float MaxDelaySeconds { get; set; } = 10f;
        public float BackoffMultiplier { get; set; } = 2f;
        public HashSet<ErrorType> RetryableTypes { get; set; } = new HashSet<ErrorType>
        {
            ErrorType.Network,
            ErrorType.Timeout,
            ErrorType.Server
        };
    }

    /// <summary>
    /// Handles errors, retry logic, and offline state management.
    /// </summary>
    public class ErrorHandler : MonoBehaviour
    {
        public static ErrorHandler Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private int maxRetries = 3;
        [SerializeField] private float initialDelaySeconds = 1f;
        [SerializeField] private float maxDelaySeconds = 10f;

        // Events
        public event Action<AppError> OnError;
        public event Action<bool> OnConnectivityChanged;
        public event Action OnSessionExpired;

        // State
        public bool IsOnline { get; private set; } = true;
        private float _lastConnectivityCheck;
        private const float ConnectivityCheckInterval = 5f;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Update()
        {
            // Periodic connectivity check
            if (Time.time - _lastConnectivityCheck > ConnectivityCheckInterval)
            {
                _lastConnectivityCheck = Time.time;
                CheckConnectivity();
            }
        }

        /// <summary>
        /// Executes an async operation with retry logic.
        /// </summary>
        public async Task<T> WithRetryAsync<T>(
            Func<Task<T>> operation,
            RetryConfig config = null)
        {
            config ??= new RetryConfig
            {
                MaxRetries = maxRetries,
                InitialDelaySeconds = initialDelaySeconds,
                MaxDelaySeconds = maxDelaySeconds
            };

            AppError lastError = null;
            float delay = config.InitialDelaySeconds;

            for (int attempt = 0; attempt <= config.MaxRetries; attempt++)
            {
                try
                {
                    return await operation();
                }
                catch (Exception ex)
                {
                    lastError = ex is AppError appError ? appError : AppError.FromException(ex);

                    // Don't retry non-retryable errors
                    if (!lastError.Retryable || !config.RetryableTypes.Contains(lastError.Type))
                    {
                        HandleError(lastError);
                        throw lastError;
                    }

                    // Don't retry on last attempt
                    if (attempt == config.MaxRetries)
                    {
                        HandleError(lastError);
                        throw lastError;
                    }

                    Debug.Log($"[ErrorHandler] Attempt {attempt + 1}/{config.MaxRetries} failed, retrying in {delay:F1}s...");

                    // Wait before retry with exponential backoff
                    await Task.Delay(TimeSpan.FromSeconds(delay));
                    delay = Mathf.Min(delay * config.BackoffMultiplier, config.MaxDelaySeconds);
                }
            }

            throw lastError ?? new AppError(ErrorType.Unknown, "Operation failed");
        }

        /// <summary>
        /// Handles an error (logging, events, etc.).
        /// </summary>
        public void HandleError(AppError error)
        {
            Debug.LogError($"[ErrorHandler] {error.Type}: {error.Message}");

            OnError?.Invoke(error);

            if (error.Type == ErrorType.Auth)
            {
                OnSessionExpired?.Invoke();
            }

            if (error.Type == ErrorType.Network)
            {
                SetOnlineState(false);
            }

            // Report to analytics
            ReportError(error);
        }

        /// <summary>
        /// Reports an error to analytics/crash reporting.
        /// </summary>
        private void ReportError(AppError error)
        {
            // Log locally for all builds
            Debug.Log($"[ErrorReport] Type: {error.Type}, Code: {error.Code}, Message: {error.Message}");

            // Report to backend analytics if available and online
            if (IsOnline && ApiClient.Instance != null)
            {
                try
                {
                    _ = ApiClient.Instance.PostAsync<object>("/v1/analytics/events", new
                    {
                        event_type = "client_error",
                        properties = new
                        {
                            error_type = error.Type.ToString(),
                            error_code = error.Code ?? "",
                            error_message = error.Message,
                            platform = "vr",
                            unity_version = Application.unityVersion,
                            device_model = SystemInfo.deviceModel
                        }
                    });
                }
                catch
                {
                    // Swallow - error reporting should never crash the app
                }
            }
        }

        /// <summary>
        /// Sets the online state and fires events if changed.
        /// </summary>
        private void SetOnlineState(bool isOnline)
        {
            if (IsOnline != isOnline)
            {
                IsOnline = isOnline;
                OnConnectivityChanged?.Invoke(isOnline);
                Debug.Log($"[ErrorHandler] Connectivity changed: {(isOnline ? "Online" : "Offline")}");
            }
        }

        /// <summary>
        /// Checks network connectivity.
        /// </summary>
        private async void CheckConnectivity()
        {
            bool wasOnline = IsOnline;

            try
            {
                // Check Unity's network reachability
                if (Application.internetReachability == NetworkReachability.NotReachable)
                {
                    SetOnlineState(false);
                    return;
                }

                // Try to reach our API
                var healthCheck = await ApiClient.Instance?.HealthCheckAsync();
                SetOnlineState(healthCheck ?? false);

                // If we just came back online, trigger queue processing
                if (!wasOnline && IsOnline)
                {
                    ProcessOfflineQueue();
                }
            }
            catch
            {
                SetOnlineState(false);
            }
        }

        /// <summary>
        /// Gets a user-friendly error message.
        /// </summary>
        public static string GetUserMessage(AppError error)
        {
            return error.Type switch
            {
                ErrorType.Network => "No internet connection. Please check your network and try again.",
                ErrorType.Auth => "Your session has expired. Please log in again.",
                ErrorType.Timeout => "The request took too long. Please try again.",
                ErrorType.Server => "Something went wrong on our end. Please try again later.",
                ErrorType.Validation => error.Message,
                _ => "Something went wrong. Please try again."
            };
        }

        // =======================================================================
        // Offline Queue
        // =======================================================================

        private Queue<Func<Task>> _offlineQueue = new Queue<Func<Task>>();

        /// <summary>
        /// Enqueues an operation to be executed when back online.
        /// </summary>
        public void EnqueueForOffline(Func<Task> operation)
        {
            _offlineQueue.Enqueue(operation);
            Debug.Log($"[ErrorHandler] Enqueued operation. Queue size: {_offlineQueue.Count}");
        }

        /// <summary>
        /// Processes queued operations when back online.
        /// </summary>
        private async void ProcessOfflineQueue()
        {
            Debug.Log($"[ErrorHandler] Processing offline queue ({_offlineQueue.Count} items)...");

            while (_offlineQueue.Count > 0 && IsOnline)
            {
                var operation = _offlineQueue.Dequeue();
                try
                {
                    await WithRetryAsync(async () =>
                    {
                        await operation();
                        return true;
                    });
                }
                catch (AppError error)
                {
                    if (error.Type == ErrorType.Network)
                    {
                        // Re-enqueue if we went offline
                        _offlineQueue.Enqueue(operation);
                        break;
                    }
                    // Otherwise, discard the failed operation
                    Debug.LogWarning($"[ErrorHandler] Dropped queued operation: {error.Message}");
                }
            }

            Debug.Log($"[ErrorHandler] Queue processing complete. Remaining: {_offlineQueue.Count}");
        }

        /// <summary>
        /// Clears the offline queue.
        /// </summary>
        public void ClearOfflineQueue()
        {
            _offlineQueue.Clear();
        }
    }
}
