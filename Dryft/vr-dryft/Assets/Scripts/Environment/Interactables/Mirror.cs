using UnityEngine;

namespace Drift.Environment.Interactables
{
    /// <summary>
    /// Mirror interactable - lets players see their avatar.
    /// Uses a render texture for real-time reflection.
    /// </summary>
    public class Mirror : MonoBehaviour
    {
        [Header("Mirror Setup")]
        [SerializeField] private Camera _reflectionCamera;
        [SerializeField] private RenderTexture _reflectionTexture;
        [SerializeField] private MeshRenderer _mirrorSurface;
        [SerializeField] private float _textureQuality = 1f; // 0.5 = half res

        [Header("Settings")]
        [SerializeField] private bool _autoDisableOnDistance = true;
        [SerializeField] private float _activeDistance = 5f;
        [SerializeField] private LayerMask _reflectionLayers;

        [Header("Frame")]
        [SerializeField] private Light _frameLight;
        [SerializeField] private Color _frameLightColor = new Color(1f, 0.9f, 0.8f);

        private bool _isActive;
        private Transform _playerTransform;

        private void Start()
        {
            // Create reflection texture if not assigned
            if (_reflectionTexture == null)
            {
                int width = Mathf.RoundToInt(Screen.width * _textureQuality);
                int height = Mathf.RoundToInt(Screen.height * _textureQuality);
                _reflectionTexture = new RenderTexture(width, height, 24);
                _reflectionTexture.name = "MirrorReflection";
            }

            // Setup camera
            if (_reflectionCamera != null)
            {
                _reflectionCamera.targetTexture = _reflectionTexture;
                _reflectionCamera.cullingMask = _reflectionLayers;
                _reflectionCamera.enabled = false; // We render manually
            }

            // Apply to mirror surface
            if (_mirrorSurface != null && _reflectionTexture != null)
            {
                MaterialPropertyBlock props = new MaterialPropertyBlock();
                _mirrorSurface.GetPropertyBlock(props);
                props.SetTexture("_MainTex", _reflectionTexture);
                _mirrorSurface.SetPropertyBlock(props);
            }

            // Setup frame light
            if (_frameLight != null)
            {
                _frameLight.color = _frameLightColor;
            }
        }

        private void Update()
        {
            UpdatePlayerReference();

            if (_autoDisableOnDistance)
            {
                UpdateActiveState();
            }

            if (_isActive)
            {
                UpdateReflectionCamera();
            }
        }

        private void UpdatePlayerReference()
        {
            if (_playerTransform == null)
            {
                var player = Player.PlayerController.Instance;
                if (player != null)
                {
                    _playerTransform = player.transform;
                }
            }
        }

        private void UpdateActiveState()
        {
            if (_playerTransform == null) return;

            float distance = Vector3.Distance(transform.position, _playerTransform.position);
            bool shouldBeActive = distance <= _activeDistance;

            if (shouldBeActive != _isActive)
            {
                _isActive = shouldBeActive;

                if (_reflectionCamera != null)
                {
                    _reflectionCamera.enabled = _isActive;
                }

                if (_frameLight != null)
                {
                    _frameLight.enabled = _isActive;
                }
            }
        }

        private void UpdateReflectionCamera()
        {
            if (_reflectionCamera == null || _playerTransform == null) return;

            // Position camera to create mirror effect
            Vector3 mirrorNormal = transform.forward;
            Vector3 mirrorPos = transform.position;

            // Get player camera position
            Vector3 cameraPos = Camera.main != null ? Camera.main.transform.position : _playerTransform.position + Vector3.up * 1.6f;

            // Calculate reflected position
            Vector3 toCamera = cameraPos - mirrorPos;
            Vector3 reflected = Vector3.Reflect(toCamera, mirrorNormal);
            _reflectionCamera.transform.position = mirrorPos - reflected.normalized * toCamera.magnitude;

            // Look at mirror center
            _reflectionCamera.transform.LookAt(mirrorPos);

            // Render
            _reflectionCamera.Render();
        }

        private void OnDestroy()
        {
            if (_reflectionTexture != null)
            {
                _reflectionTexture.Release();
                Destroy(_reflectionTexture);
            }
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = Color.cyan;
            Gizmos.DrawWireSphere(transform.position, _activeDistance);
            Gizmos.DrawLine(transform.position, transform.position + transform.forward * 2f);
        }
    }
}
