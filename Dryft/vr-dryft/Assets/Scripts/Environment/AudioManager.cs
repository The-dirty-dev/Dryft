using UnityEngine;
using System.Collections;
using System.Collections.Generic;
using System.Linq;

namespace Drift.Environment
{
    /// <summary>
    /// Manages all audio in the bar environment.
    ///
    /// Features:
    /// - Lo-fi ambient music with beat detection
    /// - Spatial audio for 3D sound
    /// - Zone-based audio mixing
    /// - Music-reactive events
    /// </summary>
    public class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }

        [Header("Music")]
        [SerializeField] private AudioSource _musicSource;
        [SerializeField] private AudioClip[] _lofiTracks;
        [SerializeField] private float _musicVolume = 0.4f;
        [SerializeField] private bool _shufflePlaylist = true;

        [Header("Ambient")]
        [SerializeField] private AudioSource _ambientSource;
        [SerializeField] private AudioClip _barAmbience;
        [SerializeField] private float _ambientVolume = 0.2f;

        [Header("Sound Effects")]
        [SerializeField] private AudioSource _sfxSource;
        [SerializeField] private AudioClip _uiClick;
        [SerializeField] private AudioClip _notification;
        [SerializeField] private AudioClip _teleport;
        [SerializeField] private AudioClip _consentGrant;

        [Header("Spatial Audio")]
        [SerializeField] private AudioSource _spatialTemplate;
        [SerializeField] private int _maxSpatialSources = 8;

        [Header("Beat Detection")]
        [SerializeField] private bool _enableBeatDetection = true;
        [SerializeField] private float _beatThreshold = 0.8f;
        [SerializeField] private float _beatCooldown = 0.2f;

        // Events
        public event System.Action OnBeatDetected;
        public event System.Action<AudioClip> OnTrackChanged;

        // State
        private int _currentTrackIndex = -1;
        private float _lastBeatTime;
        private Queue<AudioSource> _spatialSourcePool = new Queue<AudioSource>();
        private List<AudioSource> _activeSpatialSources = new List<AudioSource>();

        // Audio analysis
        private float[] _spectrumData = new float[256];
        private float[] _previousSpectrum = new float[256];

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            InitializeSpatialPool();
        }

        private void Start()
        {
            AutoLoadTracksIfMissing();
            StartAmbience();
            PlayNextTrack();
        }

        private void Update()
        {
            if (_enableBeatDetection && _musicSource != null && _musicSource.isPlaying)
            {
                AnalyzeAudio();
            }

            // Auto-play next track
            if (_musicSource != null && !_musicSource.isPlaying && _lofiTracks.Length > 0)
            {
                PlayNextTrack();
            }
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void InitializeSpatialPool()
        {
            if (_spatialTemplate == null) return;

            for (int i = 0; i < _maxSpatialSources; i++)
            {
                var source = Instantiate(_spatialTemplate, transform);
                source.gameObject.SetActive(false);
                _spatialSourcePool.Enqueue(source);
            }
        }

        private void StartAmbience()
        {
            if (_ambientSource == null || _barAmbience == null) return;

            _ambientSource.clip = _barAmbience;
            _ambientSource.volume = _ambientVolume;
            _ambientSource.loop = true;
            _ambientSource.Play();
        }

        private void AutoLoadTracksIfMissing()
        {
            if (_lofiTracks != null && _lofiTracks.Length > 0)
            {
                return;
            }

            var loaded = Resources.LoadAll<AudioClip>("Audio/Tracks");
            if (loaded == null || loaded.Length == 0)
            {
                Debug.LogWarning("[AudioManager] No tracks assigned and none found in Resources/Audio/Tracks.");
                return;
            }

            _lofiTracks = loaded.OrderBy(c => c.name).ToArray();
            Debug.Log($"[AudioManager] Auto-loaded {_lofiTracks.Length} tracks from Resources/Audio/Tracks.");
        }

        /// <summary>
        /// Plays the next track in the playlist.
        /// </summary>
        public void PlayNextTrack()
        {
            if (_musicSource == null || _lofiTracks == null || _lofiTracks.Length == 0)
                return;

            if (_shufflePlaylist)
            {
                int newIndex;
                do
                {
                    newIndex = Random.Range(0, _lofiTracks.Length);
                } while (newIndex == _currentTrackIndex && _lofiTracks.Length > 1);

                _currentTrackIndex = newIndex;
            }
            else
            {
                _currentTrackIndex = (_currentTrackIndex + 1) % _lofiTracks.Length;
            }

            var track = _lofiTracks[_currentTrackIndex];
            _musicSource.clip = track;
            _musicSource.volume = _musicVolume;
            _musicSource.Play();

            OnTrackChanged?.Invoke(track);
            Debug.Log($"[AudioManager] Now playing: {track.name}");
        }

        /// <summary>
        /// Skips to a previous track.
        /// </summary>
        public void PlayPreviousTrack()
        {
            if (_lofiTracks == null || _lofiTracks.Length == 0) return;

            _currentTrackIndex = (_currentTrackIndex - 1 + _lofiTracks.Length) % _lofiTracks.Length;
            _musicSource.clip = _lofiTracks[_currentTrackIndex];
            _musicSource.Play();

            OnTrackChanged?.Invoke(_lofiTracks[_currentTrackIndex]);
        }

        /// <summary>
        /// Plays a specific track by index.
        /// </summary>
        public void PlayTrackAt(int index)
        {
            if (_musicSource == null || _lofiTracks == null || _lofiTracks.Length == 0)
            {
                return;
            }

            int safeIndex = Mathf.Clamp(index, 0, _lofiTracks.Length - 1);
            _currentTrackIndex = safeIndex;

            var track = _lofiTracks[_currentTrackIndex];
            _musicSource.clip = track;
            _musicSource.volume = _musicVolume;
            _musicSource.Play();

            OnTrackChanged?.Invoke(track);
            Debug.Log($"[AudioManager] Selected track: {track.name}");
        }

        /// <summary>
        /// Sets the master music volume.
        /// </summary>
        public void SetMusicVolume(float volume)
        {
            _musicVolume = Mathf.Clamp01(volume);
            if (_musicSource != null)
            {
                _musicSource.volume = _musicVolume;
            }
        }

        /// <summary>
        /// Sets the ambient volume.
        /// </summary>
        public void SetAmbientVolume(float volume)
        {
            _ambientVolume = Mathf.Clamp01(volume);
            if (_ambientSource != null)
            {
                _ambientSource.volume = _ambientVolume;
            }
        }

        /// <summary>
        /// Pauses/resumes music.
        /// </summary>
        public void ToggleMusic()
        {
            if (_musicSource == null) return;

            if (_musicSource.isPlaying)
            {
                _musicSource.Pause();
            }
            else
            {
                _musicSource.UnPause();
            }
        }

        /// <summary>
        /// Plays a UI sound effect.
        /// </summary>
        public void PlayUIClick()
        {
            PlaySFX(_uiClick);
        }

        /// <summary>
        /// Plays a notification sound.
        /// </summary>
        public void PlayNotification()
        {
            PlaySFX(_notification);
        }

        /// <summary>
        /// Plays the teleport sound.
        /// </summary>
        public void PlayTeleport()
        {
            PlaySFX(_teleport);
        }

        /// <summary>
        /// Plays the consent grant sound.
        /// </summary>
        public void PlayConsentGrant()
        {
            PlaySFX(_consentGrant);
        }

        /// <summary>
        /// Plays a sound effect.
        /// </summary>
        public void PlaySFX(AudioClip clip, float volume = 1f)
        {
            if (_sfxSource == null || clip == null) return;
            _sfxSource.PlayOneShot(clip, volume);
        }

        /// <summary>
        /// Plays a 3D spatial sound at a position.
        /// </summary>
        public void PlaySpatialSound(AudioClip clip, Vector3 position, float volume = 1f)
        {
            if (clip == null) return;

            AudioSource source = GetSpatialSource();
            if (source == null) return;

            source.transform.position = position;
            source.clip = clip;
            source.volume = volume;
            source.Play();

            StartCoroutine(ReturnSpatialSource(source, clip.length));
        }

        private AudioSource GetSpatialSource()
        {
            // Try to get from pool
            if (_spatialSourcePool.Count > 0)
            {
                var source = _spatialSourcePool.Dequeue();
                source.gameObject.SetActive(true);
                _activeSpatialSources.Add(source);
                return source;
            }

            // Steal oldest active source
            if (_activeSpatialSources.Count > 0)
            {
                var source = _activeSpatialSources[0];
                _activeSpatialSources.RemoveAt(0);
                source.Stop();
                _activeSpatialSources.Add(source);
                return source;
            }

            return null;
        }

        private IEnumerator ReturnSpatialSource(AudioSource source, float delay)
        {
            yield return new WaitForSeconds(delay + 0.1f);

            if (source != null)
            {
                source.gameObject.SetActive(false);
                _activeSpatialSources.Remove(source);
                _spatialSourcePool.Enqueue(source);
            }
        }

        private void AnalyzeAudio()
        {
            if (_musicSource == null) return;

            // Get spectrum data
            _musicSource.GetSpectrumData(_spectrumData, 0, FFTWindow.BlackmanHarris);

            // Calculate flux (change in spectrum)
            float flux = 0f;
            for (int i = 0; i < _spectrumData.Length; i++)
            {
                float diff = _spectrumData[i] - _previousSpectrum[i];
                if (diff > 0)
                {
                    flux += diff;
                }
                _previousSpectrum[i] = _spectrumData[i];
            }

            // Detect beat
            if (flux > _beatThreshold && Time.time - _lastBeatTime > _beatCooldown)
            {
                _lastBeatTime = Time.time;
                OnBeatDetected?.Invoke();

                // Trigger visual flash on strong beats
                if (flux > _beatThreshold * 1.5f)
                {
                    EnvironmentManager.Instance?.TriggerFlash(0.05f);
                }
            }
        }

        /// <summary>
        /// Gets the current audio level (0-1).
        /// </summary>
        public float GetCurrentLevel()
        {
            if (_spectrumData == null) return 0f;

            float sum = 0f;
            for (int i = 0; i < 32; i++) // Low frequencies
            {
                sum += _spectrumData[i];
            }
            return Mathf.Clamp01(sum * 10f);
        }

        /// <summary>
        /// Gets the current bass level (0-1).
        /// </summary>
        public float GetBassLevel()
        {
            if (_spectrumData == null) return 0f;

            float sum = 0f;
            for (int i = 0; i < 8; i++) // Very low frequencies
            {
                sum += _spectrumData[i];
            }
            return Mathf.Clamp01(sum * 20f);
        }

        /// <summary>
        /// Gets the current track info.
        /// </summary>
        public string GetCurrentTrackName()
        {
            if (_musicSource == null || _musicSource.clip == null)
                return "No track playing";

            return _musicSource.clip.name;
        }

        /// <summary>
        /// Returns true when the music source is actively playing.
        /// </summary>
        public bool IsMusicPlaying()
        {
            return _musicSource != null && _musicSource.isPlaying;
        }

        /// <summary>
        /// Gets the currently selected track index.
        /// </summary>
        public int GetCurrentTrackIndex()
        {
            return _currentTrackIndex;
        }

        /// <summary>
        /// Gets the total track count.
        /// </summary>
        public int GetTrackCount()
        {
            return _lofiTracks != null ? _lofiTracks.Length : 0;
        }

        /// <summary>
        /// Gets a track name by index.
        /// </summary>
        public string GetTrackNameAt(int index)
        {
            if (_lofiTracks == null || _lofiTracks.Length == 0)
            {
                return "No tracks";
            }

            int safeIndex = Mathf.Clamp(index, 0, _lofiTracks.Length - 1);
            return _lofiTracks[safeIndex] != null ? _lofiTracks[safeIndex].name : $"Track {safeIndex + 1}";
        }

        /// <summary>
        /// Gets the current track progress (0-1).
        /// </summary>
        public float GetTrackProgress()
        {
            if (_musicSource == null || _musicSource.clip == null)
                return 0f;

            return _musicSource.time / _musicSource.clip.length;
        }
    }
}
