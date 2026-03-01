using UnityEngine;
using System;
using System.Collections.Generic;
using Drift.Core;
using Drift.API;

namespace Drift.Voice
{
    /// <summary>
    /// Manages voice chat for companion sessions.
    /// Handles audio capture, transmission, and playback between VR user and companions.
    ///
    /// Uses WebRTC-compatible audio streaming for cross-platform compatibility.
    /// </summary>
    public class VoiceChatManager : MonoBehaviour
    {
        public static VoiceChatManager Instance { get; private set; }

        [Header("Audio Settings")]
        [SerializeField] private int _sampleRate = 48000;
        [SerializeField] private int _channels = 1;
        [SerializeField] private float _voiceDetectionThreshold = 0.01f;
        [SerializeField] private float _silenceTimeout = 0.5f;

        [Header("References")]
        [SerializeField] private AudioSource _microphoneSource;
        [SerializeField] private AudioSource _playbackSource;

        [Header("3D Audio")]
        [SerializeField] private bool _use3DAudio = false;
        [SerializeField] private float _maxDistance = 10f;
        [SerializeField] private float _minDistance = 1f;

        // State
        public bool IsInitialized { get; private set; }
        public bool IsMicrophoneActive { get; private set; }
        public bool IsMuted { get; private set; }
        public bool IsDeafened { get; private set; }
        public float CurrentVolume { get; private set; }
        public string CurrentMicrophone { get; private set; }

        // Companions with voice
        private Dictionary<string, VoiceParticipant> _participants = new();

        // Audio capture
        private AudioClip _microphoneClip;
        private int _lastSamplePosition;
        private float[] _sampleBuffer;
        private bool _isTransmitting;
        private float _silenceTimer;

        // Events
        public event Action OnVoiceChatStarted;
        public event Action OnVoiceChatEnded;
        public event Action<string> OnParticipantJoined;
        public event Action<string> OnParticipantLeft;
        public event Action<string, bool> OnParticipantSpeaking;
        public event Action<string> OnError;

        private CompanionSessionManager _companionSession;
        private VoiceWebSocket _voiceSocket;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            _sampleBuffer = new float[1024];
        }

        private void Start()
        {
            _companionSession = CompanionSessionManager.Instance;

            // Subscribe to companion session events
            if (_companionSession != null)
            {
                _companionSession.OnSessionCreated += HandleSessionCreated;
                _companionSession.OnSessionEnded += HandleSessionEnded;
                _companionSession.OnCompanionJoined += HandleCompanionJoined;
                _companionSession.OnCompanionLeft += HandleCompanionLeft;
            }

            // Create audio sources if not assigned
            SetupAudioSources();
        }

        private void Update()
        {
            if (IsMicrophoneActive && !IsMuted)
            {
                ProcessMicrophoneInput();
            }
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;

            StopVoiceChat();

            if (_companionSession != null)
            {
                _companionSession.OnSessionCreated -= HandleSessionCreated;
                _companionSession.OnSessionEnded -= HandleSessionEnded;
                _companionSession.OnCompanionJoined -= HandleCompanionJoined;
                _companionSession.OnCompanionLeft -= HandleCompanionLeft;
            }
        }

        // ==========================================================================
        // Setup
        // ==========================================================================

        private void SetupAudioSources()
        {
            if (_microphoneSource == null)
            {
                var micObj = new GameObject("VoiceMicrophone");
                micObj.transform.SetParent(transform);
                _microphoneSource = micObj.AddComponent<AudioSource>();
                _microphoneSource.loop = true;
                _microphoneSource.playOnAwake = false;
            }

            if (_playbackSource == null)
            {
                var playObj = new GameObject("VoicePlayback");
                playObj.transform.SetParent(transform);
                _playbackSource = playObj.AddComponent<AudioSource>();
                _playbackSource.playOnAwake = false;
                _playbackSource.spatialBlend = _use3DAudio ? 1f : 0f;

                if (_use3DAudio)
                {
                    _playbackSource.minDistance = _minDistance;
                    _playbackSource.maxDistance = _maxDistance;
                    _playbackSource.rolloffMode = AudioRolloffMode.Linear;
                }
            }
        }

