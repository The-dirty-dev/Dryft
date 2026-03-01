using UnityEngine;
using System.Collections.Generic;

namespace Drift.Environment
{
    /// <summary>
    /// Manages the neon bar environment.
    ///
    /// Features:
    /// - Lo-fi neon aesthetic with dynamic lighting
    /// - Ambient audio management
    /// - Spawn point management
    /// - Environmental effects (fog, bloom)
    /// </summary>
    public class EnvironmentManager : MonoBehaviour
    {
        public static EnvironmentManager Instance { get; private set; }

        [Header("Lighting")]
        [SerializeField] private Light[] _neonLights;
        [SerializeField] private float _pulseSpeed = 1f;
        [SerializeField] private float _pulseIntensityMin = 0.5f;
        [SerializeField] private float _pulseIntensityMax = 1.0f;
        [SerializeField] private bool _enableLightPulse = true;

        [Header("Colors")]
        [SerializeField] private Color _primaryNeonColor = new Color(0, 1, 1); // Cyan
        [SerializeField] private Color _secondaryNeonColor = new Color(1, 0, 0.5f); // Magenta
        [SerializeField] private Color _accentNeonColor = new Color(0.5f, 0, 1); // Purple

        [Header("Audio")]
        [SerializeField] private AudioSource _ambientSource;
        [SerializeField] private AudioClip[] _ambientTracks;
        [SerializeField] private float _ambientVolume = 0.3f;

        [Header("Spawn Points")]
        [SerializeField] private Transform[] _publicSpawnPoints;
        [SerializeField] private Transform _boothEntrancePoint;

        [Header("Environment Objects")]
        [SerializeField] private GameObject _barCounter;
        [SerializeField] private GameObject _danceFloor;
        [SerializeField] private GameObject[] _neonSigns;
        [SerializeField] private ParticleSystem _fogEffect;

        [Header("Post Processing")]
        [SerializeField] private float _bloomIntensity = 1.5f;

        // Dynamic state
        private float _lightPhase;
        private int _currentTrackIndex;
        private Dictionary<Renderer, MaterialPropertyBlock> _neonMaterials = new Dictionary<Renderer, MaterialPropertyBlock>();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            InitializeNeonMaterials();
            StartAmbientAudio();
            SetupFog();
        }

        private void Update()
        {
            if (_enableLightPulse)
            {
                UpdateLightPulse();
            }
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void InitializeNeonMaterials()
        {
            // Find all renderers with neon materials
            var renderers = FindObjectsOfType<Renderer>();
            foreach (var renderer in renderers)
            {
                if (renderer.sharedMaterial != null &&
                    renderer.sharedMaterial.name.Contains("Neon"))
                {
                    var props = new MaterialPropertyBlock();
                    renderer.GetPropertyBlock(props);
                    _neonMaterials[renderer] = props;
                }
            }

            // Apply initial colors
            UpdateNeonColors();
        }

        private void UpdateLightPulse()
        {
            _lightPhase += Time.deltaTime * _pulseSpeed;

            // Smooth sine wave pulse
            float pulse = Mathf.Lerp(_pulseIntensityMin, _pulseIntensityMax,
                (Mathf.Sin(_lightPhase) + 1f) * 0.5f);

            foreach (var light in _neonLights)
            {
                if (light != null)
                {
                    light.intensity = pulse;
                }
            }

            // Update emissive materials
            foreach (var kvp in _neonMaterials)
            {
                kvp.Value.SetFloat("_EmissionIntensity", pulse);
                kvp.Key.SetPropertyBlock(kvp.Value);
            }
        }

        private void UpdateNeonColors()
        {
            foreach (var kvp in _neonMaterials)
            {
                // Alternate colors based on position
                Color color = kvp.Key.transform.position.x > 0
                    ? _primaryNeonColor
                    : _secondaryNeonColor;

                kvp.Value.SetColor("_EmissionColor", color);
                kvp.Key.SetPropertyBlock(kvp.Value);
            }
        }

        private void StartAmbientAudio()
        {
            if (_ambientSource == null || _ambientTracks == null || _ambientTracks.Length == 0)
                return;

            _currentTrackIndex = Random.Range(0, _ambientTracks.Length);
            _ambientSource.clip = _ambientTracks[_currentTrackIndex];
            _ambientSource.volume = _ambientVolume;
            _ambientSource.loop = true;
            _ambientSource.Play();
        }

        private void SetupFog()
        {
            if (_fogEffect != null)
            {
                _fogEffect.Play();
            }

            // Configure Unity fog
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogDensity = 0.02f;
            RenderSettings.fogColor = new Color(0.05f, 0.02f, 0.1f); // Dark purple
        }

        /// <summary>
        /// Gets a random public spawn point.
        /// </summary>
        public Transform GetRandomSpawnPoint()
        {
            if (_publicSpawnPoints == null || _publicSpawnPoints.Length == 0)
                return transform;

            return _publicSpawnPoints[Random.Range(0, _publicSpawnPoints.Length)];
        }

        /// <summary>
        /// Gets a specific spawn point by index.
        /// </summary>
        public Transform GetSpawnPoint(int index)
        {
            if (_publicSpawnPoints == null || index < 0 || index >= _publicSpawnPoints.Length)
                return transform;

            return _publicSpawnPoints[index];
        }

        /// <summary>
        /// Gets the booth entrance point.
        /// </summary>
        public Transform GetBoothEntrancePoint()
        {
            return _boothEntrancePoint ?? transform;
        }

        /// <summary>
        /// Sets the primary neon color scheme.
        /// </summary>
        public void SetColorScheme(Color primary, Color secondary)
        {
            _primaryNeonColor = primary;
            _secondaryNeonColor = secondary;
            UpdateNeonColors();
        }

        /// <summary>
        /// Triggers a flash effect (e.g., for beat drops).
        /// </summary>
        public void TriggerFlash(float duration = 0.1f)
        {
            StartCoroutine(FlashRoutine(duration));
        }

        private System.Collections.IEnumerator FlashRoutine(float duration)
        {
            // Max brightness
            foreach (var light in _neonLights)
            {
                if (light != null)
                    light.intensity = 3f;
            }

            yield return new WaitForSeconds(duration);

            // Return to normal
            foreach (var light in _neonLights)
            {
                if (light != null)
                    light.intensity = _pulseIntensityMax;
            }
        }

        /// <summary>
        /// Sets ambient audio volume.
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
        /// Enables or disables the light pulse effect.
        /// </summary>
        public void SetLightPulse(bool enabled)
        {
            _enableLightPulse = enabled;

            if (!enabled)
            {
                // Set to max intensity when disabled
                foreach (var light in _neonLights)
                {
                    if (light != null)
                        light.intensity = _pulseIntensityMax;
                }
            }
        }

        /// <summary>
        /// Skips to the next ambient track.
        /// </summary>
        public void NextTrack()
        {
            if (_ambientTracks == null || _ambientTracks.Length <= 1)
                return;

            _currentTrackIndex = (_currentTrackIndex + 1) % _ambientTracks.Length;
            _ambientSource.clip = _ambientTracks[_currentTrackIndex];
            _ambientSource.Play();
        }
    }
}
