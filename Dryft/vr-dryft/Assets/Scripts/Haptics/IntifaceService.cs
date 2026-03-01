using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using NativeWebSocket;

namespace Drift.Haptics
{
    /// <summary>
    /// Service for communicating with Intiface Central via WebSocket.
    /// Intiface Central handles Bluetooth/USB communication with 750+ supported devices.
    ///
    /// Architecture:
    /// Dryft VR App <--WebSocket--> Intiface Central <--Bluetooth/USB--> Physical Devices
    ///
    /// The user must have Intiface Central running on a connected PC/phone.
    /// For Quest standalone, this requires the Intiface Central mobile app.
    /// </summary>
    public class IntifaceService : MonoBehaviour
    {
        public static IntifaceService Instance { get; private set; }

        [Header("Connection Settings")]
        [SerializeField] private string _serverUrl = "ws://127.0.0.1:12345";
        [SerializeField] private float _reconnectDelay = 3f;
        [SerializeField] private int _connectionTimeout = 5000;

        [Header("Debug")]
        [SerializeField] private bool _logMessages = true;

        private WebSocket _socket;
        private int _messageId = 1;
        private Dictionary<int, TaskCompletionSource<string>> _pendingMessages = new();
        private Dictionary<int, IntifaceDevice> _devices = new();

        private bool _isConnected;
        private bool _isConnecting;
        private bool _isScanning;
        private bool _handshakeComplete;

        // Events
        public event Action OnConnected;
        public event Action OnDisconnected;
        public event Action<IntifaceDevice> OnDeviceAdded;
        public event Action<int> OnDeviceRemoved;
        public event Action<string> OnError;

        // Properties
        public bool IsConnected => _isConnected && _handshakeComplete;
        public bool IsConnecting => _isConnecting;
        public bool IsScanning => _isScanning;
        public string ServerUrl => _serverUrl;
        public IReadOnlyDictionary<int, IntifaceDevice> Devices => _devices;

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
            // NativeWebSocket requires dispatching messages on main thread
            _socket?.DispatchMessageQueue();
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
            _ = Disconnect();
        }

        /// <summary>
        /// Sets the Intiface Central server URL.
        /// </summary>
        public void SetServerUrl(string url)
        {
            if (!_isConnected)
            {
                _serverUrl = url;
            }
        }

        /// <summary>
        /// Connects to Intiface Central.
        /// </summary>
        public async Task<bool> Connect(string url = null)
        {
            if (_isConnected || _isConnecting) return _isConnected;

            if (!string.IsNullOrEmpty(url))
            {
                _serverUrl = url;
            }

            _isConnecting = true;
            Log($"Connecting to Intiface Central at {_serverUrl}...");

            try
            {
                _socket = new WebSocket(_serverUrl);

                var connectionTcs = new TaskCompletionSource<bool>();

                _socket.OnOpen += () =>
                {
                    Log("WebSocket connected, performing handshake...");
                    _ = PerformHandshake(connectionTcs);
                };

                _socket.OnClose += (code) =>
                {
                    Log($"WebSocket closed with code: {code}");
                    HandleDisconnect();
                    if (!connectionTcs.Task.IsCompleted)
                    {
                        connectionTcs.TrySetResult(false);
                    }
                };

                _socket.OnError += (error) =>
                {
                    Log($"WebSocket error: {error}");
                    OnError?.Invoke(error);
                    if (!connectionTcs.Task.IsCompleted)
                    {
                        connectionTcs.TrySetResult(false);
                    }
                };

                _socket.OnMessage += (data) =>
                {
                    string message = System.Text.Encoding.UTF8.GetString(data);
                    HandleMessage(message);
                };

                await _socket.Connect();

                // Wait for handshake with timeout
                var timeoutTask = Task.Delay(_connectionTimeout);
                var completedTask = await Task.WhenAny(connectionTcs.Task, timeoutTask);

                if (completedTask == timeoutTask)
                {
                    Log("Connection timeout");
                    await Disconnect();
                    return false;
                }

                return connectionTcs.Task.Result;
            }
            catch (Exception ex)
            {
                Log($"Connection failed: {ex.Message}");
                OnError?.Invoke($"Connection failed: {ex.Message}");
                return false;
            }
            finally
            {
                _isConnecting = false;
            }
        }

