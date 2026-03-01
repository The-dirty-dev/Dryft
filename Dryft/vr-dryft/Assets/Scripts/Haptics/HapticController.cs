using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;

namespace Drift.Haptics
{
    /// <summary>
    /// Main controller for haptic feedback.
    /// Manages device connection and provides a unified API for sending haptics.
    ///
    /// Usage:
    /// 1. Call Initialize() on start
    /// 2. Call ConnectDevice() to connect to a haptic device
    /// 3. Use Pulse(), PlayPattern(), or SetContinuous() to send feedback
    /// 4. The controller handles device abstraction - same API for fake/real devices
    ///
    /// Supported Devices:
    /// - Fake: Quest controller haptics (testing)
    /// - Intiface: 750+ devices via Intiface Central (Lovense, WeVibe, Kiiroo, etc.)
    /// </summary>
    public class HapticController : MonoBehaviour
    {
        public static HapticController Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private bool _useFakeDeviceInEditor = true;
        [SerializeField] private bool _autoConnectOnStart = true;
        [SerializeField] private float _globalIntensityMultiplier = 1.0f;

        [Header("Intiface Settings")]
        [SerializeField] private string _intifaceServerUrl = "ws://127.0.0.1:12345";
        [SerializeField] private bool _autoScanOnIntifaceConnect = true;

        [Header("Debug")]
        [SerializeField] private bool _logHapticEvents = true;

        private IHapticDevice _device;
        private IntifaceService _intifaceService;
        private bool _initialized;

        // Available Intiface devices
        private List<IntifaceDevice> _availableIntifaceDevices = new();

        // Events for UI feedback
        public event Action<IHapticDevice> OnDeviceConnected;
        public event Action OnDeviceDisconnected;
        public event Action<float> OnIntensityChanged; // For visual feedback

        // Intiface-specific events
        public event Action OnIntifaceConnected;
        public event Action OnIntifaceDisconnected;
        public event Action<IntifaceDevice> OnIntifaceDeviceFound;
        public event Action<int> OnIntifaceDeviceLost;
        public event Action<string> OnIntifaceError;

        public bool IsConnected => _device?.IsConnected ?? false;
        public string DeviceName => _device?.DeviceName ?? "None";
        public HapticDeviceType DeviceType => _device?.DeviceType ?? HapticDeviceType.None;

        // Intiface properties
        public bool IsIntifaceConnected => _intifaceService?.IsConnected ?? false;
        public bool IsIntifaceScanning => _intifaceService?.IsScanning ?? false;
        public IReadOnlyList<IntifaceDevice> AvailableIntifaceDevices => _availableIntifaceDevices;
        public string IntifaceServerUrl => _intifaceServerUrl;

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

        private async void Start()
        {
            if (_autoConnectOnStart)
            {
                await Initialize();
            }
        }

        /// <summary>
        /// Initializes the haptic system.
        /// </summary>
        public async Task Initialize()
        {
            if (_initialized) return;

            Log("Initializing haptic controller...");

            // Initialize Intiface service
            InitializeIntifaceService();

            // In editor or when testing, use fake device
            if (Application.isEditor && _useFakeDeviceInEditor)
            {
                _device = new FakeHapticDevice();
                await _device.ConnectAsync();
                _initialized = true;
                OnDeviceConnected?.Invoke(_device);
                Log($"Initialized with {_device.DeviceName}");
                return;
            }

            // On Quest, start with fake device (controller haptics)
            // User can later connect real devices via Intiface
            _device = new FakeHapticDevice();
            await _device.ConnectAsync();
            _initialized = true;
            OnDeviceConnected?.Invoke(_device);
            Log($"Initialized with {_device.DeviceName}");
        }

        /// <summary>
        /// Initializes the Intiface service for device communication.
        /// </summary>
        private void InitializeIntifaceService()
        {
            // Check if IntifaceService already exists
            _intifaceService = IntifaceService.Instance;

            if (_intifaceService == null)
            {
                // Create IntifaceService as a child GameObject
                var serviceGO = new GameObject("IntifaceService");
                serviceGO.transform.SetParent(transform);
                _intifaceService = serviceGO.AddComponent<IntifaceService>();
            }

            // Subscribe to Intiface events
            _intifaceService.OnConnected += HandleIntifaceConnected;
            _intifaceService.OnDisconnected += HandleIntifaceDisconnected;
            _intifaceService.OnDeviceAdded += HandleIntifaceDeviceAdded;
            _intifaceService.OnDeviceRemoved += HandleIntifaceDeviceRemoved;
            _intifaceService.OnError += HandleIntifaceError;

            Log("Intiface service initialized");
        }

        private void HandleIntifaceConnected()
        {
            Log("Connected to Intiface Central");
            OnIntifaceConnected?.Invoke();

            if (_autoScanOnIntifaceConnect)
            {
                _ = StartIntifaceScan();
            }
        }

