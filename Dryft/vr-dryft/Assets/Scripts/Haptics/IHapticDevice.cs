using System.Threading.Tasks;

namespace Drift.Haptics
{
    /// <summary>
    /// Interface for haptic feedback devices.
    /// Implementations include FakeHapticDevice (testing) and LovenseDevice (production).
    ///
    /// LEGAL NOTE: Haptic device integration requires user consent.
    /// All haptic commands between users are end-to-end encrypted.
    /// </summary>
    public interface IHapticDevice
    {
        /// <summary>
        /// Whether the device is currently connected and ready.
        /// </summary>
        bool IsConnected { get; }

        /// <summary>
        /// Human-readable device name for UI display.
        /// </summary>
        string DeviceName { get; }

        /// <summary>
        /// Device type identifier.
        /// </summary>
        HapticDeviceType DeviceType { get; }

        /// <summary>
        /// Attempts to connect to the device.
        /// </summary>
        /// <returns>True if connection successful.</returns>
        Task<bool> ConnectAsync();

        /// <summary>
        /// Disconnects from the device.
        /// </summary>
        Task DisconnectAsync();

        /// <summary>
        /// Sends a single pulse/vibration.
        /// </summary>
        /// <param name="intensity">Intensity from 0.0 (off) to 1.0 (max).</param>
        /// <param name="durationSeconds">Duration in seconds.</param>
        Task SendPulseAsync(float intensity, float durationSeconds);

        /// <summary>
        /// Plays a predefined haptic pattern.
        /// </summary>
        /// <param name="pattern">The pattern to play.</param>
        Task SendPatternAsync(HapticPattern pattern);

        /// <summary>
        /// Stops all haptic feedback immediately.
        /// </summary>
        Task StopAsync();

        /// <summary>
        /// Sets continuous vibration level. Call with 0 to stop.
        /// </summary>
        /// <param name="intensity">Intensity from 0.0 to 1.0.</param>
        Task SetContinuousAsync(float intensity);
    }

    /// <summary>
    /// Types of haptic devices supported.
    /// </summary>
    public enum HapticDeviceType
    {
        None,
        Fake,           // For testing without hardware
        Controller,     // Quest controller haptics
        Lovense,        // Lovense Bluetooth toys (legacy)
        Generic,        // Generic Bluetooth haptic device
        Intiface        // Intiface Central (supports 750+ devices via buttplug.io)
    }

    /// <summary>
    /// Device capabilities for Intiface devices.
    /// </summary>
    public struct IntifaceDeviceCapabilities
    {
        public bool CanVibrate;
        public bool CanRotate;
        public bool CanLinear;
        public bool CanBattery;
        public int VibrateCount;
        public int RotateCount;
        public int LinearCount;
    }
}
