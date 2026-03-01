using System.Collections;
using UnityEngine;

namespace Drift.Tutorial
{
    public class TutorialHighlight : MonoBehaviour
    {
        [Header("Highlight Settings")]
        [SerializeField] private Color highlightColor = new Color(0.91f, 0.27f, 0.38f, 1f);
        [SerializeField] private float pulseSpeed = 2f;
        [SerializeField] private float pulseMin = 0.5f;
        [SerializeField] private float pulseMax = 1f;
        [SerializeField] private bool autoStart = false;

        [Header("Arrow Indicator")]
        [SerializeField] private GameObject arrowPrefab;
        [SerializeField] private Vector3 arrowOffset = new Vector3(0, 1f, 0);
        [SerializeField] private float arrowBobSpeed = 2f;
        [SerializeField] private float arrowBobAmount = 0.2f;

        [Header("Ring Indicator")]
        [SerializeField] private GameObject ringPrefab;
        [SerializeField] private float ringScale = 1.5f;
        [SerializeField] private float ringRotationSpeed = 30f;

        private Renderer[] renderers;
        private Material[] originalMaterials;
        private Material highlightMaterial;
        private GameObject arrowInstance;
        private GameObject ringInstance;
        private bool isHighlighted;
        private Coroutine pulseCoroutine;

        private void Awake()
        {
            renderers = GetComponentsInChildren<Renderer>();
            SaveOriginalMaterials();
            CreateHighlightMaterial();
        }

        private void Start()
        {
            if (autoStart)
            {
                Highlight();
            }
        }

        private void SaveOriginalMaterials()
        {
            originalMaterials = new Material[renderers.Length];
            for (int i = 0; i < renderers.Length; i++)
            {
                if (renderers[i].material != null)
                {
                    originalMaterials[i] = new Material(renderers[i].material);
                }
            }
        }

        private void CreateHighlightMaterial()
        {
            highlightMaterial = new Material(Shader.Find("Standard"));
            highlightMaterial.color = highlightColor;
            highlightMaterial.EnableKeyword("_EMISSION");
            highlightMaterial.SetColor("_EmissionColor", highlightColor * 0.5f);
        }

        public void Highlight()
        {
            if (isHighlighted) return;

            isHighlighted = true;
            pulseCoroutine = StartCoroutine(PulseEffect());
            CreateIndicators();
        }

        public void StopHighlight()
        {
            if (!isHighlighted) return;

            isHighlighted = false;

            if (pulseCoroutine != null)
            {
                StopCoroutine(pulseCoroutine);
                pulseCoroutine = null;
            }

            RestoreOriginalMaterials();
            DestroyIndicators();
        }

        private IEnumerator PulseEffect()
        {
            while (isHighlighted)
            {
                var t = (Mathf.Sin(Time.time * pulseSpeed) + 1f) / 2f;
                var intensity = Mathf.Lerp(pulseMin, pulseMax, t);

                foreach (var renderer in renderers)
                {
                    if (renderer != null && renderer.material != null)
                    {
                        var emissionColor = highlightColor * intensity;
                        renderer.material.SetColor("_EmissionColor", emissionColor);
                    }
                }

                yield return null;
            }
        }

        private void RestoreOriginalMaterials()
        {
            for (int i = 0; i < renderers.Length; i++)
            {
                if (renderers[i] != null && originalMaterials[i] != null)
                {
                    renderers[i].material = originalMaterials[i];
                }
            }
        }

        private void CreateIndicators()
        {
            // Create arrow pointing down at the object
            if (arrowPrefab != null)
            {
                arrowInstance = Instantiate(arrowPrefab, transform);
                arrowInstance.transform.localPosition = arrowOffset;
                StartCoroutine(AnimateArrow());
            }

            // Create ring around the object
            if (ringPrefab != null)
            {
                ringInstance = Instantiate(ringPrefab, transform);
                ringInstance.transform.localPosition = Vector3.zero;
                ringInstance.transform.localScale = Vector3.one * ringScale;
                StartCoroutine(AnimateRing());
            }
        }

        private void DestroyIndicators()
        {
            if (arrowInstance != null)
            {
                Destroy(arrowInstance);
                arrowInstance = null;
            }

            if (ringInstance != null)
            {
                Destroy(ringInstance);
                ringInstance = null;
            }
        }

        private IEnumerator AnimateArrow()
        {
            var basePos = arrowOffset;

            while (isHighlighted && arrowInstance != null)
            {
                var bob = Mathf.Sin(Time.time * arrowBobSpeed) * arrowBobAmount;
                arrowInstance.transform.localPosition = basePos + Vector3.up * bob;
                yield return null;
            }
        }

        private IEnumerator AnimateRing()
        {
            while (isHighlighted && ringInstance != null)
            {
                ringInstance.transform.Rotate(Vector3.up, ringRotationSpeed * Time.deltaTime);
                yield return null;
            }
        }

        private void OnDestroy()
        {
            StopHighlight();

            if (highlightMaterial != null)
            {
                Destroy(highlightMaterial);
            }
        }
    }

    // Teleport target marker for tutorial
    public class TutorialTeleportTarget : MonoBehaviour
    {
        [SerializeField] private TutorialHighlight highlight;
        [SerializeField] private float activationRadius = 0.5f;

        private bool hasBeenReached;

        private void Awake()
        {
            if (highlight == null)
            {
                highlight = GetComponent<TutorialHighlight>();
            }
        }

        private void Start()
        {
            highlight?.Highlight();
        }

        public void CheckPlayerReached(Vector3 playerPosition)
        {
            if (hasBeenReached) return;

            var distance = Vector3.Distance(
                new Vector3(transform.position.x, 0, transform.position.z),
                new Vector3(playerPosition.x, 0, playerPosition.z)
            );

            if (distance <= activationRadius)
            {
                hasBeenReached = true;
                highlight?.StopHighlight();
                TutorialManager.Instance?.OnPlayerTeleported();
            }
        }

        public void Reset()
        {
            hasBeenReached = false;
            highlight?.Highlight();
        }
    }
}
