using System;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace Drift.Verification
{
    public enum VerificationType
    {
        Photo,
        Phone,
        Email,
        ID,
        Social
    }

    public enum VerificationStatus
    {
        None,
        Pending,
        InReview,
        Approved,
        Rejected,
        Expired
    }

    [Serializable]
    public class UserVerificationData
    {
        public string userId;
        public bool photoVerified;
        public bool phoneVerified;
        public bool emailVerified;
        public bool idVerified;
        public bool socialVerified;
        public int trustScore;

        public bool IsVerified => photoVerified;
        public bool IsFullyVerified => photoVerified && emailVerified;
    }

    /// <summary>
    /// Displays verification badges on user profiles and nameplates in VR.
    /// </summary>
    public class VerificationBadge : MonoBehaviour
    {
        [Header("Badge Settings")]
        [SerializeField] private BadgeStyle badgeStyle = BadgeStyle.Icon;
        [SerializeField] private BadgeSize badgeSize = BadgeSize.Medium;
        [SerializeField] private bool showTooltip = true;
        [SerializeField] private bool animateOnHover = true;

        [Header("Verified Badge")]
        [SerializeField] private GameObject verifiedBadge;
        [SerializeField] private Image verifiedIcon;
        [SerializeField] private TMP_Text verifiedLabel;
        [SerializeField] private Color verifiedColor = new Color(0.23f, 0.51f, 0.96f); // Blue

        [Header("Trust Score")]
        [SerializeField] private GameObject trustScoreObject;
        [SerializeField] private TMP_Text trustScoreText;
        [SerializeField] private Image trustScoreRing;

        [Header("Individual Badges")]
        [SerializeField] private GameObject photoBadge;
        [SerializeField] private GameObject phoneBadge;
        [SerializeField] private GameObject emailBadge;
        [SerializeField] private GameObject idBadge;
        [SerializeField] private GameObject socialBadge;

        [Header("Tooltip")]
        [SerializeField] private GameObject tooltipPanel;
        [SerializeField] private TMP_Text tooltipText;

        [Header("Animation")]
        [SerializeField] private float hoverScale = 1.1f;
        [SerializeField] private float animationDuration = 0.2f;

        private UserVerificationData _currentData;
        private Vector3 _originalScale;
        private bool _isHovered;

        public enum BadgeStyle
        {
            Icon,           // Just checkmark icon
            IconWithLabel,  // Icon with "Verified" text
            TrustScore,     // Circular trust score
            Detailed        // Show all verification types
        }

        public enum BadgeSize
        {
            Small,   // For compact UIs
            Medium,  // Default
            Large    // For profile pages
        }

        private void Awake()
        {
            _originalScale = transform.localScale;
            HideAll();
        }

        private void Start()
        {
            if (tooltipPanel != null)
            {
                tooltipPanel.SetActive(false);
            }
        }

        /// <summary>
        /// Updates the badge with user verification data.
        /// </summary>
        public void SetVerificationData(UserVerificationData data)
        {
            _currentData = data;
            UpdateDisplay();
        }

        /// <summary>
        /// Quick method to show verified/unverified state.
        /// </summary>
        public void SetVerified(bool verified, int trustScore = 0)
        {
            _currentData = new UserVerificationData
            {
                photoVerified = verified,
                trustScore = trustScore
            };
            UpdateDisplay();
        }

        private void UpdateDisplay()
        {
            HideAll();

            if (_currentData == null) return;

            switch (badgeStyle)
            {
                case BadgeStyle.Icon:
                    DisplayIconBadge();
                    break;
                case BadgeStyle.IconWithLabel:
                    DisplayIconWithLabel();
                    break;
                case BadgeStyle.TrustScore:
                    DisplayTrustScore();
                    break;
                case BadgeStyle.Detailed:
                    DisplayDetailedBadges();
                    break;
            }

            ApplySize();
        }

        private void DisplayIconBadge()
        {
            if (!_currentData.IsVerified) return;

            if (verifiedBadge != null)
            {
                verifiedBadge.SetActive(true);
                if (verifiedIcon != null)
                {
                    verifiedIcon.color = verifiedColor;
                }
                if (verifiedLabel != null)
                {
                    verifiedLabel.gameObject.SetActive(false);
                }
            }
        }

        private void DisplayIconWithLabel()
        {
            if (!_currentData.IsVerified) return;

            if (verifiedBadge != null)
            {
                verifiedBadge.SetActive(true);
                if (verifiedIcon != null)
                {
                    verifiedIcon.color = verifiedColor;
                }
                if (verifiedLabel != null)
                {
                    verifiedLabel.gameObject.SetActive(true);
                    verifiedLabel.text = "Verified";
                    verifiedLabel.color = verifiedColor;
                }
            }
        }

        private void DisplayTrustScore()
        {
            if (trustScoreObject == null) return;

            trustScoreObject.SetActive(true);

            if (trustScoreText != null)
            {
                trustScoreText.text = _currentData.trustScore.ToString();
            }

            if (trustScoreRing != null)
            {
                trustScoreRing.fillAmount = _currentData.trustScore / 100f;
                trustScoreRing.color = GetTrustScoreColor(_currentData.trustScore);
            }
        }

        private void DisplayDetailedBadges()
        {
            if (photoBadge != null) photoBadge.SetActive(_currentData.photoVerified);
            if (phoneBadge != null) phoneBadge.SetActive(_currentData.phoneVerified);
            if (emailBadge != null) emailBadge.SetActive(_currentData.emailVerified);
            if (idBadge != null) idBadge.SetActive(_currentData.idVerified);
            if (socialBadge != null) socialBadge.SetActive(_currentData.socialVerified);
        }

        private void ApplySize()
        {
            float scale = badgeSize switch
            {
                BadgeSize.Small => 0.7f,
                BadgeSize.Medium => 1f,
                BadgeSize.Large => 1.3f,
                _ => 1f
            };

            transform.localScale = _originalScale * scale;
        }

        private Color GetTrustScoreColor(int score)
        {
            if (score >= 80) return new Color(0.13f, 0.77f, 0.44f); // Green
            if (score >= 50) return new Color(0.95f, 0.62f, 0.07f); // Orange
            return new Color(0.53f, 0.57f, 0.69f); // Gray
        }

        private void HideAll()
        {
            if (verifiedBadge != null) verifiedBadge.SetActive(false);
            if (trustScoreObject != null) trustScoreObject.SetActive(false);
            if (photoBadge != null) photoBadge.SetActive(false);
            if (phoneBadge != null) phoneBadge.SetActive(false);
            if (emailBadge != null) emailBadge.SetActive(false);
            if (idBadge != null) idBadge.SetActive(false);
            if (socialBadge != null) socialBadge.SetActive(false);
        }

        // Hover interactions for VR
        public void OnHoverEnter()
        {
            if (!animateOnHover) return;

            _isHovered = true;
            StopAllCoroutines();
            StartCoroutine(AnimateScale(transform.localScale, _originalScale * hoverScale * GetSizeMultiplier()));

            if (showTooltip && tooltipPanel != null)
            {
                ShowTooltip();
            }
        }

        public void OnHoverExit()
        {
            if (!animateOnHover) return;

            _isHovered = false;
            StopAllCoroutines();
            StartCoroutine(AnimateScale(transform.localScale, _originalScale * GetSizeMultiplier()));

            if (tooltipPanel != null)
            {
                tooltipPanel.SetActive(false);
            }
        }

        private float GetSizeMultiplier()
        {
            return badgeSize switch
            {
                BadgeSize.Small => 0.7f,
                BadgeSize.Medium => 1f,
                BadgeSize.Large => 1.3f,
                _ => 1f
            };
        }

        private System.Collections.IEnumerator AnimateScale(Vector3 from, Vector3 to)
        {
            float elapsed = 0f;
            while (elapsed < animationDuration)
            {
                elapsed += Time.deltaTime;
                transform.localScale = Vector3.Lerp(from, to, elapsed / animationDuration);
                yield return null;
            }
            transform.localScale = to;
        }

        private void ShowTooltip()
        {
            if (tooltipPanel == null || tooltipText == null || _currentData == null) return;

            tooltipPanel.SetActive(true);

            var lines = new System.Collections.Generic.List<string>();

            if (_currentData.photoVerified) lines.Add("✓ Photo Verified");
            if (_currentData.phoneVerified) lines.Add("✓ Phone Verified");
            if (_currentData.emailVerified) lines.Add("✓ Email Verified");
            if (_currentData.idVerified) lines.Add("✓ ID Verified");
            if (_currentData.socialVerified) lines.Add("✓ Social Connected");

            if (lines.Count == 0)
            {
                tooltipText.text = "Not Verified";
            }
            else
            {
                tooltipText.text = string.Join("\n", lines);
                if (_currentData.trustScore > 0)
                {
                    tooltipText.text += $"\n\nTrust Score: {_currentData.trustScore}%";
                }
            }
        }

        // Static factory methods
        public static VerificationBadge CreateSimpleBadge(Transform parent, bool verified)
        {
            var go = new GameObject("VerificationBadge");
            go.transform.SetParent(parent, false);
            var badge = go.AddComponent<VerificationBadge>();
            badge.badgeStyle = BadgeStyle.Icon;
            badge.SetVerified(verified);
            return badge;
        }
    }

    /// <summary>
    /// Manages verification badges on user nameplates in VR.
    /// </summary>
    public class NameplateVerification : MonoBehaviour
    {
        [SerializeField] private VerificationBadge verificationBadge;
        [SerializeField] private TMP_Text usernameText;
        [SerializeField] private Vector3 badgeOffset = new Vector3(0.5f, 0, 0);

        private string _userId;

        public void SetUser(string userId, string username, UserVerificationData verificationData)
        {
            _userId = userId;

            if (usernameText != null)
            {
                usernameText.text = username;
            }

            if (verificationBadge != null)
            {
                verificationBadge.SetVerificationData(verificationData);
            }
        }

        public void UpdateVerification(UserVerificationData data)
        {
            if (verificationBadge != null)
            {
                verificationBadge.SetVerificationData(data);
            }
        }
    }
}
