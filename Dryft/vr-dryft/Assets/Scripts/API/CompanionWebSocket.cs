using System;
using System.Collections.Generic;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace Drift.API
{
    /// <summary>
    /// WebSocket client for companion session real-time communication.
    /// Handles connection, message sending/receiving, and automatic reconnection.
    /// </summary>
    public class CompanionWebSocket : MonoBehaviour
    {
        public static CompanionWebSocket Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private string _wsUrl = "ws://localhost:8080/v1/ws";
        [SerializeField] private float _reconnectDelay = 3f;
        [SerializeField] private bool _autoReconnect = true;
        [SerializeField] private bool _logMessages = true;

        // State
        private ClientWebSocket _socket;
        private CancellationTokenSource _cancellation;
        private string _authToken;
        private bool _isConnecting;
        private bool _shouldReconnect;

        // Events
        public event Action OnConnected;
        public event Action OnDisconnected;
        public event Action<string> OnError;
        public event Action<WebSocketMessage> OnMessageReceived;

        // Properties
        public bool IsConnected => _socket?.State == WebSocketState.Open;

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

        private void OnDestroy()
        {
            if (Instance == this)
            {
                _ = Disconnect();
                Instance = null;
            }
        }

        private void OnApplicationQuit()
        {
            _shouldReconnect = false;
            _ = Disconnect();
        }

        /// <summary>
        /// Configures the WebSocket URL.
        /// </summary>
        public void Configure(string wsUrl)
        {
            _wsUrl = wsUrl;
        }

        /// <summary>
        /// Connects to the WebSocket server.
        /// </summary>
        public async Task<bool> Connect(string authToken)
        {
            if (_isConnecting || IsConnected) return IsConnected;

            _authToken = authToken;
            _isConnecting = true;
            _shouldReconnect = _autoReconnect;

            try
            {
                _socket = new ClientWebSocket();
                _cancellation = new CancellationTokenSource();

                // Add auth token as query parameter
                string url = $"{_wsUrl}?token={authToken}";

                Log($"Connecting to {_wsUrl}...");
                await _socket.ConnectAsync(new Uri(url), _cancellation.Token);

                if (_socket.State == WebSocketState.Open)
                {
                    Log("Connected");
                    OnConnected?.Invoke();
                    _ = ReceiveLoop();
                    return true;
                }
            }
            catch (Exception ex)
            {
                Log($"Connection failed: {ex.Message}");
                OnError?.Invoke(ex.Message);
            }
            finally
            {
                _isConnecting = false;
            }

            return false;
        }

        /// <summary>
        /// Disconnects from the WebSocket server.
        /// </summary>
        public async Task Disconnect()
        {
            _shouldReconnect = false;
            _cancellation?.Cancel();

            if (_socket != null && _socket.State == WebSocketState.Open)
            {
                try
                {
                    await _socket.CloseAsync(
                        WebSocketCloseStatus.NormalClosure,
                        "Client disconnect",
                        CancellationToken.None
                    );
                }
                catch { }
            }

            _socket?.Dispose();
            _socket = null;

            Log("Disconnected");
            OnDisconnected?.Invoke();
        }

        /// <summary>
        /// Sends a message to the WebSocket server.
        /// </summary>
        public async Task Send(string type, object payload)
        {
            if (!IsConnected) return;

            try
            {
                var message = new WebSocketMessage
                {
                    type = type,
                    payload = JsonUtility.ToJson(payload)
                };

                string json = JsonUtility.ToJson(message);
                byte[] bytes = Encoding.UTF8.GetBytes(json);

                await _socket.SendAsync(
                    new ArraySegment<byte>(bytes),
                    WebSocketMessageType.Text,
                    true,
                    _cancellation.Token
                );

                Log($"Sent: {type}");
            }
            catch (Exception ex)
            {
                Log($"Send error: {ex.Message}");
                OnError?.Invoke(ex.Message);
            }
        }

        /// <summary>
        /// Sends raw JSON to the WebSocket server.
        /// </summary>
        public async Task SendRaw(string json)
        {
            if (!IsConnected) return;

            try
            {
                byte[] bytes = Encoding.UTF8.GetBytes(json);
                await _socket.SendAsync(
                    new ArraySegment<byte>(bytes),
                    WebSocketMessageType.Text,
                    true,
                    _cancellation.Token
                );
            }
            catch (Exception ex)
            {
                Log($"Send error: {ex.Message}");
                OnError?.Invoke(ex.Message);
            }
        }

        private async Task ReceiveLoop()
        {
            var buffer = new byte[4096];

            try
            {
                while (_socket?.State == WebSocketState.Open && !_cancellation.Token.IsCancellationRequested)
                {
                    var result = await _socket.ReceiveAsync(
                        new ArraySegment<byte>(buffer),
                        _cancellation.Token
                    );

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        Log("Server closed connection");
                        break;
                    }

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        string json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        HandleMessage(json);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Expected when disconnecting
            }
            catch (Exception ex)
            {
                Log($"Receive error: {ex.Message}");
                OnError?.Invoke(ex.Message);
            }

            // Handle disconnection
            if (_shouldReconnect && !_cancellation.Token.IsCancellationRequested)
            {
                Log($"Reconnecting in {_reconnectDelay}s...");
                await Task.Delay((int)(_reconnectDelay * 1000));
                if (_shouldReconnect)
                {
                    await Connect(_authToken);
                }
            }
            else
            {
                OnDisconnected?.Invoke();
            }
        }

        private void HandleMessage(string json)
        {
            try
            {
                var message = JsonUtility.FromJson<WebSocketMessage>(json);
                Log($"Received: {message.type}");

                // Dispatch on main thread
                UnityMainThreadDispatcher.Enqueue(() =>
                {
                    OnMessageReceived?.Invoke(message);
                });
            }
            catch (Exception ex)
            {
                Log($"Parse error: {ex.Message}");
            }
        }

        private void Log(string message)
        {
            if (_logMessages)
            {
                Debug.Log($"[CompanionWS] {message}");
            }
        }
    }

    /// <summary>
    /// WebSocket message envelope.
    /// </summary>
    [Serializable]
    public class WebSocketMessage
    {
        public string type;
        public string payload;

        public T GetPayload<T>()
        {
            if (string.IsNullOrEmpty(payload)) return default;
            return JsonUtility.FromJson<T>(payload);
        }
    }

    /// <summary>
    /// Helper class to dispatch actions to the Unity main thread.
    /// </summary>
    public class UnityMainThreadDispatcher : MonoBehaviour
    {
        private static UnityMainThreadDispatcher _instance;
        private static readonly Queue<Action> _queue = new Queue<Action>();
        private static readonly object _lock = new object();

        public static void Enqueue(Action action)
        {
            if (action == null) return;

            lock (_lock)
            {
                _queue.Enqueue(action);
            }

            EnsureInstance();
        }

        private static void EnsureInstance()
        {
            if (_instance == null)
            {
                var go = new GameObject("UnityMainThreadDispatcher");
                _instance = go.AddComponent<UnityMainThreadDispatcher>();
                DontDestroyOnLoad(go);
            }
        }

        private void Update()
        {
            lock (_lock)
            {
                while (_queue.Count > 0)
                {
                    var action = _queue.Dequeue();
                    try
                    {
                        action?.Invoke();
                    }
                    catch (Exception ex)
                    {
                        Debug.LogError($"[MainThreadDispatcher] Error: {ex}");
                    }
                }
            }
        }

        private void OnDestroy()
        {
            if (_instance == this)
            {
                _instance = null;
            }
        }
    }
}
