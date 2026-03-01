using UnityEngine;
using System;
using System.Threading.Tasks;
using System.Collections.Generic;
using Drift.Core;
using Drift.API;

namespace Drift.Voice
{
    /// <summary>
    /// WebSocket client for voice chat audio streaming.
    /// Handles connection, audio transmission, and participant management.
    /// </summary>
    public class VoiceWebSocket
    {
        private CompanionWebSocket _socket;
        private string _sessionId;
        private bool _isConnected;

        // Events
        public event Action<string, byte[]> OnAudioReceived;
        public event Action<string, bool> OnParticipantSpeaking;
        public event Action<string> OnError;

        public bool IsConnected => _isConnected;

        /// <summary>
        /// Connects to the voice server for the given session.
        /// </summary>
        public async Task<bool> Connect(string sessionId)
        {
            _sessionId = sessionId;

            try
            {
                // Use the existing companion WebSocket or create a dedicated voice connection
                string voiceUrl = GetVoiceServerUrl(sessionId);

                _socket = new CompanionWebSocket();
                _socket.OnMessageReceived += HandleMessage;
                _socket.OnConnectionLost += HandleDisconnect;
                _socket.OnError += HandleSocketError;

                bool connected = await _socket.Connect(voiceUrl, GameManager.Instance?.GetAccessToken());

                if (connected)
                {
                    _isConnected = true;

                    // Send join message
                    await _socket.Send(new VoiceJoinMessage
                    {
                        type = "voice_join",
                        session_id = sessionId,
                        user_id = GameManager.Instance?.UserId
                    });

                    Debug.Log("[VoiceWebSocket] Connected to voice server");
                    return true;
                }

                return false;
            }
            catch (Exception ex)
            {
                OnError?.Invoke(ex.Message);
                Debug.LogError($"[VoiceWebSocket] Connection failed: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Disconnects from the voice server.
        /// </summary>
        public void Disconnect()
        {
            if (!_isConnected) return;

            _isConnected = false;

            if (_socket != null)
            {
                _socket.OnMessageReceived -= HandleMessage;
                _socket.OnConnectionLost -= HandleDisconnect;
                _socket.OnError -= HandleSocketError;
                _socket.Disconnect();
                _socket = null;
            }

            Debug.Log("[VoiceWebSocket] Disconnected");
        }

        /// <summary>
        /// Sends audio data to the server.
        /// </summary>
        public void SendAudio(byte[] audioData)
        {
            if (!_isConnected || _socket == null) return;

            // Send as binary message
            _ = _socket.SendBinary(CreateAudioPacket(audioData));
        }

        /// <summary>
        /// Sends speaking state update.
        /// </summary>
        public async void SendSpeakingState(bool speaking)
        {
            if (!_isConnected || _socket == null) return;

            await _socket.Send(new VoiceSpeakingMessage
            {
                type = "voice_speaking",
                session_id = _sessionId,
                user_id = GameManager.Instance?.UserId,
                speaking = speaking
            });
        }

        private byte[] CreateAudioPacket(byte[] audioData)
        {
            // Packet format: [type(1)] [user_id_length(1)] [user_id] [audio_data]
            string userId = GameManager.Instance?.UserId ?? "";
            byte[] userIdBytes = System.Text.Encoding.UTF8.GetBytes(userId);

            byte[] packet = new byte[2 + userIdBytes.Length + audioData.Length];
            packet[0] = 0x01; // Audio packet type
            packet[1] = (byte)userIdBytes.Length;
            Buffer.BlockCopy(userIdBytes, 0, packet, 2, userIdBytes.Length);
            Buffer.BlockCopy(audioData, 0, packet, 2 + userIdBytes.Length, audioData.Length);

            return packet;
        }

        private void HandleMessage(string message)
        {
            try
            {
                var envelope = JsonUtility.FromJson<MessageEnvelope>(message);

                switch (envelope.type)
                {
                    case "voice_audio":
                        var audioMsg = JsonUtility.FromJson<VoiceAudioMessage>(message);
                        if (!string.IsNullOrEmpty(audioMsg.audio_base64))
                        {
                            byte[] audioData = Convert.FromBase64String(audioMsg.audio_base64);
                            OnAudioReceived?.Invoke(audioMsg.user_id, audioData);
                        }
                        break;

                    case "voice_speaking":
                        var speakingMsg = JsonUtility.FromJson<VoiceSpeakingMessage>(message);
                        OnParticipantSpeaking?.Invoke(speakingMsg.user_id, speakingMsg.speaking);
                        break;

                    case "voice_error":
                        var errorMsg = JsonUtility.FromJson<VoiceErrorMessage>(message);
                        OnError?.Invoke(errorMsg.error);
                        break;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[VoiceWebSocket] Message parse error: {ex.Message}");
            }
        }

        private void HandleDisconnect()
        {
            _isConnected = false;
            OnError?.Invoke("Voice connection lost");
        }

        private void HandleSocketError(string error)
        {
            OnError?.Invoke(error);
        }

        private string GetVoiceServerUrl(string sessionId)
        {
            // Use environment-specific URL
            string baseUrl = Application.isEditor
                ? "ws://localhost:8080"
                : "wss://api.dryft.site";

            return $"{baseUrl}/v1/voice/session/{sessionId}";
        }
    }

    // Message types

    [Serializable]
    public class MessageEnvelope
    {
        public string type;
    }

    [Serializable]
    public class VoiceJoinMessage
    {
        public string type;
        public string session_id;
        public string user_id;
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

    [Serializable]
    public class VoiceSpeakingMessage
    {
        public string type;
        public string session_id;
        public string user_id;
        public bool speaking;
    }

    [Serializable]
    public class VoiceErrorMessage
    {
        public string type;
        public string error;
    }
}
