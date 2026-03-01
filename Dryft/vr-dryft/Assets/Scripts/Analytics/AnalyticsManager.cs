using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Networking;

namespace Drift.Analytics
{
    [Serializable]
    public class AnalyticsEvent
    {
        public string name;
        public Dictionary<string, object> properties;
        public long timestamp;
        public string sessionId;
    }

    [Serializable]
    public class EventBatch
    {
        public List<SerializableEvent> events;
        public string userId;
        public Dictionary<string, object> userProperties;
        public string sessionId;
        public long timestamp;
    }

    [Serializable]
    public class SerializableEvent
    {
        public string name;
        public string properties; // JSON string
        public long timestamp;
        public string sessionId;
    }

    public class AnalyticsManager : MonoBehaviour
    {
        public static AnalyticsManager Instance { get; private set; }

        [Header("Configuration")]
        [SerializeField] private string analyticsEndpoint = "/v1/analytics/events";
        [SerializeField] private int batchSize = 20;
        [SerializeField] private float flushInterval = 30f;
        [SerializeField] private bool debugMode = true;

        private string _sessionId;
        private string _userId;
        private Dictionary<string, object> _userProperties = new Dictionary<string, object>();
        private List<AnalyticsEvent> _eventQueue = new List<AnalyticsEvent>();
        private float _sessionStartTime;
        private bool _isInitialized;

        // VR-specific tracking
        private float _vrSessionStartTime;
        private bool _inVRSession;
        private string _currentEnvironment;
        private Vector3 _lastPosition;
        private float _totalDistanceTraveled;

        // Performance tracking
        private int _frameCount;
        private float _fpsAccumulator;
        private float _lastFpsCheck;
        private const float FPS_CHECK_INTERVAL = 5f;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            Initialize();
        }

        private void Initialize()
        {
            _sessionId = GenerateSessionId();
            _sessionStartTime = Time.realtimeSinceStartup;

            _userProperties["platform"] = "vr";
            _userProperties["device"] = SystemInfo.deviceModel;
            _userProperties["os"] = SystemInfo.operatingSystem;
            _userProperties["unity_version"] = Application.unityVersion;
            _userProperties["app_version"] = Application.version;

            _isInitialized = true;
            StartCoroutine(FlushRoutine());
            StartCoroutine(PerformanceMonitorRoutine());

            Log("Analytics initialized");
        }

        private void Update()
        {
            // Track FPS
            _frameCount++;
            _fpsAccumulator += Time.deltaTime;

            // Track movement in VR
            if (_inVRSession && Camera.main != null)
            {
                var currentPos = Camera.main.transform.position;
                _totalDistanceTraveled += Vector3.Distance(_lastPosition, currentPos);
                _lastPosition = currentPos;
            }
        }

        #region User Identification

        public void Identify(string userId, Dictionary<string, object> properties = null)
        {
            _userId = userId;
            if (properties != null)
            {
                foreach (var kvp in properties)
                {
                    _userProperties[kvp.Key] = kvp.Value;
                }
            }
            Log($"User identified: {userId}");
        }

        public void SetUserProperty(string key, object value)
        {
            _userProperties[key] = value;
        }

        public void Reset()
        {
            _userId = null;
            _userProperties.Clear();
            _sessionId = GenerateSessionId();
            _sessionStartTime = Time.realtimeSinceStartup;
            Log("Analytics reset");
        }

        #endregion

        #region Event Tracking

        public void Track(string eventName, Dictionary<string, object> properties = null)
        {
            if (!_isInitialized) return;

            var evt = new AnalyticsEvent
            {
                name = eventName,
                properties = properties ?? new Dictionary<string, object>(),
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                sessionId = _sessionId
            };

            // Add session duration
            evt.properties["session_duration"] = Time.realtimeSinceStartup - _sessionStartTime;

            _eventQueue.Add(evt);
            Log($"Event tracked: {eventName}");

            if (_eventQueue.Count >= batchSize)
            {
                StartCoroutine(FlushEvents());
            }
        }

        #endregion

        #region VR Session Tracking

        public void TrackVRSessionStart(string environment = null)
        {
            _inVRSession = true;
            _vrSessionStartTime = Time.realtimeSinceStartup;
            _currentEnvironment = environment;
            _totalDistanceTraveled = 0f;

            if (Camera.main != null)
            {
                _lastPosition = Camera.main.transform.position;
            }

            Track("vr_session_started", new Dictionary<string, object>
            {
                { "environment", environment ?? "unknown" },
                { "headset", UnityEngine.XR.XRSettings.loadedDeviceName }
            });
        }

        public void TrackVRSessionEnd()
        {
            if (!_inVRSession) return;

            var duration = Time.realtimeSinceStartup - _vrSessionStartTime;
            _inVRSession = false;

            Track("vr_session_ended", new Dictionary<string, object>
            {
                { "duration_seconds", duration },
                { "environment", _currentEnvironment ?? "unknown" },
                { "distance_traveled", _totalDistanceTraveled }
            });
        }

        public void TrackBoothEnter(string boothId, string partnerUserId = null)
        {
            Track("vr_booth_entered", new Dictionary<string, object>
            {
                { "booth_id", boothId },
                { "partner_user_id", partnerUserId },
                { "has_partner", !string.IsNullOrEmpty(partnerUserId) }
            });
        }

        public void TrackBoothExit(string boothId, float duration)
        {
            Track("vr_booth_exited", new Dictionary<string, object>
            {
                { "booth_id", boothId },
                { "duration_seconds", duration }
            });
        }

        public void TrackLoungeJoin(int userCount)
        {
            Track("vr_lounge_joined", new Dictionary<string, object>
            {
                { "user_count", userCount }
            });
        }