        private async Task PerformHandshake(TaskCompletionSource<bool> connectionTcs)
        {
            try
            {
                var response = await SendMessageAsync(new
                {
                    RequestServerInfo = new
                    {
                        Id = GetNextMessageId(),
                        ClientName = "Dryft VR",
                        MessageVersion = 3
                    }
                });

                if (response != null)
                {
                    _isConnected = true;
                    _handshakeComplete = true;
                    Log("Handshake complete, connected to Intiface Central");
                    OnConnected?.Invoke();
                    connectionTcs.TrySetResult(true);
                }
                else
                {
                    connectionTcs.TrySetResult(false);
                }
            }
            catch (Exception ex)
            {
                Log($"Handshake failed: {ex.Message}");
                connectionTcs.TrySetResult(false);
            }
        }

        /// <summary>
        /// Disconnects from Intiface Central.
        /// </summary>
        public async Task Disconnect()
        {
            if (_socket != null)
            {
                try
                {
                    await _socket.Close();
                }
                catch { }

                _socket = null;
            }

            HandleDisconnect();
        }

        private void HandleDisconnect()
        {
            bool wasConnected = _isConnected;
            _isConnected = false;
            _isConnecting = false;
            _isScanning = false;
            _handshakeComplete = false;
            _devices.Clear();

            foreach (var pending in _pendingMessages.Values)
            {
                pending.TrySetException(new Exception("Disconnected"));
            }
            _pendingMessages.Clear();

            if (wasConnected)
            {
                OnDisconnected?.Invoke();
            }
        }

        /// <summary>
        /// Starts scanning for devices.
        /// </summary>
        public async Task StartScanning()
        {
            if (!IsConnected || _isScanning) return;

            try
            {
                await SendMessageAsync(new
                {
                    StartScanning = new
                    {
                        Id = GetNextMessageId()
                    }
                });

                _isScanning = true;
                Log("Started scanning for devices");
            }
            catch (Exception ex)
            {
                Log($"Failed to start scanning: {ex.Message}");
                OnError?.Invoke($"Failed to start scanning: {ex.Message}");
            }
        }

        /// <summary>
        /// Stops scanning for devices.
        /// </summary>
        public async Task StopScanning()
        {
            if (!IsConnected || !_isScanning) return;

            try
            {
                await SendMessageAsync(new
                {
                    StopScanning = new
                    {
                        Id = GetNextMessageId()
                    }
                });

                _isScanning = false;
                Log("Stopped scanning");
            }
            catch { }
        }

        /// <summary>
        /// Gets a device by index.
        /// </summary>
        public IntifaceDevice GetDevice(int deviceIndex)
        {
            return _devices.TryGetValue(deviceIndex, out var device) ? device : null;
        }

        /// <summary>
        /// Sends a vibrate command to a device.
        /// </summary>
        public async Task Vibrate(int deviceIndex, float intensity, int? motorIndex = null)
        {
            var device = GetDevice(deviceIndex);
            if (device == null || !device.Capabilities.CanVibrate)
            {
                throw new Exception("Device does not support vibration");
            }

            var scalars = new List<object>();

            if (motorIndex.HasValue)
            {
                scalars.Add(new { Index = motorIndex.Value, Scalar = intensity, ActuatorType = "Vibrate" });
            }
            else
            {
                // Vibrate all motors
                for (int i = 0; i < device.Capabilities.VibrateCount; i++)
                {
                    scalars.Add(new { Index = i, Scalar = intensity, ActuatorType = "Vibrate" });
                }
            }

            await SendMessageAsync(new
            {
                ScalarCmd = new
                {
                    Id = GetNextMessageId(),
                    DeviceIndex = deviceIndex,
                    Scalars = scalars
                }
            });
        }

