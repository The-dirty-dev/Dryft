using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace Drift.Accessibility
{
    /// <summary>
    /// Post-processing effect for color blind correction.
    /// Attach this to the main camera or use as a renderer feature.
    /// </summary>
    [ExecuteAlways]
    public class ColorBlindPostProcess : MonoBehaviour
    {
        [Header("Settings")]
        [SerializeField] private Shader colorBlindShader;
        [SerializeField] private ColorBlindMode currentMode = ColorBlindMode.None;
        [SerializeField, Range(0f, 1f)] private float correctionStrength = 1f;

        private Material _material;
        private static readonly int ModeProperty = Shader.PropertyToID("_Mode");
        private static readonly int StrengthProperty = Shader.PropertyToID("_Strength");

        public ColorBlindMode Mode
        {
            get => currentMode;
            set
            {
                currentMode = value;
                UpdateMaterial();
            }
        }

        public float CorrectionStrength
        {
            get => correctionStrength;
            set
            {
                correctionStrength = Mathf.Clamp01(value);
                UpdateMaterial();
            }
        }

        private void OnEnable()
        {
            CreateMaterial();
        }

        private void OnDisable()
        {
            DestroyMaterial();
        }

        private void Start()
        {
            // Subscribe to accessibility settings changes
            if (VRAccessibilityManager.Instance != null)
            {
                VRAccessibilityManager.Instance.onSettingsChanged.AddListener(OnAccessibilitySettingsChanged);
                SyncWithAccessibilitySettings();
            }
        }

        private void OnDestroy()
        {
            if (VRAccessibilityManager.Instance != null)
            {
                VRAccessibilityManager.Instance.onSettingsChanged.RemoveListener(OnAccessibilitySettingsChanged);
            }
            DestroyMaterial();
        }

        private void OnAccessibilitySettingsChanged(AccessibilitySettings settings)
        {
            SyncWithAccessibilitySettings();
        }

        private void SyncWithAccessibilitySettings()
        {
            if (VRAccessibilityManager.Instance == null) return;

            var settings = VRAccessibilityManager.Instance.Settings;
            Mode = settings.colorBlindMode;
        }

        private void CreateMaterial()
        {
            if (colorBlindShader == null)
            {
                colorBlindShader = Shader.Find("Dryft/ColorBlindCorrection");
            }

            if (colorBlindShader != null && _material == null)
            {
                _material = new Material(colorBlindShader)
                {
                    hideFlags = HideFlags.HideAndDontSave
                };
                UpdateMaterial();
            }
        }

        private void DestroyMaterial()
        {
            if (_material != null)
            {
                if (Application.isPlaying)
                    Destroy(_material);
                else
                    DestroyImmediate(_material);
                _material = null;
            }
        }

        private void UpdateMaterial()
        {
            if (_material == null) return;

            _material.SetInt(ModeProperty, (int)currentMode);
            _material.SetFloat(StrengthProperty, correctionStrength);
        }

        // For Built-in Render Pipeline
        private void OnRenderImage(RenderTexture source, RenderTexture destination)
        {
            if (_material != null && currentMode != ColorBlindMode.None)
            {
                Graphics.Blit(source, destination, _material);
            }
            else
            {
                Graphics.Blit(source, destination);
            }
        }

#if UNITY_EDITOR
        private void OnValidate()
        {
            UpdateMaterial();
        }
#endif
    }

    /// <summary>
    /// URP Renderer Feature for color blind correction.
    /// Add this to your Universal Renderer Data asset.
    /// </summary>
    public class ColorBlindCorrectionFeature : ScriptableRendererFeature
    {
        [System.Serializable]
        public class Settings
        {
            public RenderPassEvent renderPassEvent = RenderPassEvent.AfterRenderingPostProcessing;
            public Shader shader;
            public ColorBlindMode mode = ColorBlindMode.None;
            [Range(0f, 1f)]
            public float strength = 1f;
        }

        public Settings settings = new Settings();

        private ColorBlindCorrectionPass _pass;

        public override void Create()
        {
            _pass = new ColorBlindCorrectionPass(settings);
        }

        public override void AddRenderPasses(ScriptableRenderer renderer, ref RenderingData renderingData)
        {
            if (settings.mode != ColorBlindMode.None && settings.shader != null)
            {
                renderer.EnqueuePass(_pass);
            }
        }

        public void SetMode(ColorBlindMode mode)
        {
            settings.mode = mode;
            if (_pass != null)
            {
                _pass.UpdateSettings(settings);
            }
        }

        protected override void Dispose(bool disposing)
        {
            _pass?.Cleanup();
        }
    }

    public class ColorBlindCorrectionPass : ScriptableRenderPass
    {
        private const string ProfilerTag = "Color Blind Correction";

        private Material _material;
        private ColorBlindCorrectionFeature.Settings _settings;
        private RTHandle _tempRT;

        private static readonly int ModeProperty = Shader.PropertyToID("_Mode");
        private static readonly int StrengthProperty = Shader.PropertyToID("_Strength");

        public ColorBlindCorrectionPass(ColorBlindCorrectionFeature.Settings settings)
        {
            _settings = settings;
            renderPassEvent = settings.renderPassEvent;

            if (settings.shader != null)
            {
                _material = CoreUtils.CreateEngineMaterial(settings.shader);
            }
        }

        public void UpdateSettings(ColorBlindCorrectionFeature.Settings settings)
        {
            _settings = settings;
            if (_material != null)
            {
                _material.SetInt(ModeProperty, (int)settings.mode);
                _material.SetFloat(StrengthProperty, settings.strength);
            }
        }

        public override void OnCameraSetup(CommandBuffer cmd, ref RenderingData renderingData)
        {
            var descriptor = renderingData.cameraData.cameraTargetDescriptor;
            descriptor.depthBufferBits = 0;

            RenderingUtils.ReAllocateIfNeeded(ref _tempRT, descriptor, FilterMode.Bilinear, TextureWrapMode.Clamp, name: "_ColorBlindTempRT");
        }

        public override void Execute(ScriptableRenderContext context, ref RenderingData renderingData)
        {
            if (_material == null || _settings.mode == ColorBlindMode.None)
                return;

            var cmd = CommandBufferPool.Get(ProfilerTag);

            _material.SetInt(ModeProperty, (int)_settings.mode);
            _material.SetFloat(StrengthProperty, _settings.strength);

            var source = renderingData.cameraData.renderer.cameraColorTargetHandle;

            Blitter.BlitCameraTexture(cmd, source, _tempRT, _material, 0);
            Blitter.BlitCameraTexture(cmd, _tempRT, source);

            context.ExecuteCommandBuffer(cmd);
            CommandBufferPool.Release(cmd);
        }

        public void Cleanup()
        {
            _tempRT?.Release();
            if (_material != null)
            {
                CoreUtils.Destroy(_material);
            }
        }
    }

    /// <summary>
    /// High contrast theme manager for VR UI.
    /// </summary>
    public class HighContrastTheme : MonoBehaviour
    {
        [Header("Standard Theme Colors")]
        [SerializeField] private Color standardBackground = new Color(0.06f, 0.06f, 0.14f);
        [SerializeField] private Color standardPrimary = new Color(0.91f, 0.27f, 0.38f);
        [SerializeField] private Color standardText = Color.white;
        [SerializeField] private Color standardSecondary = new Color(0.53f, 0.57f, 0.69f);

        [Header("High Contrast Colors")]
        [SerializeField] private Color highContrastBackground = Color.black;
        [SerializeField] private Color highContrastPrimary = Color.white;
        [SerializeField] private Color highContrastText = Color.white;
        [SerializeField] private Color highContrastSecondary = Color.yellow;

        [Header("UI References")]
        [SerializeField] private Material[] uiMaterials;
        [SerializeField] private TMPro.TMP_Text[] textElements;

        public static HighContrastTheme Instance { get; private set; }

        private bool _isHighContrast;

        public bool IsHighContrast => _isHighContrast;

        public Color Background => _isHighContrast ? highContrastBackground : standardBackground;
        public Color Primary => _isHighContrast ? highContrastPrimary : standardPrimary;
        public Color Text => _isHighContrast ? highContrastText : standardText;
        public Color Secondary => _isHighContrast ? highContrastSecondary : standardSecondary;

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
            if (VRAccessibilityManager.Instance != null)
            {
                VRAccessibilityManager.Instance.onSettingsChanged.AddListener(OnSettingsChanged);
                _isHighContrast = VRAccessibilityManager.Instance.Settings.highContrast;
                ApplyTheme();
            }
        }

        private void OnDestroy()
        {
            if (VRAccessibilityManager.Instance != null)
            {
                VRAccessibilityManager.Instance.onSettingsChanged.RemoveListener(OnSettingsChanged);
            }
        }

        private void OnSettingsChanged(AccessibilitySettings settings)
        {
            if (_isHighContrast != settings.highContrast)
            {
                _isHighContrast = settings.highContrast;
                ApplyTheme();
            }
        }

        public void SetHighContrast(bool enabled)
        {
            _isHighContrast = enabled;
            ApplyTheme();
        }

        private void ApplyTheme()
        {
            // Apply to materials
            if (uiMaterials != null)
            {
                foreach (var material in uiMaterials)
                {
                    if (material != null)
                    {
                        material.SetColor("_Color", Background);
                        material.SetColor("_BaseColor", Background);
                    }
                }
            }

            // Apply to text elements
            if (textElements != null)
            {
                foreach (var text in textElements)
                {
                    if (text != null)
                    {
                        text.color = Text;
                    }
                }
            }

            Debug.Log($"High contrast theme applied: {_isHighContrast}");
        }

        // Utility methods for other components
        public Color GetAccessibleColor(Color original)
        {
            if (!_isHighContrast) return original;

            // Determine if original is light or dark
            float brightness = (original.r + original.g + original.b) / 3f;
            return brightness > 0.5f ? Color.white : Color.black;
        }

        public Color GetContrastColor(Color background)
        {
            float luminance = 0.299f * background.r + 0.587f * background.g + 0.114f * background.b;
            return luminance > 0.5f ? Color.black : Color.white;
        }
    }
}
