using System.Reflection;
using Drift.API;
using Drift.Environment;
using NUnit.Framework;
using UnityEngine;

namespace Drift.Tests.EditMode
{
    [TestFixture]
    public class BoothInviteServiceTests
    {
        private GameObject _serviceObject;
        private BoothInviteService _service;

        [SetUp]
        public void SetUp()
        {
            _serviceObject = new GameObject("BoothInviteServiceTest");
            _service = _serviceObject.AddComponent<BoothInviteService>();
        }

        [TearDown]
        public void TearDown()
        {
            if (_serviceObject != null)
            {
                Object.DestroyImmediate(_serviceObject);
            }

            foreach (var socket in Object.FindObjectsByType<CompanionWebSocket>(FindObjectsSortMode.None))
            {
                Object.DestroyImmediate(socket.gameObject);
            }
        }

        [Test]
        public void InviteMessage_SerializesExpectedFields()
        {
            var message = new BoothInviteMessage
            {
                booth_id = "booth-123",
                inviter_user_id = "host-1",
                target_user_id = "guest-9",
                sent_at_unix_ms = 1700000000,
            };

            var json = JsonUtility.ToJson(message);

            Assert.That(json, Does.Contain("booth-123"));
            Assert.That(json, Does.Contain("host-1"));
            Assert.That(json, Does.Contain("guest-9"));
        }

        [Test]
        public void HandleSocketMessage_RoutesInviteResponseEvent()
        {
            BoothInviteResponseMessage captured = null;
            _service.OnInviteResponseReceived += response => captured = response;

            var payload = new BoothInviteResponseMessage
            {
                booth_id = "booth-1",
                inviter_user_id = "host-1",
                target_user_id = "guest-1",
                accepted = true,
            };

            InvokeHandleSocketMessage(new WebSocketMessage
            {
                type = "booth_invite_response",
                payload = JsonUtility.ToJson(payload),
            });

            Assert.IsNotNull(captured);
            Assert.AreEqual("booth-1", captured.booth_id);
            Assert.IsTrue(captured.accepted);
        }

        [Test]
        public void HandleSocketMessage_RoutesPrivacyUpdateEvent()
        {
            BoothPrivacyUpdateMessage captured = null;
            _service.OnPrivacyUpdateReceived += update => captured = update;

            var payload = new BoothPrivacyUpdateMessage
            {
                booth_id = "booth-2",
                invite_only = true,
                room_locked = true,
                companion_voice_allowed = false,
                max_guest_count = 5,
            };

            InvokeHandleSocketMessage(new WebSocketMessage
            {
                type = "booth_privacy_update",
                payload = JsonUtility.ToJson(payload),
            });

            Assert.IsNotNull(captured);
            Assert.AreEqual("booth-2", captured.booth_id);
            Assert.IsTrue(captured.room_locked);
            Assert.IsFalse(captured.companion_voice_allowed);
        }

        [Test]
        public void HandleSocketMessage_RoutesHostControlEvent()
        {
            BoothHostControlMessage captured = null;
            _service.OnHostControlReceived += control => captured = control;

            var payload = new BoothHostControlMessage
            {
                booth_id = "booth-3",
                host_user_id = "host-2",
                action = "end_party",
            };

            InvokeHandleSocketMessage(new WebSocketMessage
            {
                type = "booth_host_control",
                payload = JsonUtility.ToJson(payload),
            });

            Assert.IsNotNull(captured);
            Assert.AreEqual("booth-3", captured.booth_id);
            Assert.AreEqual("end_party", captured.action);
        }

        private void InvokeHandleSocketMessage(WebSocketMessage message)
        {
            var method = typeof(BoothInviteService).GetMethod("HandleSocketMessage", BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.IsNotNull(method);
            method.Invoke(_service, new object[] { message });
        }
    }
}