        /// <summary>
        /// Sends a rotate command to a device.
        /// </summary>
        public async Task Rotate(int deviceIndex, float speed, bool clockwise = true)
        {
            var device = GetDevice(deviceIndex);
            if (device == null || !device.Capabilities.CanRotate)
            {
                throw new Exception("Device does not support rotation");
            }

            var rotations = new List<object>();
            for (int i = 0; i < device.Capabilities.RotateCount; i++)
            {
                rotations.Add(new { Index = i, Speed = speed, Clockwise = clockwise });
            }

            await SendMessageAsync(new
            {
                RotateCmd = new
                {
                    Id = GetNextMessageId(),
                    DeviceIndex = deviceIndex,
                    Rotations = rotations
                }
            });
        }

        /// <summary>
        /// Sends a linear (stroker) command to a device.
        /// </summary>
        public async Task Linear(int deviceIndex, float position, int durationMs)
        {
            var device = GetDevice(deviceIndex);
            if (device == null || !device.Capabilities.CanLinear)
            {
                throw new Exception("Device does not support linear movement");
            }

            var vectors = new List<object>();
            for (int i = 0; i < device.Capabilities.LinearCount; i++)
            {
                vectors.Add(new { Index = i, Duration = durationMs, Position = position });
            }

            await SendMessageAsync(new
            {
                LinearCmd = new
                {
                    Id = GetNextMessageId(),
                    DeviceIndex = deviceIndex,
                    Vectors = vectors
                }
            });
        }

        /// <summary>
        /// Stops a specific device.
        /// </summary>
        public async Task StopDevice(int deviceIndex)
        {
            await SendMessageAsync(new
            {
                StopDeviceCmd = new
                {
                    Id = GetNextMessageId(),
                    DeviceIndex = deviceIndex
                }
            });
        }

        /// <summary>
        /// Stops all devices.
        /// </summary>
        public async Task StopAllDevices()
        {
            await SendMessageAsync(new
            {
                StopAllDevices = new
                {
                    Id = GetNextMessageId()
                }
            });
        }

