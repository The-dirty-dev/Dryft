using UnityEngine;

namespace Drift.Environment
{
    /// <summary>
    /// Attach to objects with neon materials for easy customization.
    /// </summary>
    [RequireComponent(typeof(Renderer))]
    public class NeonObject : MonoBehaviour
    {
        [Header("Neon Settings")]
        [SerializeField] private Color _neonColor = Color.cyan;
        [SerializeField] private float _intensity = 1.5f;
        [SerializeField] private bool _pulse = true;
        [SerializeField] private float _pulseSpeed = 2f;
        [SerializeField] private float _pulseAmount = 0.3f;

        [Header("Audio Reactive")]
        [SerializeField] private bool _audioReactive = false;
        [SerializeField] private float _audioSensitivity = 2f;

        private Renderer _renderer;
        private MaterialPropertyBlock _props;
        private float _baseIntensity;

        private void Awake()
        {
            _renderer = GetComponent<Renderer>();
            _props = new MaterialPropertyBlock();
            _baseIntensity = _intensity;
        }

        private void Start()
        {
            ApplyProperties();
        }

        private void Update()
        {
            if (_pulse || _audioReactive)
            {
                float currentIntensity = _baseIntensity;

                if (_pulse)
                {
                    currentIntensity *= 1 + Mathf.Sin(Time.time * _pulseSpeed) * _pulseAmount;
                }

                // Audio reactive (would need AudioAnalyzer integration)
                // if (_audioReactive && AudioAnalyzer.Instance != null)
                // {
                //     currentIntensity *= 1 + AudioAnalyzer.Instance.GetBass() * _audioSensitivity;
                // }

                _props.SetFloat("_EmissionIntensity", currentIntensity);
                _renderer.SetPropertyBlock(_props);
            }
        }

        private void ApplyProperties()
        {
            _renderer.GetPropertyBlock(_props);
            _props.SetColor("_Color", _neonColor);
            _props.SetColor("_EmissionColor", _neonColor);
            _props.SetFloat("_EmissionIntensity", _intensity);
            _props.SetFloat("_PulseSpeed", _pulseSpeed);
            _props.SetFloat("_PulseAmount", _pulseAmount);
            _renderer.SetPropertyBlock(_props);
        }

        /// <summary>
        /// Sets the neon color at runtime.
        /// </summary>
        public void SetColor(Color color)
        {
            _neonColor = color;
            ApplyProperties();
        }

        /// <summary>
        /// Sets the emission intensity.
        /// </summary>
        public void SetIntensity(float intensity)
        {
            _intensity = intensity;
            _baseIntensity = intensity;
            ApplyProperties();
        }

        /// <summary>
        /// Flashes the neon briefly.
        /// </summary>
        public void Flash(float duration = 0.1f)
        {
            StartCoroutine(FlashCoroutine(duration));
        }

        private System.Collections.IEnumerator FlashCoroutine(float duration)
        {
            float originalIntensity = _intensity;
            _intensity = 5f;
            ApplyProperties();

            yield return new WaitForSeconds(duration);

            _intensity = originalIntensity;
            ApplyProperties();
        }

#if UNITY_EDITOR
        private void OnValidate()
        {
            if (_renderer == null) _renderer = GetComponent<Renderer>();
            if (_props == null) _props = new MaterialPropertyBlock();

            if (Application.isPlaying)
            {
                ApplyProperties();
            }
        }
#endif
    }
}