        // ==========================================================================
        // Voice Chat Control
        // ==========================================================================

        /// <summary>
        /// Initializes voice chat for the current companion session.
        /// </summary>
        public async void StartVoiceChat()
        {
            if (IsInitialized)
            {
                Debug.LogWarning("[VoiceChatManager] Already initialized");
                return;
            }

            if (_companionSession == null || !_companionSession.HasActiveSession)
            {
                OnError?.Invoke("No active companion session");
                return;
            }

            // Check microphone permissions
            if (Microphone.devices.Length == 0)
            {
                OnError?.Invoke("No microphone found");
                return;
            }

            // Use default microphone
            CurrentMicrophone = Microphone.devices[0];

            // Connect voice WebSocket
            _voiceSocket = new VoiceWebSocket();
            _voiceSocket.OnAudioReceived += HandleAudioReceived;
            _voiceSocket.OnParticipantSpeaking += HandleRemoteSpeaking;
            _voiceSocket.OnError += HandleSocketError;

            bool connected = await _voiceSocket.Connect(_companionSession.SessionId);

            if (connected)
            {
                IsInitialized = true;
                StartMicrophone();
                OnVoiceChatStarted?.Invoke();
                Debug.Log("[VoiceChatManager] Voice chat started");
            }
            else
            {
                OnError?.Invoke("Failed to connect to voice server");
            }
        }

        /// <summary>
        /// Stops voice chat.
        /// </summary>
        public void StopVoiceChat()
        {
            if (!IsInitialized) return;

            StopMicrophone();

            if (_voiceSocket != null)
            {
                _voiceSocket.OnAudioReceived -= HandleAudioReceived;
                _voiceSocket.OnParticipantSpeaking -= HandleRemoteSpeaking;
                _voiceSocket.OnError -= HandleSocketError;
                _voiceSocket.Disconnect();
                _voiceSocket = null;
            }

            _participants.Clear();
            IsInitialized = false;

            OnVoiceChatEnded?.Invoke();
            Debug.Log("[VoiceChatManager] Voice chat stopped");
        }

        // ==========================================================================
        // Microphone
        // ==========================================================================

        private void StartMicrophone()
        {
            if (IsMicrophoneActive) return;

            _microphoneClip = Microphone.Start(CurrentMicrophone, true, 1, _sampleRate);

            // Wait for microphone to start
            while (Microphone.GetPosition(CurrentMicrophone) <= 0) { }

            _microphoneSource.clip = _microphoneClip;
            _microphoneSource.loop = true;
            _microphoneSource.Play();

            // Mute local playback (we don't want to hear ourselves)
            _microphoneSource.volume = 0f;

            IsMicrophoneActive = true;
            _lastSamplePosition = 0;

            Debug.Log($"[VoiceChatManager] Microphone started: {CurrentMicrophone}");
        }

        private void StopMicrophone()
        {
            if (!IsMicrophoneActive) return;

            Microphone.End(CurrentMicrophone);
            _microphoneSource.Stop();

            IsMicrophoneActive = false;
            _isTransmitting = false;

            Debug.Log("[VoiceChatManager] Microphone stopped");
        }

