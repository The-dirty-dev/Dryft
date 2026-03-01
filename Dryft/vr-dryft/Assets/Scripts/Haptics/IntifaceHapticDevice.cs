using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace Drift.Haptics
{
    /// <summary>
    /// IHapticDevice implementation that connects to devices via Intiface Central.
    /// Supports 750+ devices from Lovense, WeVibe, Kiiroo, and many other manufacturers.
    ///
    /// Requirements:
    /// - User must have Intiface Central running (desktop or mobile app)
    /// - Device must be paired with Intiface Central
    /// - WebSocket connection to Intiface Central server
    ///
    /// For Quest standalone users:
    /// - Install Intiface Central on their phone
    /// - Connect Quest and phone to same WiFi network
    /// - Use phone's local IP address instead of localhost
    /// </summary>
    public class IntifaceHapticDevice : IHapticDevice
    {
        private IntifaceService _service;
        private IntifaceDevice _device;
        private CancellationTokenSource _patternCts;
        private bool _isPlayingPattern;

        public bool IsConnected => _service?.IsConnected == true && _device != null;
        public string DeviceName => _device?.Name ?? "Intiface Device";
        public HapticDeviceType DeviceType => HapticDeviceType.Intiface;

        /// <summary>
        /// The underlying Intiface device info.
        /// </summary>
        public IntifaceDevice Device => _device;

        /// <summary>
        /// Device index in Intiface Central.
        /// </summary>
        public int DeviceIndex => _device?.Index ?? -1;

        /// <summary>
        /// Creates an IntifaceHapticDevice.
        /// </summary>
        /// <param name="service">The IntifaceService instance.</param>
        /// <param name="device">The specific device to control (or null to use first available).</param>
        public IntifaceHapticDevice(IntifaceService service, IntifaceDevice device = null)
        {
            _service = service;
            _device = device;
        }

        public async Task<bool> ConnectAsync()
        {
            if (_service == null)
            {
                Debug.LogError("[IntifaceHaptic] No IntifaceService provided");
                return false;
            }

            // If not connected to Intiface Central, try to connect
            if (!_service.IsConnected)
            {
                bool connected = await _service.Connect();
                if (!connected)
                {
                    Debug.LogError("[IntifaceHaptic] Failed to connect to Intiface Central");
                    return false;
                }
            }

            // If no device specified, use the first available
            if (_device == null)
            {
                foreach (var kvp in _service.Devices)
                {
                    if (kvp.Value.Capabilities.CanVibrate)
                    {
                        _device = kvp.Value;
                        break;
                    }
                }

                // If still no device, start scanning and wait
                if (_device == null)
                {
                    Debug.Log("[IntifaceHaptic] No device found, starting scan...");

                    var deviceFoundTcs = new TaskCompletionSource<bool>();

                    void OnDeviceAdded(IntifaceDevice device)
                    {
                        if (device.Capabilities.CanVibrate && _device == null)
                        {
                            _device = device;
                            deviceFoundTcs.TrySetResult(true);
                        }
                    }

                    _service.OnDeviceAdded += OnDeviceAdded;

                    await _service.StartScanning();

                    // Wait up to 10 seconds for a device
                    var timeoutTask = Task.Delay(10000);
                    var completedTask = await Task.WhenAny(deviceFoundTcs.Task, timeoutTask);

                    _service.OnDeviceAdded -= OnDeviceAdded;
                    await _service.StopScanning();

                    if (completedTask == timeoutTask || _device == null)
                    {
                        Debug.LogWarning("[IntifaceHaptic] No compatible device found");
                        return false;
                    }
                }
            }

            Debug.Log($"[IntifaceHaptic] Connected to: {_device.Name}");
            return true;
        }

        public async Task DisconnectAsync()
        {
            await StopAsync();
            _device = null;
            Debug.Log("[IntifaceHaptic] Disconnected");
        }

        public async Task SendPulseAsync(float intensity, float durationSeconds)
        {
            if (!IsConnected)
            {
                Debug.LogWarning("[IntifaceHaptic] Not connected");
                return;
            }

            intensity = Mathf.Clamp01(intensity);
            durationSeconds = Mathf.Max(0f, durationSeconds);

            Debug.Log($"[IntifaceHaptic] Pulse: intensity={intensity:F2}, duration={durationSeconds:F2}s");

            try
            {
                await _service.Vibrate(_device.Index, intensity);
                await Task.Delay((int)(durationSeconds * 1000));
                await _service.StopDevice(_device.Index);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[IntifaceHaptic] Pulse failed: {ex.Message}");
            }
        }

        public async Task SendPatternAsync(HapticPattern pattern)
        {
            if (!IsConnected)
            {
                Debug.LogWarning("[IntifaceHaptic] Not connected");
                return;
            }

            if (pattern == null || pattern.Steps == null || pattern.Steps.Length == 0)
            {
                Debug.LogWarning("[IntifaceHaptic] Invalid pattern");
                return;
            }

            // Cancel any existing pattern
            await StopAsync();

            Debug.Log($"[IntifaceHaptic] Playing pattern: {pattern.Name} (loop={pattern.Loop})");

            _patternCts = new CancellationTokenSource();
            _isPlayingPattern = true;

            try
            {
                do
                {
                    foreach (var step in pattern.Steps)
                    {
                        if (_patternCts.Token.IsCancellationRequested)
                            break;

                        await _service.Vibrate(_device.Index, step.Intensity);

                        await Task.Delay(
                            (int)(step.DurationSeconds * 1000),
                            _patternCts.Token
                        );
                    }

                    // Loop delay
                    if (pattern.Loop && !_patternCts.Token.IsCancellationRequested)
                    {
                        await _service.StopDevice(_device.Index);
                        await Task.Delay(
                            (int)(pattern.LoopDelaySeconds * 1000),
                            _patternCts.Token
                        );
                    }
                }
                while (pattern.Loop && !_patternCts.Token.IsCancellationRequested);
            }
            catch (TaskCanceledException)
            {
                // Expected when stopping
            }
            catch (Exception ex)
            {
                Debug.LogError($"[IntifaceHaptic] Pattern failed: {ex.Message}");
            }
            finally
            {
                try
                {
                    await _service.StopDevice(_device.Index);
                }
                catch { }

                _isPlayingPattern = false;
            }
        }

        public async Task StopAsync()
        {
            if (_patternCts != null && !_patternCts.IsCancellationRequested)
            {
                _patternCts.Cancel();
                _patternCts.Dispose();
                _patternCts = null;
            }

            _isPlayingPattern = false;

            if (_service?.IsConnected == true && _device != null)
            {
                try
                {
                    await _service.StopDevice(_device.Index);
                }
                catch { }
            }

            Debug.Log("[IntifaceHaptic] Stopped");
        }

        public async Task SetContinuousAsync(float intensity)
        {
            if (!IsConnected)
            {
                Debug.LogWarning("[IntifaceHaptic] Not connected");
                return;
            }

            intensity = Mathf.Clamp01(intensity);

            if (intensity > 0f)
            {
                Debug.Log($"[IntifaceHaptic] Continuous: intensity={intensity:F2}");
            }
            else
            {
                Debug.Log("[IntifaceHaptic] Continuous: stopped");
            }

            try
            {
                if (intensity > 0f)
                {
                    await _service.Vibrate(_device.Index, intensity);
                }
                else
                {
                    await _service.StopDevice(_device.Index);
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[IntifaceHaptic] Continuous failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets the battery level of the device (0-100).
        /// </summary>
        public async Task<int> GetBatteryLevelAsync()
        {
            if (!IsConnected || !_device.Capabilities.CanBattery)
            {
                return -1;
            }

            try
            {
                float level = await _service.GetBatteryLevel(_device.Index);
                return Mathf.RoundToInt(level * 100f);
            }
            catch
            {
                return -1;
            }
        }

        /// <summary>
        /// Sends a rotate command if the device supports it.
        /// </summary>
        public async Task RotateAsync(float speed, bool clockwise = true)
        {
            if (!IsConnected || !_device.Capabilities.CanRotate)
            {
                Debug.LogWarning("[IntifaceHaptic] Device does not support rotation");
                return;
            }

            try
            {
                await _service.Rotate(_device.Index, speed, clockwise);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[IntifaceHaptic] Rotate failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Sends a linear (stroker) command if the device supports it.
        /// </summary>
        public async Task LinearAsync(float position, int durationMs)
        {
            if (!IsConnected || !_device.Capabilities.CanLinear)
            {
                Debug.LogWarning("[IntifaceHaptic] Device does not support linear movement");
                return;
            }

            try
            {
                await _service.Linear(_device.Index, position, durationMs);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[IntifaceHaptic] Linear failed: {ex.Message}");
            }
        }
    }
}
