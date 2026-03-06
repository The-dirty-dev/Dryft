using UnityEngine;
using UnityEngine.UI;
using Drift.Environment;

namespace Drift.Environment.Interactables
{
    /// <summary>
    /// Jukebox interactable - controls music playback.
    /// </summary>
    public class Jukebox : InteractableObject
    {
        [Header("Jukebox UI")]
        [SerializeField] private Canvas _jukeboxCanvas;
        [SerializeField] private Text _trackNameText;
        [SerializeField] private TextMesh _worldTrackText;
        [SerializeField] private Slider _volumeSlider;
        [SerializeField] private Image _progressBar;
        [SerializeField] private Image _albumArt;

        [Header("Visuals")]
        [SerializeField] private GameObject _vinylRecord;
        [SerializeField] private float _vinylRotationSpeed = 30f;
        [SerializeField] private Light[] _decorLights;
        [SerializeField] private ParticleSystem _noteParticles;

        [Header("Audio Reactive")]
        [SerializeField] private bool _reactToMusic = true;
        [SerializeField] private float _bassScaleMultiplier = 0.2f;

        private bool _isUIOpen;
        private Vector3 _originalVinylScale;
        private int _selectedTrackIndex;

        protected override void Start()
        {
            base.Start();

            if (_jukeboxCanvas != null)
            {
                _jukeboxCanvas.gameObject.SetActive(false);
            }

            if (_vinylRecord != null)
            {
                _originalVinylScale = _vinylRecord.transform.localScale;
            }

            // Subscribe to audio events
            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.OnTrackChanged += HandleTrackChanged;
                AudioManager.Instance.OnBeatDetected += HandleBeatDetected;
                _selectedTrackIndex = Mathf.Max(0, AudioManager.Instance.GetCurrentTrackIndex());
            }

            // Setup volume slider
            if (_volumeSlider != null)
            {
                _volumeSlider.value = 0.4f;
                _volumeSlider.onValueChanged.AddListener(OnVolumeChanged);
            }

            UpdateTrackDisplay();
        }

        protected override void Update()
        {
            base.Update();

            // Rotate vinyl record while music plays
            if (_vinylRecord != null && AudioManager.Instance != null)
            {
                _vinylRecord.transform.Rotate(Vector3.up, _vinylRotationSpeed * Time.deltaTime);
            }

            // Audio reactive scaling
            if (_reactToMusic && _vinylRecord != null && AudioManager.Instance != null)
            {
                float bass = AudioManager.Instance.GetBassLevel();
                float scale = 1f + (bass * _bassScaleMultiplier);
                _vinylRecord.transform.localScale = _originalVinylScale * scale;
            }

            // Update progress bar
            if (_progressBar != null && AudioManager.Instance != null)
            {
                _progressBar.fillAmount = AudioManager.Instance.GetTrackProgress();
            }
        }

        private void OnDestroy()
        {
            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.OnTrackChanged -= HandleTrackChanged;
                AudioManager.Instance.OnBeatDetected -= HandleBeatDetected;
            }
        }

        public override void Interact()
        {
            base.Interact();
            ToggleUI();
        }

        private void ToggleUI()
        {
            _isUIOpen = !_isUIOpen;

            if (_jukeboxCanvas != null)
            {
                _jukeboxCanvas.gameObject.SetActive(_isUIOpen);

                if (_isUIOpen)
                {
                    UpdateTrackDisplay();
                }
            }
        }

        private void HandleTrackChanged(AudioClip track)
        {
            UpdateTrackDisplay();

            // Flash lights
            FlashLights();
        }

        private void HandleBeatDetected()
        {
            // Pulse lights on beat
            PulseLights();

            // Emit note particles
            if (_noteParticles != null)
            {
                _noteParticles.Emit(3);
            }
        }

        private void UpdateTrackDisplay()
        {
            if (AudioManager.Instance == null)
            {
                return;
            }

            _selectedTrackIndex = Mathf.Max(0, AudioManager.Instance.GetCurrentTrackIndex());
            string currentName = AudioManager.Instance.GetCurrentTrackName();
            string display = $"{currentName}";

            if (_trackNameText != null)
            {
                _trackNameText.text = display;
            }

            if (_worldTrackText != null)
            {
                _worldTrackText.text = display;
            }
        }

        private void FlashLights()
        {
            foreach (var light in _decorLights)
            {
                if (light != null)
                {
                    StartCoroutine(FlashLight(light));
                }
            }
        }

        private System.Collections.IEnumerator FlashLight(Light light)
        {
            float originalIntensity = light.intensity;
            light.intensity = originalIntensity * 3f;
            yield return new WaitForSeconds(0.1f);
            light.intensity = originalIntensity;
        }

        private void PulseLights()
        {
            foreach (var light in _decorLights)
            {
                if (light != null)
                {
                    StartCoroutine(PulseLight(light));
                }
            }
        }

        private System.Collections.IEnumerator PulseLight(Light light)
        {
            float originalIntensity = light.intensity;
            light.intensity = originalIntensity * 1.5f;
            yield return new WaitForSeconds(0.05f);
            light.intensity = originalIntensity;
        }

        /// <summary>
        /// UI Button: Play next track.
        /// </summary>
        public void OnNextTrackPressed()
        {
            if (AudioManager.Instance == null) return;

            int trackCount = AudioManager.Instance.GetTrackCount();
            if (trackCount == 0) return;

            _selectedTrackIndex = (_selectedTrackIndex + 1) % trackCount;
            AudioManager.Instance.PlayTrackAt(_selectedTrackIndex);
            AudioManager.Instance.PlayUIClick();
            UpdateTrackDisplay();
        }

        /// <summary>
        /// UI Button: Play previous track.
        /// </summary>
        public void OnPreviousTrackPressed()
        {
            if (AudioManager.Instance == null) return;

            int trackCount = AudioManager.Instance.GetTrackCount();
            if (trackCount == 0) return;

            _selectedTrackIndex = (_selectedTrackIndex - 1 + trackCount) % trackCount;
            AudioManager.Instance.PlayTrackAt(_selectedTrackIndex);
            AudioManager.Instance.PlayUIClick();
            UpdateTrackDisplay();
        }

        /// <summary>
        /// UI Button: Toggle play/pause.
        /// </summary>
        public void OnPlayPausePressed()
        {
            AudioManager.Instance?.ToggleMusic();
            AudioManager.Instance?.PlayUIClick();
        }

        /// <summary>
        /// World button: ask the bartender to pick and queue a track.
        /// </summary>
        public void OnRequestFromBartenderPressed()
        {
            var bartender = FindFirstObjectByType<BartenderServicePoint>();
            if (bartender == null)
            {
                AudioManager.Instance?.PlayNotification();
                return;
            }

            bartender.RequestSongFromJukebox(this);
            AudioManager.Instance?.PlayUIClick();
        }

        /// <summary>
        /// UI Slider: Volume changed.
        /// </summary>
        public void OnVolumeChanged(float value)
        {
            AudioManager.Instance?.SetMusicVolume(value);
        }

        /// <summary>
        /// UI Button: Close jukebox UI.
        /// </summary>
        public void OnClosePressed()
        {
            _isUIOpen = false;
            if (_jukeboxCanvas != null)
            {
                _jukeboxCanvas.gameObject.SetActive(false);
            }
            AudioManager.Instance?.PlayUIClick();
        }

        /// <summary>
        /// Forces display text refresh when another system changes tracks.
        /// </summary>
        public void RefreshTrackDisplayFromExternal()
        {
            UpdateTrackDisplay();
        }
    }
}