        private void HandleIntifaceDisconnected()
        {
            Log("Disconnected from Intiface Central");
            _availableIntifaceDevices.Clear();
            OnIntifaceDisconnected?.Invoke();

            // If current device was Intiface, fall back to fake
            if (_device?.DeviceType == HapticDeviceType.Intiface)
            {
                _ = ConnectDevice(HapticDeviceType.Fake);
            }
        }

        private void HandleIntifaceDeviceAdded(IntifaceDevice device)
        {
            Log($"Intiface device found: {device.Name}");
            _availableIntifaceDevices.Add(device);
            OnIntifaceDeviceFound?.Invoke(device);
        }

        private void HandleIntifaceDeviceRemoved(int deviceIndex)
        {
            Log($"Intiface device removed: {deviceIndex}");
            _availableIntifaceDevices.RemoveAll(d => d.Index == deviceIndex);
            OnIntifaceDeviceLost?.Invoke(deviceIndex);

            // If current device was removed, fall back
            if (_device is IntifaceHapticDevice intifaceDevice && intifaceDevice.DeviceIndex == deviceIndex)
            {
                _ = ConnectDevice(HapticDeviceType.Fake);
            }
        }

        private void HandleIntifaceError(string error)
        {
            Log($"Intiface error: {error}");
            OnIntifaceError?.Invoke(error);
        }

        /// <summary>
        /// Connects to a specific device type.
        /// </summary>
        public async Task<bool> ConnectDevice(HapticDeviceType type)
        {
            // Disconnect existing
            await Disconnect();

            _device = type switch
            {
                HapticDeviceType.Fake => new FakeHapticDevice(),
                HapticDeviceType.Intiface => CreateIntifaceDevice(),
                HapticDeviceType.Lovense => CreateLovenseDevice(),
                _ => new FakeHapticDevice()
            };

            bool connected = await _device.ConnectAsync();

            if (connected)
            {
                Log($"Connected to {_device.DeviceName}");
                OnDeviceConnected?.Invoke(_device);
            }
            else
            {
                Log($"Failed to connect to {type}");
                _device = null;
            }

            return connected;
        }

        /// <summary>
        /// Connects to a specific Intiface device by index.
        /// </summary>
        public async Task<bool> ConnectIntifaceDevice(int deviceIndex)
        {
            var device = _availableIntifaceDevices.Find(d => d.Index == deviceIndex);
            if (device == null)
            {
                Log($"Intiface device not found: {deviceIndex}");
                return false;
            }

            return await ConnectIntifaceDevice(device);
        }

        /// <summary>
        /// Connects to a specific Intiface device.
        /// </summary>
        public async Task<bool> ConnectIntifaceDevice(IntifaceDevice device)
        {
            if (device == null || _intifaceService == null)
            {
                return false;
            }

            // Disconnect existing
            await Disconnect();

            _device = new IntifaceHapticDevice(_intifaceService, device);
            bool connected = await _device.ConnectAsync();

            if (connected)
            {
                Log($"Connected to Intiface device: {_device.DeviceName}");
                OnDeviceConnected?.Invoke(_device);
            }
            else
            {
                Log($"Failed to connect to Intiface device");
                _device = null;
            }

            return connected;
        }

        /// <summary>
        /// Disconnects from the current device.
        /// </summary>
        public async Task Disconnect()
        {
            if (_device != null)
            {
                await _device.DisconnectAsync();
                _device = null;
                OnDeviceDisconnected?.Invoke();
                Log("Disconnected");
            }
        }

        /// <summary>
        /// Sends a single haptic pulse.
        /// </summary>
        /// <param name="intensity">0.0 to 1.0</param>
        /// <param name="durationSeconds">Duration in seconds</param>
        public async Task Pulse(float intensity, float durationSeconds)
        {
            if (!EnsureConnected()) return;

            float adjustedIntensity = intensity * _globalIntensityMultiplier;
            OnIntensityChanged?.Invoke(adjustedIntensity);

            await _device.SendPulseAsync(adjustedIntensity, durationSeconds);

            OnIntensityChanged?.Invoke(0f);
        }

        /// <summary>
        /// Sends a pulse (fire-and-forget version for Unity events).
        /// </summary>
        public void PulseSync(float intensity, float durationSeconds)
        {
            _ = Pulse(intensity, durationSeconds);
        }

        /// <summary>
        /// Plays a haptic pattern by name.
        /// </summary>
        public async Task PlayPattern(string patternName)
        {
            var pattern = HapticPatternLibrary.GetByName(patternName);
            if (pattern == null)
            {
                Debug.LogWarning($"[HapticController] Unknown pattern: {patternName}");
                return;
            }

            await PlayPattern(pattern);
        }

        /// <summary>
        /// Plays a haptic pattern.
        /// </summary>
        public async Task PlayPattern(HapticPattern pattern)
        {
            if (!EnsureConnected()) return;

            Log($"Playing pattern: {pattern.Name}");
            await _device.SendPatternAsync(pattern);
        }