        private void ProcessMicrophoneInput()
        {
            int currentPosition = Microphone.GetPosition(CurrentMicrophone);
            if (currentPosition < _lastSamplePosition)
            {
                // Wrapped around
                _lastSamplePosition = 0;
            }

            int samplesToRead = currentPosition - _lastSamplePosition;
            if (samplesToRead <= 0) return;

            // Resize buffer if needed
            if (_sampleBuffer.Length < samplesToRead)
            {
                _sampleBuffer = new float[samplesToRead];
            }

            _microphoneClip.GetData(_sampleBuffer, _lastSamplePosition);
            _lastSamplePosition = currentPosition;

            // Calculate volume
            float maxVolume = 0f;
            for (int i = 0; i < samplesToRead; i++)
            {
                float abs = Mathf.Abs(_sampleBuffer[i]);
                if (abs > maxVolume) maxVolume = abs;
            }
            CurrentVolume = maxVolume;

            // Voice detection
            bool isSpeaking = maxVolume > _voiceDetectionThreshold;

            if (isSpeaking)
            {
                _silenceTimer = _silenceTimeout;

                if (!_isTransmitting)
                {
                    _isTransmitting = true;
                    OnParticipantSpeaking?.Invoke(GameManager.Instance?.UserId ?? "local", true);
                }

                // Send audio data
                SendAudioData(_sampleBuffer, samplesToRead);
            }
            else
            {
                _silenceTimer -= Time.deltaTime;

                if (_silenceTimer <= 0 && _isTransmitting)
                {
                    _isTransmitting = false;
                    OnParticipantSpeaking?.Invoke(GameManager.Instance?.UserId ?? "local", false);
                }
            }
        }

        private void SendAudioData(float[] samples, int count)
        {
            if (_voiceSocket == null || !_voiceSocket.IsConnected) return;

            // Convert to bytes (16-bit PCM)
            byte[] audioData = new byte[count * 2];
            for (int i = 0; i < count; i++)
            {
                short sample = (short)(samples[i] * 32767f);
                audioData[i * 2] = (byte)(sample & 0xFF);
                audioData[i * 2 + 1] = (byte)((sample >> 8) & 0xFF);
            }

            _voiceSocket.SendAudio(audioData);
        }

        // ==========================================================================
        // Audio Playback
        // ==========================================================================

        private void HandleAudioReceived(string participantId, byte[] audioData)
        {
            if (IsDeafened) return;

            // Get or create participant
            if (!_participants.TryGetValue(participantId, out var participant))
            {
                participant = CreateParticipant(participantId);
                _participants[participantId] = participant;
            }

            // Convert bytes to float samples
            int sampleCount = audioData.Length / 2;
            float[] samples = new float[sampleCount];

            for (int i = 0; i < sampleCount; i++)
            {
                short sample = (short)(audioData[i * 2] | (audioData[i * 2 + 1] << 8));
                samples[i] = sample / 32767f;
            }

            // Play audio
            participant.PlayAudio(samples, _sampleRate, _channels);
        }

        private VoiceParticipant CreateParticipant(string participantId)
        {
            var obj = new GameObject($"VoiceParticipant_{participantId}");
            obj.transform.SetParent(transform);

            var source = obj.AddComponent<AudioSource>();
            source.spatialBlend = _use3DAudio ? 1f : 0f;
            source.playOnAwake = false;

            if (_use3DAudio)
            {
                source.minDistance = _minDistance;
                source.maxDistance = _maxDistance;
                source.rolloffMode = AudioRolloffMode.Linear;
            }

            var participant = obj.AddComponent<VoiceParticipant>();
            participant.Initialize(participantId, source);

            OnParticipantJoined?.Invoke(participantId);

            return participant;
        }

        private void RemoveParticipant(string participantId)
        {
            if (_participants.TryGetValue(participantId, out var participant))
            {
                Destroy(participant.gameObject);
                _participants.Remove(participantId);
                OnParticipantLeft?.Invoke(participantId);
            }
        }

        private void HandleRemoteSpeaking(string participantId, bool speaking)
        {
            OnParticipantSpeaking?.Invoke(participantId, speaking);
        }

        // ==========================================================================
        // Controls
        // ==========================================================================

        /// <summary>
        /// Mutes/unmutes the microphone.
        /// </summary>
        public void SetMuted(bool muted)
        {
            IsMuted = muted;

            if (muted && _isTransmitting)
            {
                _isTransmitting = false;
                OnParticipantSpeaking?.Invoke(GameManager.Instance?.UserId ?? "local", false);
            }

            Debug.Log($"[VoiceChatManager] Muted: {muted}");
        }

