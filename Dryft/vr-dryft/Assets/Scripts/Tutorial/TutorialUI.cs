using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace Drift.Tutorial
{
    public class TutorialUI : MonoBehaviour
    {
        [Header("UI References")]
        [SerializeField] private Canvas tutorialCanvas;
        [SerializeField] private CanvasGroup canvasGroup;
        [SerializeField] private GameObject tutorialPanel;

        [Header("Content")]
        [SerializeField] private TextMeshProUGUI titleText;
        [SerializeField] private TextMeshProUGUI descriptionText;
        [SerializeField] private Transform instructionsContainer;
        [SerializeField] private GameObject instructionPrefab;
        [SerializeField] private TextMeshProUGUI actionText;
        [SerializeField] private GameObject actionIndicator;

        [Header("Progress")]
        [SerializeField] private Slider progressSlider;
        [SerializeField] private TextMeshProUGUI progressText;
        [SerializeField] private Transform stepIndicatorContainer;
        [SerializeField] private GameObject stepIndicatorPrefab;

        [Header("Buttons")]
        [SerializeField] private Button continueButton;
        [SerializeField] private Button skipButton;
        [SerializeField] private TextMeshProUGUI continueButtonText;

        [Header("Animation")]
        [SerializeField] private float fadeInDuration = 0.3f;
        [SerializeField] private float fadeOutDuration = 0.2f;
        [SerializeField] private AnimationCurve fadeCurve = AnimationCurve.EaseInOut(0, 0, 1, 1);

        [Header("Positioning")]
        [SerializeField] private Transform followTarget;
        [SerializeField] private float followDistance = 2f;
        [SerializeField] private float followHeight = 0f;
        [SerializeField] private float followSmoothness = 5f;

        private TutorialStepData currentStepData;
        private bool isVisible;
        private Coroutine followCoroutine;

        private void Awake()
        {
            if (canvasGroup == null)
            {
                canvasGroup = tutorialPanel.GetComponent<CanvasGroup>();
                if (canvasGroup == null)
                {
                    canvasGroup = tutorialPanel.AddComponent<CanvasGroup>();
                }
            }

            SetupButtons();
        }

        private void SetupButtons()
        {
            if (continueButton != null)
            {
                continueButton.onClick.AddListener(OnContinueClicked);
            }

            if (skipButton != null)
            {
                skipButton.onClick.AddListener(OnSkipClicked);
            }
        }

        public void Show()
        {
            isVisible = true;
            tutorialCanvas.gameObject.SetActive(true);
            StartCoroutine(FadeIn());

            if (followTarget != null)
            {
                followCoroutine = StartCoroutine(FollowTarget());
            }
        }

        public void Hide()
        {
            isVisible = false;
            StartCoroutine(FadeOutAndDisable());

            if (followCoroutine != null)
            {
                StopCoroutine(followCoroutine);
                followCoroutine = null;
            }
        }

        public void ShowStep(TutorialStepData stepData)
        {
            currentStepData = stepData;
            UpdateUI();
            StartCoroutine(AnimateStepTransition());
        }

        private void UpdateUI()
        {
            if (currentStepData == null) return;

            // Update text content
            if (titleText != null)
            {
                titleText.text = currentStepData.title;
            }

            if (descriptionText != null)
            {
                descriptionText.text = currentStepData.description;
            }

            // Update instructions
            UpdateInstructions();

            // Update action text
            if (actionText != null)
            {
                actionText.gameObject.SetActive(currentStepData.requiresAction);
                actionText.text = currentStepData.actionDescription;
            }

            if (actionIndicator != null)
            {
                actionIndicator.SetActive(currentStepData.requiresAction);
            }

            // Update continue button
            if (continueButton != null)
            {
                continueButton.gameObject.SetActive(!currentStepData.requiresAction);
            }

            if (continueButtonText != null)
            {
                continueButtonText.text = currentStepData.step == TutorialStep.Complete ? "Start Exploring" : "Continue";
            }

            // Update progress
            UpdateProgress();
        }

        private void UpdateInstructions()
        {
            if (instructionsContainer == null || instructionPrefab == null) return;

            // Clear existing instructions
            foreach (Transform child in instructionsContainer)
            {
                Destroy(child.gameObject);
            }

            // Create new instructions
            if (currentStepData.instructions != null)
            {
                foreach (var instruction in currentStepData.instructions)
                {
                    var instructionObj = Instantiate(instructionPrefab, instructionsContainer);
                    var text = instructionObj.GetComponentInChildren<TextMeshProUGUI>();
                    if (text != null)
                    {
                        text.text = $"• {instruction}";
                    }
                }
            }
        }

        private void UpdateProgress()
        {
            if (TutorialManager.Instance == null) return;

            var progress = TutorialManager.Instance.GetProgress();

            if (progressSlider != null)
            {
                progressSlider.value = progress;
            }

            if (progressText != null)
            {
                var currentIndex = (int)currentStepData.step + 1;
                var totalSteps = System.Enum.GetValues(typeof(TutorialStep)).Length;
                progressText.text = $"{currentIndex}/{totalSteps}";
            }

            UpdateStepIndicators();
        }

        private void UpdateStepIndicators()
        {
            if (stepIndicatorContainer == null || stepIndicatorPrefab == null) return;

            // Clear existing indicators
            foreach (Transform child in stepIndicatorContainer)
            {
                Destroy(child.gameObject);
            }

            // Create indicators for each step
            var steps = System.Enum.GetValues(typeof(TutorialStep));
            foreach (TutorialStep step in steps)
            {
                var indicator = Instantiate(stepIndicatorPrefab, stepIndicatorContainer);
                var image = indicator.GetComponent<Image>();
                if (image != null)
                {
                    if ((int)step < (int)currentStepData.step)
                    {
                        // Completed
                        image.color = new Color(0.18f, 0.8f, 0.44f, 1f); // Green
                    }
                    else if (step == currentStepData.step)
                    {
                        // Current
                        image.color = new Color(0.91f, 0.27f, 0.38f, 1f); // Pink
                    }
                    else
                    {
                        // Upcoming
                        image.color = new Color(1f, 1f, 1f, 0.3f); // Gray
                    }
                }
            }
        }

        private IEnumerator AnimateStepTransition()
        {
            // Quick fade out
            var elapsed = 0f;
            var startAlpha = canvasGroup.alpha;

            while (elapsed < 0.15f)
            {
                elapsed += Time.deltaTime;
                canvasGroup.alpha = Mathf.Lerp(startAlpha, 0.5f, elapsed / 0.15f);
                yield return null;
            }

            // Fade back in
            elapsed = 0f;
            while (elapsed < 0.15f)
            {
                elapsed += Time.deltaTime;
                canvasGroup.alpha = Mathf.Lerp(0.5f, 1f, elapsed / 0.15f);
                yield return null;
            }

            canvasGroup.alpha = 1f;
        }

        private IEnumerator FadeIn()
        {
            canvasGroup.alpha = 0f;
            var elapsed = 0f;

            while (elapsed < fadeInDuration)
            {
                elapsed += Time.deltaTime;
                canvasGroup.alpha = fadeCurve.Evaluate(elapsed / fadeInDuration);
                yield return null;
            }

            canvasGroup.alpha = 1f;
        }

        private IEnumerator FadeOutAndDisable()
        {
            var startAlpha = canvasGroup.alpha;
            var elapsed = 0f;

            while (elapsed < fadeOutDuration)
            {
                elapsed += Time.deltaTime;
                canvasGroup.alpha = Mathf.Lerp(startAlpha, 0f, elapsed / fadeOutDuration);
                yield return null;
            }

            canvasGroup.alpha = 0f;
            tutorialCanvas.gameObject.SetActive(false);
        }

        private IEnumerator FollowTarget()
        {
            while (isVisible && followTarget != null)
            {
                // Calculate target position in front of the user
                var targetPosition = followTarget.position +
                    followTarget.forward * followDistance +
                    Vector3.up * followHeight;

                // Smoothly move towards target position
                transform.position = Vector3.Lerp(
                    transform.position,
                    targetPosition,
                    Time.deltaTime * followSmoothness
                );

                // Face the user
                var lookDirection = followTarget.position - transform.position;
                lookDirection.y = 0; // Keep horizontal
                if (lookDirection.magnitude > 0.01f)
                {
                    var targetRotation = Quaternion.LookRotation(-lookDirection);
                    transform.rotation = Quaternion.Slerp(
                        transform.rotation,
                        targetRotation,
                        Time.deltaTime * followSmoothness
                    );
                }

                yield return null;
            }
        }

        private void OnContinueClicked()
        {
            TutorialManager.Instance?.CompleteCurrentStep();
        }

        private void OnSkipClicked()
        {
            TutorialManager.Instance?.SkipTutorial();
        }

        public void SetFollowTarget(Transform target)
        {
            followTarget = target;
        }
    }
}