        /// <summary>
        /// Plays the signature Foreplay pattern.
        /// </summary>
        public async Task PlayForeplay()
        {
            await PlayPattern(HapticPatternLibrary.Foreplay);
        }

        /// <summary>
        /// Sets continuous vibration level.
        /// </summary>
        /// <param name="intensity">0.0 to 1.0 (0 to stop)</param>
        public async Task SetContinuous(float intensity)
        {
            if (!EnsureConnected()) return;

            float adjustedIntensity = intensity * _globalIntensityMultiplier;
            OnIntensityChanged?.Invoke(adjustedIntensity);

            await _device.SetContinuousAsync(adjustedIntensity);
        }

        /// <summary>
        /// Stops all haptic feedback.
        /// </summary>
        public async Task Stop()
        {
            if (_device != null)
            {
                await _device.StopAsync();
                OnIntensityChanged?.Invoke(0f);
            }
        }

        /// <summary>
        /// Stops haptics (fire-and-forget for Unity events).
        /// </summary>
        public void StopSync()
        {
            _ = Stop();
        }

        /// <summary>
        /// Sets the global intensity multiplier (0.0 to 2.0).
        /// Useful for user preference settings.
        /// </summary>
        public void SetGlobalIntensity(float multiplier)
        {
            _globalIntensityMultiplier = Mathf.Clamp(multiplier, 0f, 2f);
            Log($"Global intensity set to {_globalIntensityMultiplier:F2}");
        }

        private bool EnsureConnected()
        {
            if (_device == null || !_device.IsConnected)
            {
                Debug.LogWarning("[HapticController] No device connected");
                return false;
            }
            return true;
        }

        private IHapticDevice CreateIntifaceDevice()
        {
            if (_intifaceService == null)
            {
                Debug.LogWarning("[HapticController] IntifaceService not initialized");
                return new FakeHapticDevice();
            }

            // Use first available device, or null to auto-scan
            var device = _availableIntifaceDevices.Count > 0 ? _availableIntifaceDevices[0] : null;
            return new IntifaceHapticDevice(_intifaceService, device);
        }

        private IHapticDevice CreateLovenseDevice()
        {
            // Legacy Lovense support - redirect to Intiface which supports Lovense devices
            Debug.LogWarning("[HapticController] Lovense devices now supported via Intiface Central");
            return CreateIntifaceDevice();
        }

        // ==========================================================================
        // Intiface Control Methods
        // ==========================================================================

        /// <summary>
        /// Sets the Intiface Central server URL.
        /// </summary>
        public void SetIntifaceServerUrl(string url)
        {
            _intifaceServerUrl = url;
            _intifaceService?.SetServerUrl(url);
        }

        /// <summary>
        /// Connects to Intiface Central.
        /// </summary>
        public async Task<bool> ConnectToIntiface(string url = null)
        {
            if (_intifaceService == null)
            {
                InitializeIntifaceService();
            }

            if (!string.IsNullOrEmpty(url))
            {
                _intifaceServerUrl = url;
            }

            return await _intifaceService.Connect(_intifaceServerUrl);
        }

        /// <summary>
        /// Disconnects from Intiface Central.
        /// </summary>
        public async Task DisconnectFromIntiface()
        {
            if (_intifaceService != null)
            {
                await _intifaceService.Disconnect();
            }
        }

        /// <summary>
        /// Starts scanning for devices via Intiface.
        /// </summary>
        public async Task StartIntifaceScan()
        {
            if (_intifaceService?.IsConnected == true)
            {
                await _intifaceService.StartScanning();
            }
        }

        /// <summary>
        /// Stops scanning for devices.
        /// </summary>
        public async Task StopIntifaceScan()
        {
            if (_intifaceService?.IsConnected == true)
            {
                await _intifaceService.StopScanning();
            }
        }

        private void Log(string message)
        {
            if (_logHapticEvents)
            {
                Debug.Log($"[HapticController] {message}");
            }
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                // Unsubscribe from Intiface events
                if (_intifaceService != null)
                {
                    _intifaceService.OnConnected -= HandleIntifaceConnected;
                    _intifaceService.OnDisconnected -= HandleIntifaceDisconnected;
                    _intifaceService.OnDeviceAdded -= HandleIntifaceDeviceAdded;
                    _intifaceService.OnDeviceRemoved -= HandleIntifaceDeviceRemoved;
                    _intifaceService.OnError -= HandleIntifaceError;
                }

                _ = Disconnect();
                Instance = null;
            }
        }

        // Unity Editor testing
#if UNITY_EDITOR
        [ContextMenu("Test Foreplay Pattern")]
        private void TestForeplayPattern()
        {
            _ = PlayForeplay();
        }

        [ContextMenu("Test Quick Pulse")]
        private void TestQuickPulse()
        {
            _ = Pulse(0.5f, 0.3f);
        }

        [ContextMenu("Stop All")]
        private void TestStop()
        {
            _ = Stop();
        }
#endif
    }
}
