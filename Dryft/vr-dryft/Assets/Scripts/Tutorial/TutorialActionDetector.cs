using UnityEngine;
using UnityEngine.XR;
using System.Collections.Generic;

namespace Drift.Tutorial
{
    public class TutorialActionDetector : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Transform playerRig;
        [SerializeField] private Transform leftHand;
        [SerializeField] private Transform rightHand;

        [Header("Movement Detection")]
        [SerializeField] private float movementThreshold = 0.5f;
        [SerializeField] private float teleportThreshold = 2f;

        [Header("Gesture Detection")]
        [SerializeField] private float waveSpeed = 2f;
        [SerializeField] private float waveAmplitude = 0.1f;
        [SerializeField] private float thumbsUpAngle = 45f;

        private Vector3 lastPosition;
        private Vector3 lastLeftHandPosition;
        private Vector3 lastRightHandPosition;
        private float waveStartTime;
        private int waveCount;
        private bool isDetectingWave;

        private List<InputDevice> leftHandDevices = new List<InputDevice>();
        private List<InputDevice> rightHandDevices = new List<InputDevice>();

        private void Start()
        {
            if (playerRig != null)
            {
                lastPosition = playerRig.position;
            }

            if (leftHand != null)
            {
                lastLeftHandPosition = leftHand.position;
            }

            if (rightHand != null)
            {
                lastRightHandPosition = rightHand.position;
            }
        }

        private void Update()
        {
            if (TutorialManager.Instance == null || !TutorialManager.Instance.IsTutorialActive)
                return;

            var currentStep = TutorialManager.Instance.CurrentStep;

            switch (currentStep)
            {
                case TutorialStep.Movement:
                    DetectMovement();
                    break;
                case TutorialStep.Teleportation:
                    DetectTeleportation();
                    break;
                case TutorialStep.Gestures:
                    DetectGestures();
                    break;
                case TutorialStep.PanicButton:
                    DetectPanicButton();
                    break;
            }

            UpdateLastPositions();
        }

        private void DetectMovement()
        {
            if (playerRig == null) return;

            var movement = Vector3.Distance(playerRig.position, lastPosition);
            if (movement >= movementThreshold)
            {
                TutorialManager.Instance.OnPlayerMoved();
            }
        }

        private void DetectTeleportation()
        {
            if (playerRig == null) return;

            var distance = Vector3.Distance(playerRig.position, lastPosition);
            if (distance >= teleportThreshold)
            {
                TutorialManager.Instance.OnPlayerTeleported();
            }
        }

        private void DetectGestures()
        {
            DetectWaveGesture();
        }

        private void DetectWaveGesture()
        {
            if (rightHand == null) return;

            var handVelocity = (rightHand.position - lastRightHandPosition) / Time.deltaTime;
            var horizontalSpeed = Mathf.Abs(handVelocity.x);

            // Check if hand is above shoulder height and moving side to side
            if (rightHand.position.y > (playerRig != null ? playerRig.position.y + 1.2f : 1.2f))
            {
                if (horizontalSpeed > waveSpeed)
                {
                    if (!isDetectingWave)
                    {
                        isDetectingWave = true;
                        waveStartTime = Time.time;
                        waveCount = 0;
                    }

                    // Detect direction changes
                    var lastDirection = Mathf.Sign(lastRightHandPosition.x - rightHand.position.x);
                    var currentDirection = Mathf.Sign(handVelocity.x);

                    if (lastDirection != currentDirection && Mathf.Abs(lastDirection) > 0.1f)
                    {
                        waveCount++;
                    }

                    // Complete wave gesture after 3 back-and-forth motions
                    if (waveCount >= 3 && Time.time - waveStartTime < 2f)
                    {
                        TutorialManager.Instance.OnGesturePerformed("wave");
                        isDetectingWave = false;
                        waveCount = 0;
                    }
                }
            }
            else
            {
                // Reset if hand drops below threshold
                if (isDetectingWave && Time.time - waveStartTime > 1f)
                {
                    isDetectingWave = false;
                    waveCount = 0;
                }
            }
        }

        private void DetectPanicButton()
        {
            // Check for grip button held on left controller
            InputDevices.GetDevicesAtXRNode(XRNode.LeftHand, leftHandDevices);

            foreach (var device in leftHandDevices)
            {
                if (device.TryGetFeatureValue(CommonUsages.gripButton, out bool gripPressed) && gripPressed)
                {
                    if (device.TryGetFeatureValue(CommonUsages.primaryButton, out bool primaryPressed) && primaryPressed)
                    {
                        // Both grip and primary button pressed = panic button combo
                        TutorialManager.Instance.OnPanicButtonPressed();
                    }
                }
            }
        }

        private void UpdateLastPositions()
        {
            if (playerRig != null)
            {
                lastPosition = playerRig.position;
            }

            if (leftHand != null)
            {
                lastLeftHandPosition = leftHand.position;
            }

            if (rightHand != null)
            {
                lastRightHandPosition = rightHand.position;
            }
        }

        // Called by external systems when panic button is activated through UI
        public void NotifyPanicButtonPressed()
        {
            if (TutorialManager.Instance != null &&
                TutorialManager.Instance.CurrentStep == TutorialStep.PanicButton)
            {
                TutorialManager.Instance.OnPanicButtonPressed();
            }
        }
    }
}
