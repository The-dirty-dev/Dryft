using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace Drift.Tutorial
{
    public enum TutorialStep
    {
        Welcome,
        Movement,
        Teleportation,
        Gestures,
        VoiceChat,
        SafetyFeatures,
        PanicButton,
        Blocking,
        Navigation,
        PrivateBooth,
        Complete
    }

    [Serializable]
    public class TutorialStepData
    {
        public TutorialStep step;
        public string title;
        [TextArea(3, 6)]
        public string description;
        public string[] instructions;
        public float autoAdvanceDelay;
        public bool requiresAction;
        public string actionDescription;
        public Transform focusPoint;
        public AudioClip voiceOver;
    }

    public class TutorialManager : MonoBehaviour
    {
        public static TutorialManager Instance { get; private set; }

        [Header("Tutorial Settings")]
        [SerializeField] private bool autoStartTutorial = true;
        [SerializeField] private float stepTransitionDelay = 0.5f;

        [Header("Tutorial Steps")]
        [SerializeField] private List<TutorialStepData> tutorialSteps = new List<TutorialStepData>();

        [Header("References")]
        [SerializeField] private TutorialUI tutorialUI;
        [SerializeField] private Transform playerRig;
        [SerializeField] private AudioSource audioSource;

        [Header("Events")]
        public UnityEvent<TutorialStep> onStepStarted;
        public UnityEvent<TutorialStep> onStepCompleted;
        public UnityEvent onTutorialCompleted;
        public UnityEvent onTutorialSkipped;

        private TutorialStep currentStep = TutorialStep.Welcome;
        private bool isTutorialActive;
        private bool isStepInProgress;
        private Dictionary<TutorialStep, TutorialStepData> stepDataMap;
        private Coroutine autoAdvanceCoroutine;

        private const string TUTORIAL_COMPLETED_KEY = "drift_tutorial_completed";

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            InitializeStepDataMap();
        }

        private void Start()
        {
            if (autoStartTutorial && !HasCompletedTutorial())
            {
                StartTutorial();
            }
        }

        private void InitializeStepDataMap()
        {
            stepDataMap = new Dictionary<TutorialStep, TutorialStepData>();
            foreach (var step in tutorialSteps)
            {
                stepDataMap[step.step] = step;
            }

            // Initialize default steps if not configured
            if (tutorialSteps.Count == 0)
            {
                CreateDefaultSteps();
            }
        }

        private void CreateDefaultSteps()
        {
            tutorialSteps = new List<TutorialStepData>
            {
                new TutorialStepData
                {
                    step = TutorialStep.Welcome,
                    title = "Welcome to Drift",
                    description = "Welcome to the Drift VR experience! Let's get you familiar with the virtual world.",
                    instructions = new[] { "Look around to explore", "You're in the tutorial space" },
                    autoAdvanceDelay = 5f,
                    requiresAction = false
                },
                new TutorialStepData
                {
                    step = TutorialStep.Movement,
                    title = "Movement",
                    description = "Use the left thumbstick to move around the space.",
                    instructions = new[] { "Push the left thumbstick forward to walk", "Move in any direction" },
                    requiresAction = true,
                    actionDescription = "Move forward to continue"
                },
                new TutorialStepData
                {
                    step = TutorialStep.Teleportation,
                    title = "Teleportation",
                    description = "For longer distances, use teleportation.",
                    instructions = new[] { "Hold the right thumbstick forward", "Aim at the floor where you want to go", "Release to teleport" },
                    requiresAction = true,
                    actionDescription = "Teleport to the marker"
                },
                new TutorialStepData
                {
                    step = TutorialStep.Gestures,
                    title = "Gestures & Expressions",
                    description = "Express yourself with gestures and hand movements.",
                    instructions = new[] { "Wave your hand to say hello", "Give a thumbs up to show you like something", "Point to direct attention" },
                    requiresAction = true,
                    actionDescription = "Wave to continue"
                },
                new TutorialStepData
                {
                    step = TutorialStep.VoiceChat,
                    title = "Voice Chat",
                    description = "Talk to others using your voice.",
                    instructions = new[] { "Your microphone is always on by default", "Press the mute button on your wrist to mute", "Spatial audio means voices sound like real life" },
                    autoAdvanceDelay = 6f,
                    requiresAction = false
                },
                new TutorialStepData
                {
                    step = TutorialStep.SafetyFeatures,
                    title = "Your Safety",
                    description = "Your safety is our top priority. Here are tools to keep you comfortable.",
                    instructions = new[] { "Block anyone instantly", "Report inappropriate behavior", "Leave any situation immediately" },
                    autoAdvanceDelay = 5f,
                    requiresAction = false
                },
                new TutorialStepData
                {
                    step = TutorialStep.PanicButton,
                    title = "Panic Button",
                    description = "The panic button instantly removes you from any situation.",
                    instructions = new[] { "Look at your left wrist", "Press the red button to activate", "You'll be taken to a safe space immediately" },
                    requiresAction = true,
                    actionDescription = "Try the panic button (don't worry, it's safe in tutorial)"
                },
                new TutorialStepData
                {
                    step = TutorialStep.Blocking,
                    title = "Blocking Users",
                    description = "You can block anyone at any time.",
                    instructions = new[] { "Open the menu with the menu button", "Select a user's name", "Choose 'Block' to never see them again" },
                    autoAdvanceDelay = 5f,
                    requiresAction = false
                },
                new TutorialStepData
                {
                    step = TutorialStep.Navigation,
                    title = "Navigation",
                    description = "Learn how to navigate the Drift world.",
                    instructions = new[] { "The Lounge is where you meet new people", "Private Booths are for one-on-one conversations", "Use the menu to see your matches and messages" },
                    autoAdvanceDelay = 6f,
                    requiresAction = false
                },
                new TutorialStepData
                {
                    step = TutorialStep.PrivateBooth,
                    title = "Private Booths",
                    description = "Private booths are spaces for intimate conversations.",
                    instructions = new[] { "Invite a match to a private booth", "Only you and your guest can enter", "All safety features still work here" },
                    autoAdvanceDelay = 5f,
                    requiresAction = false
                },
                new TutorialStepData
                {
                    step = TutorialStep.Complete,
                    title = "You're Ready!",
                    description = "You've completed the tutorial. Time to start your Drift journey!",
                    instructions = new[] { "Head to the Lounge to meet people", "Have fun and stay safe", "Remember: consent and respect are mandatory" },
                    autoAdvanceDelay = 5f,
                    requiresAction = false
                }
            };

            foreach (var step in tutorialSteps)
            {
                stepDataMap[step.step] = step;
            }
        }

        public void StartTutorial()
        {
            if (isTutorialActive) return;

            isTutorialActive = true;
            currentStep = TutorialStep.Welcome;

            tutorialUI?.Show();
            StartStep(currentStep);
        }

        public void SkipTutorial()
        {
            if (!isTutorialActive) return;

            StopAllCoroutines();
            isTutorialActive = false;
            isStepInProgress = false;

            MarkTutorialCompleted();
            tutorialUI?.Hide();
            onTutorialSkipped?.Invoke();
        }

        private void StartStep(TutorialStep step)
        {
            if (!stepDataMap.TryGetValue(step, out var stepData))
            {
                Debug.LogError($"Tutorial step data not found for: {step}");
                AdvanceToNextStep();
                return;
            }

            currentStep = step;
            isStepInProgress = true;

            tutorialUI?.ShowStep(stepData);
            onStepStarted?.Invoke(step);

            // Play voice over if available
            if (stepData.voiceOver != null && audioSource != null)
            {
                audioSource.clip = stepData.voiceOver;
                audioSource.Play();
            }

            // Focus on point if specified
            if (stepData.focusPoint != null)
            {
                StartCoroutine(FocusOnPoint(stepData.focusPoint));
            }

            // Auto advance if no action required
            if (!stepData.requiresAction && stepData.autoAdvanceDelay > 0)
            {
                autoAdvanceCoroutine = StartCoroutine(AutoAdvanceAfterDelay(stepData.autoAdvanceDelay));
            }
        }

        private IEnumerator AutoAdvanceAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            CompleteCurrentStep();
        }

        public void CompleteCurrentStep()
        {
            if (!isStepInProgress) return;

            if (autoAdvanceCoroutine != null)
            {
                StopCoroutine(autoAdvanceCoroutine);
                autoAdvanceCoroutine = null;
            }

            isStepInProgress = false;
            onStepCompleted?.Invoke(currentStep);

            StartCoroutine(TransitionToNextStep());
        }

        private IEnumerator TransitionToNextStep()
        {
            yield return new WaitForSeconds(stepTransitionDelay);
            AdvanceToNextStep();
        }

        private void AdvanceToNextStep()
        {
            var nextStep = GetNextStep(currentStep);

            if (nextStep == TutorialStep.Complete && currentStep == TutorialStep.Complete)
            {
                CompleteTutorial();
            }
            else
            {
                StartStep(nextStep);
            }
        }

        private TutorialStep GetNextStep(TutorialStep current)
        {
            return current switch
            {
                TutorialStep.Welcome => TutorialStep.Movement,
                TutorialStep.Movement => TutorialStep.Teleportation,
                TutorialStep.Teleportation => TutorialStep.Gestures,
                TutorialStep.Gestures => TutorialStep.VoiceChat,
                TutorialStep.VoiceChat => TutorialStep.SafetyFeatures,
                TutorialStep.SafetyFeatures => TutorialStep.PanicButton,
                TutorialStep.PanicButton => TutorialStep.Blocking,
                TutorialStep.Blocking => TutorialStep.Navigation,
                TutorialStep.Navigation => TutorialStep.PrivateBooth,
                TutorialStep.PrivateBooth => TutorialStep.Complete,
                TutorialStep.Complete => TutorialStep.Complete,
                _ => TutorialStep.Complete
            };
        }

        private void CompleteTutorial()
        {
            isTutorialActive = false;
            isStepInProgress = false;

            MarkTutorialCompleted();
            tutorialUI?.Hide();
            onTutorialCompleted?.Invoke();

            Debug.Log("Tutorial completed!");
        }

        private IEnumerator FocusOnPoint(Transform point)
        {
            // Smoothly rotate player to look at the focus point
            if (playerRig == null) yield break;

            var targetRotation = Quaternion.LookRotation(point.position - playerRig.position);
            var startRotation = playerRig.rotation;
            var duration = 0.5f;
            var elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                playerRig.rotation = Quaternion.Slerp(startRotation, targetRotation, elapsed / duration);
                yield return null;
            }
        }

        // Action handlers for tutorial steps
        public void OnPlayerMoved()
        {
            if (currentStep == TutorialStep.Movement && isStepInProgress)
            {
                CompleteCurrentStep();
            }
        }

        public void OnPlayerTeleported()
        {
            if (currentStep == TutorialStep.Teleportation && isStepInProgress)
            {
                CompleteCurrentStep();
            }
        }

        public void OnGesturePerformed(string gesture)
        {
            if (currentStep == TutorialStep.Gestures && isStepInProgress)
            {
                if (gesture.ToLower() == "wave")
                {
                    CompleteCurrentStep();
                }
            }
        }

        public void OnPanicButtonPressed()
        {
            if (currentStep == TutorialStep.PanicButton && isStepInProgress)
            {
                CompleteCurrentStep();
            }
        }

        // Persistence
        public bool HasCompletedTutorial()
        {
            return PlayerPrefs.GetInt(TUTORIAL_COMPLETED_KEY, 0) == 1;
        }

        private void MarkTutorialCompleted()
        {
            PlayerPrefs.SetInt(TUTORIAL_COMPLETED_KEY, 1);
            PlayerPrefs.Save();
        }

        public void ResetTutorial()
        {
            PlayerPrefs.DeleteKey(TUTORIAL_COMPLETED_KEY);
            PlayerPrefs.Save();
            currentStep = TutorialStep.Welcome;
        }

        // Public getters
        public TutorialStep CurrentStep => currentStep;
        public bool IsTutorialActive => isTutorialActive;
        public float GetProgress()
        {
            var totalSteps = Enum.GetValues(typeof(TutorialStep)).Length;
            var currentIndex = (int)currentStep;
            return (float)currentIndex / (totalSteps - 1);
        }
    }
}
