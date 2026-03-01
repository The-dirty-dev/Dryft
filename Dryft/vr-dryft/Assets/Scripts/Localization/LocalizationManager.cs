using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Events;

namespace Drift.Localization
{
    public enum Language
    {
        English,
        Spanish,
        French,
        German,
        Japanese,
        Portuguese
    }

    [Serializable]
    public class LocalizationData
    {
        public List<LocalizationEntry> entries = new List<LocalizationEntry>();
    }

    [Serializable]
    public class LocalizationEntry
    {
        public string key;
        public string value;
    }

    public class LocalizationManager : MonoBehaviour
    {
        public static LocalizationManager Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private Language defaultLanguage = Language.English;
        [SerializeField] private bool useSystemLanguage = true;

        [Header("Events")]
        public UnityEvent<Language> onLanguageChanged;

        private Language _currentLanguage;
        private Dictionary<string, string> _localizedStrings = new Dictionary<string, string>();
        private Dictionary<Language, string> _languageCodes = new Dictionary<Language, string>
        {
            { Language.English, "en" },
            { Language.Spanish, "es" },
            { Language.French, "fr" },
            { Language.German, "de" },
            { Language.Japanese, "ja" },
            { Language.Portuguese, "pt" }
        };

        private const string LANGUAGE_PREF_KEY = "drift_language";

        public Language CurrentLanguage => _currentLanguage;
        public string CurrentLanguageCode => _languageCodes[_currentLanguage];

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            Initialize();
        }

        private void Initialize()
        {
            // Check saved preference
            if (PlayerPrefs.HasKey(LANGUAGE_PREF_KEY))
            {
                var savedLang = PlayerPrefs.GetInt(LANGUAGE_PREF_KEY);
                _currentLanguage = (Language)savedLang;
            }
            else if (useSystemLanguage)
            {
                _currentLanguage = DetectSystemLanguage();
            }
            else
            {
                _currentLanguage = defaultLanguage;
            }

            LoadLanguage(_currentLanguage);
        }

        private Language DetectSystemLanguage()
        {
            var systemLang = Application.systemLanguage;

            return systemLang switch
            {
                SystemLanguage.Spanish => Language.Spanish,
                SystemLanguage.French => Language.French,
                SystemLanguage.German => Language.German,
                SystemLanguage.Japanese => Language.Japanese,
                SystemLanguage.Portuguese => Language.Portuguese,
                _ => Language.English
            };
        }

        public void SetLanguage(Language language)
        {
            if (_currentLanguage == language) return;

            _currentLanguage = language;
            PlayerPrefs.SetInt(LANGUAGE_PREF_KEY, (int)language);
            PlayerPrefs.Save();

            LoadLanguage(language);
            onLanguageChanged?.Invoke(language);
        }

        private void LoadLanguage(Language language)
        {
            _localizedStrings.Clear();

            var langCode = _languageCodes[language];
            var resourcePath = $"Localization/{langCode}";

            var textAsset = Resources.Load<TextAsset>(resourcePath);
            if (textAsset != null)
            {
                ParseLocalizationFile(textAsset.text);
            }
            else
            {
                Debug.LogWarning($"Localization file not found: {resourcePath}");
                // Fall back to English
                if (language != Language.English)
                {
                    LoadLanguage(Language.English);
                }
            }
        }

        private void ParseLocalizationFile(string content)
        {
            try
            {
                var data = JsonUtility.FromJson<LocalizationData>(content);
                if (data?.entries != null)
                {
                    foreach (var entry in data.entries)
                    {
                        _localizedStrings[entry.key] = entry.value;
                    }
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to parse localization file: {e.Message}");
            }
        }

        // Get localized string
        public string Get(string key)
        {
            if (_localizedStrings.TryGetValue(key, out var value))
            {
                return value;
            }

            Debug.LogWarning($"Missing localization key: {key}");
            return key;
        }

        // Get localized string with parameters
        public string Get(string key, params object[] args)
        {
            var format = Get(key);
            try
            {
                return string.Format(format, args);
            }
            catch
            {
                return format;
            }
        }

        // Get localized string with named parameters
        public string Get(string key, Dictionary<string, object> parameters)
        {
            var result = Get(key);

            foreach (var param in parameters)
            {
                result = result.Replace($"{{{{{param.Key}}}}}", param.Value?.ToString() ?? "");
            }

            return result;
        }

        // Check if key exists
        public bool HasKey(string key)
        {
            return _localizedStrings.ContainsKey(key);
        }

        // Get all available languages
        public Language[] GetAvailableLanguages()
        {
            return (Language[])Enum.GetValues(typeof(Language));
        }

        // Get language display name
        public string GetLanguageDisplayName(Language language)
        {
            return language switch
            {
                Language.English => "English",
                Language.Spanish => "Español",
                Language.French => "Français",
                Language.German => "Deutsch",
                Language.Japanese => "日本語",
                Language.Portuguese => "Português",
                _ => language.ToString()
            };
        }
    }

    // Static shorthand for getting localized strings
    public static class L
    {
        public static string Get(string key)
        {
            if (LocalizationManager.Instance == null) return key;
            return LocalizationManager.Instance.Get(key);
        }

        public static string Get(string key, params object[] args)
        {
            if (LocalizationManager.Instance == null) return key;
            return LocalizationManager.Instance.Get(key, args);
        }

        public static string Get(string key, Dictionary<string, object> parameters)
        {
            if (LocalizationManager.Instance == null) return key;
            return LocalizationManager.Instance.Get(key, parameters);
        }
    }
}
