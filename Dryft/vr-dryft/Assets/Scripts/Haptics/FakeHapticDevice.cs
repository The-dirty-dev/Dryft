using System.Threading.Tasks;
using System.Threading;
using UnityEngine;

namespace Drift.Haptics
{
    /// <summary>
    /// Fake haptic device for testing without physical hardware.
    /// Uses Quest controller vibration and visual feedback as substitutes.
    ///
    /// This allows developers and testers to feel the haptic patterns
    /// through controller rumble while developing without Lovense hardware.
    /// </summary>
    public class FakeHapticDevice : IHapticDevice
    {
        public bool IsConnected => true;
        public string DeviceName => "Fake Device (Controller)";
        public HapticDeviceType DeviceType => HapticDeviceType.Fake;

        private CancellationTokenSource _patternCts;
        private bool _isPlayingPattern;

        // Which controller to use for feedback
        private OVRInput.Controller _controller = OVRInput.Controller.RTouch;

        public Task<bool> ConnectAsync()
        {
            Debug.Log("[FakeHaptic] Connected (using controller vibration)");
            return Task.FromResult(true);
        }

        public Task DisconnectAsync()
        {
            StopAsync().ConfigureAwait(false);
            Debug.Log("[FakeHaptic] Disconnected");
            return Task.CompletedTask;
        }

        public async Task SendPulseAsync(float intensity, float durationSeconds)
        {
            intensity = Mathf.Clamp01(intensity);
            durationSeconds = Mathf.Max(0f, durationSeconds);

            Debug.Log($"[FakeHaptic] Pulse: intensity={intensity:F2}, duration={durationSeconds:F2}s");

            // Use OVR controller haptics
            SetControllerVibration(intensity);

            await Task.Delay((int)(durationSeconds * 1000));

            SetControllerVibration(0f);
        }

        public async Task SendPatternAsync(HapticPattern pattern)
        {
            if (pattern == null || pattern.Steps == null || pattern.Steps.Length == 0)
            {
                Debug.LogWarning("[FakeHaptic] Invalid pattern");
                return;
            }

            // Cancel any existing pattern
            await StopAsync();

            Debug.Log($"[FakeHaptic] Playing pattern: {pattern.Name} (loop={pattern.Loop})");

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

                        SetControllerVibration(step.Intensity);

                        await Task.Delay(
                            (int)(step.DurationSeconds * 1000),
                            _patternCts.Token
                        );
                    }

                    // Loop delay
                    if (pattern.Loop && !_patternCts.Token.IsCancellationRequested)
                    {
                        SetControllerVibration(0f);
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
            finally
            {
                SetControllerVibration(0f);
                _isPlayingPattern = false;
            }
        }

        public Task StopAsync()
        {
            if (_patternCts != null && !_patternCts.IsCancellationRequested)
            {
                _patternCts.Cancel();
                _patternCts.Dispose();
                _patternCts = null;
            }

            SetControllerVibration(0f);
            _isPlayingPattern = false;

            Debug.Log("[FakeHaptic] Stopped");
            return Task.CompletedTask;
        }

        public Task SetContinuousAsync(float intensity)
        {
            intensity = Mathf.Clamp01(intensity);

            if (intensity > 0f)
            {
                Debug.Log($"[FakeHaptic] Continuous: intensity={intensity:F2}");
            }
            else
            {
                Debug.Log("[FakeHaptic] Continuous: stopped");
            }

            SetControllerVibration(intensity);
            return Task.CompletedTask;
        }

        /// <summary>
        /// Sets which controller to use for vibration feedback.
        /// </summary>
        public void SetController(OVRInput.Controller controller)
        {
            _controller = controller;
        }

        /// <summary>
        /// Sets which controller to use for vibration feedback.
        /// </summary>
        public void SetBothControllers()
        {
            _controller = OVRInput.Controller.Touch; // Both controllers
        }

        private void SetControllerVibration(float intensity)
        {
            // OVR haptics expect frequency and amplitude
            // We use intensity for both to create a proportional feel
            float frequency = intensity;
            float amplitude = intensity;

            OVRInput.SetControllerVibration(frequency, amplitude, _controller);
        }
    }
}