        #endregion

        #region Interaction Tracking

        public void TrackGesture(string gestureType, string targetUserId = null)
        {
            Track("vr_gesture_performed", new Dictionary<string, object>
            {
                { "gesture_type", gestureType },
                { "target_user_id", targetUserId },
                { "has_target", !string.IsNullOrEmpty(targetUserId) }
            });
        }

        public void TrackVoiceChatStart(string matchId)
        {
            Track("voice_chat_started", new Dictionary<string, object>
            {
                { "match_id", matchId }
            });
        }

        public void TrackVoiceChatEnd(string matchId, float duration)
        {
            Track("voice_chat_ended", new Dictionary<string, object>
            {
                { "match_id", matchId },
                { "duration_seconds", duration }
            });
        }

        public void TrackHapticEvent(string eventType, string deviceId, int intensity)
        {
            Track("haptic_event", new Dictionary<string, object>
            {
                { "event_type", eventType },
                { "device_id", deviceId },
                { "intensity", intensity }
            });
        }

        #endregion

        #region Safety Tracking

        public void TrackPanicButton(string location, string context = null)
        {
            Track("panic_button_pressed", new Dictionary<string, object>
            {
                { "location", location },
                { "context", context },
                { "environment", _currentEnvironment }
            });
        }

        public void TrackBlock(string blockedUserId, string reason = null)
        {
            Track("user_blocked", new Dictionary<string, object>
            {
                { "blocked_user_id", blockedUserId },
                { "reason", reason },
                { "location", _currentEnvironment }
            });
        }

        public void TrackReport(string reportedUserId, string reason, string details = null)
        {
            Track("user_reported", new Dictionary<string, object>
            {
                { "reported_user_id", reportedUserId },
                { "reason", reason },
                { "details", details },
                { "location", _currentEnvironment }
            });
        }

        #endregion

        #region Performance Tracking

        private IEnumerator PerformanceMonitorRoutine()
        {
            while (true)
            {
                yield return new WaitForSeconds(FPS_CHECK_INTERVAL);

                if (_inVRSession && _fpsAccumulator > 0)
                {
                    var avgFps = _frameCount / _fpsAccumulator;

                    // Only track if there's an issue
                    if (avgFps < 72) // Below Quest 2 target
                    {
                        Track("performance_warning", new Dictionary<string, object>
                        {
                            { "avg_fps", avgFps },
                            { "environment", _currentEnvironment },
                            { "memory_mb", SystemInfo.systemMemorySize }
                        });
                    }

                    _frameCount = 0;
                    _fpsAccumulator = 0;
                }
            }
        }

        public void TrackLoadTime(string scene, float loadTimeSeconds)
        {
            Track("scene_loaded", new Dictionary<string, object>
            {
                { "scene_name", scene },
                { "load_time_seconds", loadTimeSeconds }
            });
        }

        public void TrackError(string errorType, string message, string stackTrace = null)
        {
            Track("error_occurred", new Dictionary<string, object>
            {
                { "error_type", errorType },
                { "message", message },
                { "stack_trace", stackTrace?.Substring(0, Math.Min(stackTrace.Length, 500)) },
                { "environment", _currentEnvironment }
            });
        }

        #endregion

        #region Flush Events

        private IEnumerator FlushRoutine()
        {
            while (true)
            {
                yield return new WaitForSeconds(flushInterval);
                yield return FlushEvents();
            }
        }

        private IEnumerator FlushEvents()
        {
            if (_eventQueue.Count == 0) yield break;

            var eventsToSend = new List<AnalyticsEvent>(_eventQueue);
            _eventQueue.Clear();

            var batch = new EventBatch
            {
                events = new List<SerializableEvent>(),
                userId = _userId,
                userProperties = _userProperties,
                sessionId = _sessionId,
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            foreach (var evt in eventsToSend)
            {
                batch.events.Add(new SerializableEvent
                {
                    name = evt.name,
                    properties = JsonUtility.ToJson(new SerializableDict(evt.properties)),
                    timestamp = evt.timestamp,
                    sessionId = evt.sessionId
                });
            }

            var json = JsonUtility.ToJson(batch);

            using (var request = new UnityWebRequest(analyticsEndpoint, "POST"))
            {
                byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
                request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                request.downloadHandler = new DownloadHandlerBuffer();
                request.SetRequestHeader("Content-Type", "application/json");

                yield return request.SendWebRequest();

                if (request.result != UnityWebRequest.Result.Success)
                {
                    Log($"Failed to flush events: {request.error}");
                    // Re-queue events
                    _eventQueue.InsertRange(0, eventsToSend);
                }
                else
                {
                    Log($"Flushed {eventsToSend.Count} events");
                }
            }
        }

        #endregion

        #region Utilities

        private string GenerateSessionId()
        {
            return $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid().ToString().Substring(0, 8)}";
        }

        private void Log(string message)
        {
            if (debugMode)
            {
                Debug.Log($"[Analytics] {message}");
            }
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused)
            {
                StartCoroutine(FlushEvents());
            }
        }

        private void OnApplicationQuit()
        {
            if (_inVRSession)
            {
                TrackVRSessionEnd();
            }
            // Synchronous flush on quit
            // In production, you'd want to persist events to disk
        }

        #endregion
    }

    // Helper class for JSON serialization
    [Serializable]
    public class SerializableDict
    {
        public List<string> keys = new List<string>();
        public List<string> values = new List<string>();

        public SerializableDict(Dictionary<string, object> dict)
        {
            foreach (var kvp in dict)
            {
                keys.Add(kvp.Key);
                values.Add(kvp.Value?.ToString() ?? "null");
            }
        }
    }
}