        /// <summary>
        /// Gets the battery level of a device (0-1).
        /// </summary>
        public async Task<float> GetBatteryLevel(int deviceIndex)
        {
            var device = GetDevice(deviceIndex);
            if (device == null || !device.Capabilities.CanBattery)
            {
                throw new Exception("Device does not support battery level");
            }

            var response = await SendMessageAsync(new
            {
                BatteryLevelCmd = new
                {
                    Id = GetNextMessageId(),
                    DeviceIndex = deviceIndex
                }
            });

            // Parse battery level from response
            if (response != null && response.Contains("BatteryLevelReading"))
            {
                // Simple parsing - in production you'd use proper JSON parsing
                var batteryMatch = System.Text.RegularExpressions.Regex.Match(
                    response, @"""BatteryLevel""\s*:\s*([\d.]+)");
                if (batteryMatch.Success && float.TryParse(batteryMatch.Groups[1].Value, out float level))
                {
                    return level;
                }
            }

            return 0f;
        }

        // ==========================================================================
        // Private Methods
        // ==========================================================================

        private int GetNextMessageId()
        {
            return _messageId++;
        }

        private async Task<string> SendMessageAsync(object message)
        {
            if (_socket == null || _socket.State != WebSocketState.Open)
            {
                throw new Exception("Not connected");
            }

            // Get the message ID from the message object
            int messageId = 0;
            var msgType = message.GetType();
            foreach (var prop in msgType.GetProperties())
            {
                var innerObj = prop.GetValue(message);
                if (innerObj != null)
                {
                    var idProp = innerObj.GetType().GetProperty("Id");
                    if (idProp != null)
                    {
                        messageId = (int)idProp.GetValue(innerObj);
                        break;
                    }
                }
            }

            var tcs = new TaskCompletionSource<string>();
            _pendingMessages[messageId] = tcs;

            // Serialize and send
            string json = JsonUtility.ToJson(new MessageWrapper { messages = new[] { message } });
            // Manual JSON construction since Unity's JsonUtility has limitations
            json = SerializeMessage(message);

            if (_logMessages)
            {
                Log($"Sending: {json}");
            }

            await _socket.SendText(json);

            // Set timeout
            var timeoutTask = Task.Delay(10000);
            var completedTask = await Task.WhenAny(tcs.Task, timeoutTask);

            _pendingMessages.Remove(messageId);

            if (completedTask == timeoutTask)
            {
                throw new Exception("Message timeout");
            }

            return tcs.Task.Result;
        }

        private string SerializeMessage(object message)
        {
            // Buttplug protocol expects messages in an array
            // Since Unity's JsonUtility doesn't handle anonymous types well,
            // we'll construct the JSON manually for the specific message types

            var type = message.GetType();
            var props = type.GetProperties();

            if (props.Length == 0) return "[]";

            var prop = props[0];
            string msgType = prop.Name;
            var innerObj = prop.GetValue(message);

            if (innerObj == null) return "[]";

            // Build JSON manually
            var innerType = innerObj.GetType();
            var innerProps = innerType.GetProperties();

            var jsonParts = new List<string>();
            foreach (var innerProp in innerProps)
            {
                var value = innerProp.GetValue(innerObj);
                string jsonValue = FormatJsonValue(value);
                jsonParts.Add($"\"{innerProp.Name}\":{jsonValue}");
            }

            return $"[{{\"{msgType}\":{{{string.Join(",", jsonParts)}}}}}]";
        }

        private string FormatJsonValue(object value)
        {
            if (value == null) return "null";
            if (value is string s) return $"\"{s}\"";
            if (value is bool b) return b ? "true" : "false";
            if (value is int || value is long || value is float || value is double)
                return value.ToString().Replace(",", ".");
            if (value is System.Collections.IList list)
            {
                var items = new List<string>();
                foreach (var item in list)
                {
                    if (item.GetType().IsClass && item.GetType() != typeof(string))
                    {
                        var objParts = new List<string>();
                        foreach (var prop in item.GetType().GetProperties())
                        {
                            var propValue = prop.GetValue(item);
                            objParts.Add($"\"{prop.Name}\":{FormatJsonValue(propValue)}");
                        }
                        items.Add($"{{{string.Join(",", objParts)}}}");
                    }
                    else
                    {
                        items.Add(FormatJsonValue(item));
                    }
                }
                return $"[{string.Join(",", items)}]";
            }
            return value.ToString();
        }

        private void HandleMessage(string data)
        {
            if (_logMessages)
            {
                Log($"Received: {data}");
            }

            try
            {
                // Parse the message array
                // Buttplug messages come as: [{"MessageType": {...}}, ...]

                // Find message type and handle accordingly
                if (data.Contains("\"ServerInfo\""))
                {
                    HandleServerInfo(data);
                }
                else if (data.Contains("\"Ok\""))
                {
                    HandleOk(data);
                }
                else if (data.Contains("\"Error\""))
                {
                    HandleError(data);
                }
                else if (data.Contains("\"DeviceAdded\""))
                {
                    HandleDeviceAdded(data);
                }
                else if (data.Contains("\"DeviceRemoved\""))
                {
                    HandleDeviceRemoved(data);
                }
                else if (data.Contains("\"BatteryLevelReading\""))
                {
                    HandleBatteryReading(data);
                }
                else if (data.Contains("\"ScanningFinished\""))
                {
                    _isScanning = false;
                    Log("Scanning finished");
                }
            }
            catch (Exception ex)
            {
                Log($"Error parsing message: {ex.Message}");
            }
        }

        private void HandleServerInfo(string data)
        {
            // Extract message ID and complete pending task
            var idMatch = System.Text.RegularExpressions.Regex.Match(data, @"""Id""\s*:\s*(\d+)");
            if (idMatch.Success && int.TryParse(idMatch.Groups[1].Value, out int id))
            {
                if (_pendingMessages.TryGetValue(id, out var tcs))
                {
                    tcs.TrySetResult(data);
                }
            }
        }

        private void HandleOk(string data)
        {
            var idMatch = System.Text.RegularExpressions.Regex.Match(data, @"""Id""\s*:\s*(\d+)");
            if (idMatch.Success && int.TryParse(idMatch.Groups[1].Value, out int id))
            {
                if (_pendingMessages.TryGetValue(id, out var tcs))
                {
                    tcs.TrySetResult(data);
                }
            }
        }

        private void HandleError(string data)
        {
            var idMatch = System.Text.RegularExpressions.Regex.Match(data, @"""Id""\s*:\s*(\d+)");
            var errorMatch = System.Text.RegularExpressions.Regex.Match(data, @"""ErrorMessage""\s*:\s*""([^""]*)""");

            string errorMessage = errorMatch.Success ? errorMatch.Groups[1].Value : "Unknown error";

            if (idMatch.Success && int.TryParse(idMatch.Groups[1].Value, out int id))
            {
                if (_pendingMessages.TryGetValue(id, out var tcs))
                {
                    tcs.TrySetException(new Exception(errorMessage));
                }
            }

            OnError?.Invoke(errorMessage);
        }

        private void HandleDeviceAdded(string data)
        {
            try
            {
                // Parse device info
                var indexMatch = System.Text.RegularExpressions.Regex.Match(data, @"""DeviceIndex""\s*:\s*(\d+)");
                var nameMatch = System.Text.RegularExpressions.Regex.Match(data, @"""DeviceName""\s*:\s*""([^""]*)""");

                if (!indexMatch.Success || !nameMatch.Success) return;

                int index = int.Parse(indexMatch.Groups[1].Value);
                string name = nameMatch.Groups[1].Value;

                var capabilities = new IntifaceDeviceCapabilities();

                // Check for ScalarCmd (vibration)
                if (data.Contains("\"ScalarCmd\""))
                {
                    capabilities.CanVibrate = data.Contains("\"Vibrate\"");
                    var vibrateMatches = System.Text.RegularExpressions.Regex.Matches(
                        data, @"""ActuatorType""\s*:\s*""Vibrate""");
                    capabilities.VibrateCount = Math.Max(1, vibrateMatches.Count);
                }

                // Check for RotateCmd
                if (data.Contains("\"RotateCmd\""))
                {
                    capabilities.CanRotate = true;
                    capabilities.RotateCount = 1;
                }

                // Check for LinearCmd
                if (data.Contains("\"LinearCmd\""))
                {
                    capabilities.CanLinear = true;
                    capabilities.LinearCount = 1;
                }

                // Check for BatteryLevelCmd
                if (data.Contains("\"BatteryLevelCmd\""))
                {
                    capabilities.CanBattery = true;
                }

                var device = new IntifaceDevice
                {
                    Index = index,
                    Name = name,
                    Capabilities = capabilities
                };

                _devices[index] = device;
                Log($"Device added: {name} (index={index}, vibrate={capabilities.CanVibrate})");
                OnDeviceAdded?.Invoke(device);
            }
            catch (Exception ex)
            {
                Log($"Error parsing device: {ex.Message}");
            }
        }

        private void HandleDeviceRemoved(string data)
        {
            var indexMatch = System.Text.RegularExpressions.Regex.Match(data, @"""DeviceIndex""\s*:\s*(\d+)");
            if (indexMatch.Success && int.TryParse(indexMatch.Groups[1].Value, out int index))
            {
                _devices.Remove(index);
                Log($"Device removed: index={index}");
                OnDeviceRemoved?.Invoke(index);
            }
        }

        private void HandleBatteryReading(string data)
        {
            var idMatch = System.Text.RegularExpressions.Regex.Match(data, @"""Id""\s*:\s*(\d+)");
            if (idMatch.Success && int.TryParse(idMatch.Groups[1].Value, out int id))
            {
                if (_pendingMessages.TryGetValue(id, out var tcs))
                {
                    tcs.TrySetResult(data);
                }
            }
        }

        private void Log(string message)
        {
            if (_logMessages)
            {
                Debug.Log($"[IntifaceService] {message}");
            }
        }

        // Dummy class for JsonUtility
        [Serializable]
        private class MessageWrapper
        {
            public object[] messages;
        }
    }

    /// <summary>
    /// Represents a device connected via Intiface Central.
    /// </summary>
    public class IntifaceDevice
    {
        public int Index { get; set; }
        public string Name { get; set; }
        public string Address { get; set; }
        public IntifaceDeviceCapabilities Capabilities { get; set; }
        public float? BatteryLevel { get; set; }
    }
}
