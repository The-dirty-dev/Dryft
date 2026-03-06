using System.Reflection;
using Drift.Environment;
using NUnit.Framework;
using UnityEngine;

namespace Drift.Tests.EditMode
{
    [TestFixture]
    public class BoothManagerTests
    {
        private GameObject _gameObject;
        private BoothManager _manager;

        [SetUp]
        public void SetUp()
        {
            _gameObject = new GameObject("BoothManagerTest");
            _manager = _gameObject.AddComponent<BoothManager>();
        }

        [TearDown]
        public void TearDown()
        {
            if (_gameObject != null)
            {
                Object.DestroyImmediate(_gameObject);
            }

            foreach (var serviceObject in Object.FindObjectsByType<BoothInviteService>(FindObjectsSortMode.None))
            {
                Object.DestroyImmediate(serviceObject.gameObject);
            }
        }

        [Test]
        public void InitialState_StartsUnoccupiedAndUnlocked()
        {
            Assert.IsFalse(_manager.IsOccupied);
            Assert.IsFalse(_manager.IsRoomLocked);
        }

        [Test]
        public void RemotePrivacyUpdate_AppliesIncomingState()
        {
            _manager.InitializeBooth("booth-a", false);

            var message = new BoothPrivacyUpdateMessage
            {
                booth_id = "booth-a",
                invite_only = true,
                room_locked = true,
                companion_voice_allowed = false,
                max_guest_count = 6,
            };

            InvokePrivate(_manager, "HandleRemotePrivacyUpdate", message);

            Assert.IsTrue(_manager.IsInviteOnly);
            Assert.IsTrue(_manager.IsRoomLocked);
            Assert.IsFalse(_manager.IsCompanionVoiceAllowed);
            Assert.AreEqual(6, _manager.MaxGuestCount);
        }

        [Test]
        public void RemotePrivacyUpdate_ClampsMaxGuestCount()
        {
            _manager.InitializeBooth("booth-b", false);

            InvokePrivate(_manager, "HandleRemotePrivacyUpdate", new BoothPrivacyUpdateMessage
            {
                booth_id = "booth-b",
                max_guest_count = 1,
            });

            Assert.AreEqual(2, _manager.MaxGuestCount);

            InvokePrivate(_manager, "HandleRemotePrivacyUpdate", new BoothPrivacyUpdateMessage
            {
                booth_id = "booth-b",
                max_guest_count = 99,
            });

            Assert.AreEqual(12, _manager.MaxGuestCount);
        }

        [Test]
        public void RemoteHostControl_EndParty_ResetsBoothOccupancy()
        {
            _manager.InitializeBooth("booth-c", false);
            Assert.IsTrue(_manager.IsOccupied);

            InvokePrivate(_manager, "HandleRemoteHostControl", new BoothHostControlMessage
            {
                booth_id = "booth-c",
                action = "end_party",
            });

            Assert.IsFalse(_manager.IsOccupied);
        }

        [Test]
        public void SetInviteOnly_IgnoresNonHostChanges()
        {
            _manager.InitializeBooth("booth-d", false);
            var initial = _manager.IsInviteOnly;

            _manager.SetInviteOnly(!initial);

            Assert.AreEqual(initial, _manager.IsInviteOnly);
        }

        private static void InvokePrivate(object target, string methodName, params object[] args)
        {
            var method = target.GetType().GetMethod(methodName, BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.IsNotNull(method, $"Expected private method '{methodName}' to exist");
            method.Invoke(target, args);
        }
    }
}
