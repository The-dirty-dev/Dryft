using UnityEngine;
using TMPro;

namespace Drift.Localization
{
    [RequireComponent(typeof(TextMeshProUGUI))]
    public class LocalizedText : MonoBehaviour
    {
        [SerializeField] private string localizationKey;
        [SerializeField] private bool updateOnLanguageChange = true;

        private TextMeshProUGUI _textComponent;

        private void Awake()
        {
            _textComponent = GetComponent<TextMeshProUGUI>();
        }

        private void Start()
        {
            UpdateText();

            if (updateOnLanguageChange && LocalizationManager.Instance != null)
            {
                LocalizationManager.Instance.onLanguageChanged.AddListener(OnLanguageChanged);
            }
        }

        private void OnDestroy()
        {
            if (LocalizationManager.Instance != null)
            {
                LocalizationManager.Instance.onLanguageChanged.RemoveListener(OnLanguageChanged);
            }
        }

        private void OnLanguageChanged(Language newLanguage)
        {
            UpdateText();
        }

        public void UpdateText()
        {
            if (_textComponent != null && !string.IsNullOrEmpty(localizationKey))
            {
                _textComponent.text = L.Get(localizationKey);
            }
        }

        public void SetKey(string key)
        {
            localizationKey = key;
            UpdateText();
        }

        public void SetTextWithParams(string key, params object[] args)
        {
            localizationKey = key;
            if (_textComponent != null)
            {
                _textComponent.text = L.Get(key, args);
            }
        }
    }

    // For world space text in VR
    [RequireComponent(typeof(TextMeshPro))]
    public class LocalizedText3D : MonoBehaviour
    {
        [SerializeField] private string localizationKey;
        [SerializeField] private bool updateOnLanguageChange = true;

        private TextMeshPro _textComponent;

        private void Awake()
        {
            _textComponent = GetComponent<TextMeshPro>();
        }

        private void Start()
        {
            UpdateText();

            if (updateOnLanguageChange && LocalizationManager.Instance != null)
            {
                LocalizationManager.Instance.onLanguageChanged.AddListener(OnLanguageChanged);
            }
        }

        private void OnDestroy()
        {
            if (LocalizationManager.Instance != null)
            {
                LocalizationManager.Instance.onLanguageChanged.RemoveListener(OnLanguageChanged);
            }
        }

        private void OnLanguageChanged(Language newLanguage)
        {
            UpdateText();
        }

        public void UpdateText()
        {
            if (_textComponent != null && !string.IsNullOrEmpty(localizationKey))
            {
                _textComponent.text = L.Get(localizationKey);
            }
        }

        public void SetKey(string key)
        {
            localizationKey = key;
            UpdateText();
        }
    }

    // For UI buttons with localized text
    public class LocalizedButton : MonoBehaviour
    {
        [SerializeField] private string localizationKey;
        [SerializeField] private TextMeshProUGUI buttonText;

        private void Start()
        {
            if (buttonText == null)
            {
                buttonText = GetComponentInChildren<TextMeshProUGUI>();
            }

            UpdateText();

            if (LocalizationManager.Instance != null)
            {
                LocalizationManager.Instance.onLanguageChanged.AddListener(OnLanguageChanged);
            }
        }

        private void OnDestroy()
        {
            if (LocalizationManager.Instance != null)
            {
                LocalizationManager.Instance.onLanguageChanged.RemoveListener(OnLanguageChanged);
            }
        }

        private void OnLanguageChanged(Language newLanguage)
        {
            UpdateText();
        }

        private void UpdateText()
        {
            if (buttonText != null && !string.IsNullOrEmpty(localizationKey))
            {
                buttonText.text = L.Get(localizationKey);
            }
        }
    }

    // For dropdown options
    public class LocalizedDropdown : MonoBehaviour
    {
        [SerializeField] private TMP_Dropdown dropdown;
        [SerializeField] private string[] optionKeys;

        private void Start()
        {
            if (dropdown == null)
            {
                dropdown = GetComponent<TMP_Dropdown>();
            }

            UpdateOptions();

            if (LocalizationManager.Instance != null)
            {
                LocalizationManager.Instance.onLanguageChanged.AddListener(OnLanguageChanged);
            }
        }

        private void OnDestroy()
        {
            if (LocalizationManager.Instance != null)
            {
                LocalizationManager.Instance.onLanguageChanged.RemoveListener(OnLanguageChanged);
            }
        }

        private void OnLanguageChanged(Language newLanguage)
        {
            UpdateOptions();
        }

        private void UpdateOptions()
        {
            if (dropdown == null || optionKeys == null) return;

            var currentValue = dropdown.value;
            dropdown.ClearOptions();

            var options = new System.Collections.Generic.List<string>();
            foreach (var key in optionKeys)
            {
                options.Add(L.Get(key));
            }

            dropdown.AddOptions(options);
            dropdown.value = currentValue;
        }
    }
}
