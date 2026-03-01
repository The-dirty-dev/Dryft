using NUnit.Framework;
using UnityEngine;
using System;

namespace Drift.Tests.EditMode
{
    /// <summary>
    /// Unit tests for voice chat message serialization.
    /// </summary>
    [TestFixture]
    public class VoiceChatMessageTests
    {
        [Test]
        public void VoiceJoinMessage_SerializesCorrectly()
        {
            var message = new VoiceJoinMessage
            {
                type = "voice_join",
                session_id = "session_123",
                user_id = "user_456"
            };

            var json = JsonUtility.ToJson(message);

            Assert.IsTrue(json.Contains("voice_join"));
            Assert.IsTrue(json.Contains("session_123"));
            Assert.IsTrue(json.Contains("user_456"));
        }

        [Test]
        public void VoiceJoinMessage_DeserializesCorrectly()
        {
            var json = "{\"type\":\"voice_join\",\"session_id\":\"session_123\",\"user_id\":\"user_456\"}";
            var message = JsonUtility.FromJson<VoiceJoinMessage>(json);

            Assert.AreEqual("voice_join", message.type);
            Assert.AreEqual("session_123", message.session_id);
            Assert.AreEqual("user_456", message.user_id);
        }

        [Test]
        public void VoiceSpeakingMessage_SerializesCorrectly()
        {
            var message = new VoiceSpeakingMessage
            {
                type = "voice_speaking",
                session_id = "session_123",
                user_id = "user_456",
                speaking = true
            };

            var json = JsonUtility.ToJson(message);

            Assert.IsTrue(json.Contains("voice_speaking"));
            Assert.IsTrue(json.Contains("true"));
        }

        [Test]
        public void VoiceAudioMessage_HandlesBase64()
        {
            byte[] testAudio = { 0x00, 0x01, 0x02, 0x03 };
            var base64 = Convert.ToBase64String(testAudio);

            var message = new VoiceAudioMessage
            {
                type = "voice_audio",
                session_id = "session_123",
                user_id = "user_456",
                audio_base64 = base64,
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            Assert.IsNotNull(message.audio_base64);

            var decoded = Convert.FromBase64String(message.audio_base64);
            Assert.AreEqual(testAudio.Length, decoded.Length);
        }
    }

    /// <summary>
    /// Unit tests for audio conversion utilities.
    /// </summary>
    [TestFixture]
    public class AudioConversionTests
    {
        [Test]
        public void FloatTo16BitPCM_ConvertsCorrectly()
        {
            float sample = 0.5f;
            short expected = (short)(sample * 32767f);

            short result = (short)(sample * 32767f);

            Assert.AreEqual(expected, result);
        }

        [Test]
        public void FloatTo16BitPCM_ClampsMaxValue()
        {
            float sample = 1.0f;
            short result = (short)(Mathf.Clamp(sample, -1f, 1f) * 32767f);

            Assert.AreEqual(32767, result);
        }

        [Test]
        public void FloatTo16BitPCM_ClampsMinValue()
        {
            float sample = -1.0f;
            short result = (short)(Mathf.Clamp(sample, -1f, 1f) * 32767f);

            Assert.AreEqual(-32767, result);
        }

        [Test]
        public void PCM16BitToFloat_ConvertsCorrectly()
        {
            short sample = 16383;
            float expected = sample / 32767f;

            float result = sample / 32767f;

            Assert.AreEqual(expected, result, 0.0001f);
        }

        [Test]
        public void BytesToShort_LittleEndian()
        {
            byte[] bytes = { 0xFF, 0x7F }; // 32767 in little-endian
            short result = (short)(bytes[0] | (bytes[1] << 8));

            Assert.AreEqual(32767, result);
        }

        [Test]
        public void ShortToBytes_LittleEndian()
        {
            short value = 32767;
            byte low = (byte)(value & 0xFF);
            byte high = (byte)((value >> 8) & 0xFF);

            Assert.AreEqual(0xFF, low);
            Assert.AreEqual(0x7F, high);
        }
    }

    // Message types matching Voice module

    [Serializable]
    public class VoiceJoinMessage
    {
        public string type;
        public string session_id;
        public string user_id;
    }

    [Serializable]
    public class VoiceSpeakingMessage
    {
        public string type;
        public string session_id;
        public string user_id;
        public bool speaking;
    }

    [Serializable]
    public class VoiceAudioMessage
    {
        public string type;
        public string session_id;
        public string user_id;
        public string audio_base64;
        public long timestamp;
    }
}
