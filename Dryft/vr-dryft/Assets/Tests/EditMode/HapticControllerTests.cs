using System.Reflection;
using System.Threading.Tasks;
using Drift.Haptics;
using NUnit.Framework;
using UnityEngine;

namespace Drift.Tests.EditMode
{
    [TestFixture]
    public class HapticControllerTests
    {
        private GameObject _gameObject;
        private HapticController _controller;

        [SetUp]
        public void SetUp()
        {
            _gameObject = new GameObject("HapticControllerTest");
            _controller = _gameObject.AddComponent<HapticController>();
        }

        [TearDown]
        public void TearDown()
        {
            if (_gameObject != null)
            {
                Object.DestroyImmediate(_gameObject);
            }

            foreach (var intiface in Object.FindObjectsByType<IntifaceService>(FindObjectsSortMode.None))
            {
                Object.DestroyImmediate(intiface.gameObject);
            }
        }

        [Test]
        public async Task PlayPattern_DispatchesToConnectedDevice()
        {
            var device = new TestHapticDevice();
            SetPrivateField(_controller, "_device", device);

            await _controller.PlayPattern(HapticPatternLibrary.Touch);

            Assert.AreEqual(1, device.SendPatternCount);
        }

        [Test]
        public async Task Disconnect_ClearsDeviceAndCallsDisconnectAsync()
        {
            var device = new TestHapticDevice();
            SetPrivateField(_controller, "_device", device);

            await _controller.Disconnect();

            Assert.AreEqual(1, device.DisconnectCount);
            Assert.IsNull(GetPrivateField<IHapticDevice>(_controller, "_device"));
        }

        [Test]
        public void SetGlobalIntensity_ClampsToExpectedRange()
        {
            _controller.SetGlobalIntensity(3f);
            Assert.AreEqual(2f, GetPrivateField<float>(_controller, "_globalIntensityMultiplier"), 0.0001f);

            _controller.SetGlobalIntensity(-1f);
            Assert.AreEqual(0f, GetPrivateField<float>(_controller, "_globalIntensityMultiplier"), 0.0001f);
        }

        [Test]
        public void AvailableIntifaceDevices_DefaultsToEmptyCollection()
        {
            Assert.IsNotNull(_controller.AvailableIntifaceDevices);
            Assert.AreEqual(0, _controller.AvailableIntifaceDevices.Count);
        }

        [Test]
        public async Task SetContinuous_UsesGlobalMultiplier()
        {
            var device = new TestHapticDevice();
            float observedIntensity = -1f;
            _controller.OnIntensityChanged += value => observedIntensity = value;

            SetPrivateField(_controller, "_device", device);
            _controller.SetGlobalIntensity(0.5f);

            await _controller.SetContinuous(0.8f);

            Assert.AreEqual(0.4f, device.LastContinuousIntensity, 0.0001f);
            Assert.AreEqual(0.4f, observedIntensity, 0.0001f);
        }

        private static T GetPrivateField<T>(object target, string fieldName)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.IsNotNull(field, $"Expected private field '{fieldName}' to exist");
            return (T)field.GetValue(target);
        }

        private static void SetPrivateField(object target, string fieldName, object value)
        {
            var field = target.GetType().GetField(fieldName, BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.IsNotNull(field, $"Expected private field '{fieldName}' to exist");
            field.SetValue(target, value);
        }

        private sealed class TestHapticDevice : IHapticDevice
        {
            public bool IsConnected => true;
            public string DeviceName => "Test Device";
            public HapticDeviceType DeviceType => HapticDeviceType.Fake;

            public int DisconnectCount { get; private set; }
            public int SendPatternCount { get; private set; }
            public float LastContinuousIntensity { get; private set; }

            public Task<bool> ConnectAsync() => Task.FromResult(true);

            public Task DisconnectAsync()
            {
                DisconnectCount++;
                return Task.CompletedTask;
            }

            public Task SendPulseAsync(float intensity, float durationSeconds) => Task.CompletedTask;

            public Task SendPatternAsync(HapticPattern pattern)
            {
                SendPatternCount++;
                return Task.CompletedTask;
            }

            public Task StopAsync() => Task.CompletedTask;

            public Task SetContinuousAsync(float intensity)
            {
                LastContinuousIntensity = intensity;
                return Task.CompletedTask;
            }
        }
    }
}
