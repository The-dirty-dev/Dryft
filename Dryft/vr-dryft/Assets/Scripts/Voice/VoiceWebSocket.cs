using UnityEngine;
using System;
using System.Threading.Tasks;
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
                _socket = CompanionWebSocket.Instance;
                if (_socket == null)
                {
                    var wsObject = new GameObject("CompanionWebSocket");
                    _socket = wsObject.AddComponent<CompanionWebSocket>();
                }

                _socket.OnMessageReceived += HandleMessage;
                _socket.OnDisconnected += HandleDisconnect;
                _socket.OnError += HandleSocketError;

                bool connected = _socket.IsConnected;
                if (!connected)
                {
                    var token = GameManager.Instance?.GetAccessToken();
                    if (string.IsNullOrEmpty(token))
                    {
                        OnError?.Invoke("Missing auth token");
                        return false;
                    }

                    connected = await _socket.Connect(token);
                }

                if (connected)
                {
                    _isConnected = true;

                    // Send join message
                    await _socket.Send("voice_join", new VoiceJoinMessage
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
                _socket.OnDisconnected -= HandleDisconnect;
                _socket.OnError -= HandleSocketError;
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

            var payload = new VoiceAudioMessage
            {
                type = "voice_audio",
                session_id = _sessionId,
                user_id = GameManager.Instance?.UserId,
                audio_base64 = Convert.ToBase64String(audioData),
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            _ = _socket.Send("voice_audio", payload);
        }

        /// <summary>
        /// Sends speaking state update.
        /// </summary>
        public async void SendSpeakingState(bool speaking)
        {
            if (!_isConnected || _socket == null) return;

            await _socket.Send("voice_speaking", new VoiceSpeakingMessage
            {
                type = "voice_speaking",
                session_id = _sessionId,
                user_id = GameManager.Instance?.UserId,
                speaking = speaking
            });
        }

        private void HandleMessage(WebSocketMessage message)
        {
            try
            {
                var type = message?.type;
                var payload = message?.payload;
                if (string.IsNullOrEmpty(type))
                {
                    return;
                }

                switch (type)
                {
                    case "voice_audio":
                        var audioMsg = JsonUtility.FromJson<VoiceAudioMessage>(payload);
                        if (!string.IsNullOrEmpty(audioMsg.audio_base64))
                        {
                            byte[] audioData = Convert.FromBase64String(audioMsg.audio_base64);
                            OnAudioReceived?.Invoke(audioMsg.user_id, audioData);
                        }
                        break;

                    case "voice_speaking":
                        var speakingMsg = JsonUtility.FromJson<VoiceSpeakingMessage>(payload);
                        OnParticipantSpeaking?.Invoke(speakingMsg.user_id, speakingMsg.speaking);
                        break;

                    case "voice_error":
                        var errorMsg = JsonUtility.FromJson<VoiceErrorMessage>(payload);
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