        /// <summary>
        /// Toggles mute state.
        /// </summary>
        public bool ToggleMute()
        {
            SetMuted(!IsMuted);
            return IsMuted;
        }

        /// <summary>
        /// Deafens/undeafens (stops receiving audio).
        /// </summary>
        public void SetDeafened(bool deafened)
        {
            IsDeafened = deafened;

            // Also mute when deafened
            if (deafened)
            {
                SetMuted(true);
            }

            Debug.Log($"[VoiceChatManager] Deafened: {deafened}");
        }

        /// <summary>
        /// Sets the microphone device.
        /// </summary>
        public void SetMicrophone(string deviceName)
        {
            if (CurrentMicrophone == deviceName) return;

            bool wasActive = IsMicrophoneActive;

            if (wasActive)
            {
                StopMicrophone();
            }

            CurrentMicrophone = deviceName;

            if (wasActive)
            {
                StartMicrophone();
            }
        }

        /// <summary>
        /// Gets available microphones.
        /// </summary>
        public string[] GetMicrophones()
        {
            return Microphone.devices;
        }

        /// <summary>
        /// Sets output volume for a specific participant.
        /// </summary>
        public void SetParticipantVolume(string participantId, float volume)
        {
            if (_participants.TryGetValue(participantId, out var participant))
            {
                participant.SetVolume(Mathf.Clamp01(volume));
            }
        }

        /// <summary>
        /// Sets master output volume.
        /// </summary>
        public void SetMasterVolume(float volume)
        {
            foreach (var participant in _participants.Values)
            {
                participant.SetMasterVolume(Mathf.Clamp01(volume));
            }
        }

        // ==========================================================================
        // Event Handlers
        // ==========================================================================

        private void HandleSessionCreated(SessionInfo session)
        {
            // Voice chat can be started manually or automatically
        }

        private void HandleSessionEnded()
        {
            StopVoiceChat();
        }

        private void HandleCompanionJoined(SessionUser user)
        {
            // Participant will be added when they start speaking
        }

        private void HandleCompanionLeft(string userId, string reason)
        {
            RemoveParticipant(userId);
        }

        private void HandleSocketError(string error)
        {
            OnError?.Invoke(error);
            Debug.LogError($"[VoiceChatManager] Socket error: {error}");
        }
    }

    /// <summary>
    /// Represents a voice chat participant with audio playback.
    /// </summary>
    public class VoiceParticipant : MonoBehaviour
    {
        public string ParticipantId { get; private set; }
        public bool IsSpeaking { get; private set; }

        private AudioSource _audioSource;
        private Queue<float[]> _audioQueue = new();
        private float _masterVolume = 1f;
        private float _volume = 1f;

        public void Initialize(string participantId, AudioSource audioSource)
        {
            ParticipantId = participantId;
            _audioSource = audioSource;
        }

        public void PlayAudio(float[] samples, int sampleRate, int channels)
        {
            // Create audio clip
            var clip = AudioClip.Create(
                $"voice_{ParticipantId}_{Time.frameCount}",
                samples.Length,
                channels,
                sampleRate,
                false
            );
            clip.SetData(samples, 0);

            // Queue for playback
            _audioSource.clip = clip;
            _audioSource.volume = _volume * _masterVolume;
            _audioSource.Play();

            IsSpeaking = true;
        }

        public void SetVolume(float volume)
        {
            _volume = volume;
            if (_audioSource != null)
            {
                _audioSource.volume = _volume * _masterVolume;
            }
        }

        public void SetMasterVolume(float volume)
        {
            _masterVolume = volume;
            if (_audioSource != null)
            {
                _audioSource.volume = _volume * _masterVolume;
            }
        }

        private void Update()
        {
            if (IsSpeaking && !_audioSource.isPlaying)
            {
                IsSpeaking = false;
            }
        }
    }
}
