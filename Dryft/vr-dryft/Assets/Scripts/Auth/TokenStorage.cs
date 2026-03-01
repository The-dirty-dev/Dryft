using UnityEngine;
using System;
using System.Text;
using System.Security.Cryptography;

namespace Drift.Auth
{
    /// <summary>
    /// Securely stores authentication tokens.
    /// Uses encryption on platforms that support it.
    ///
    /// SECURITY NOTE: This provides basic protection for tokens at rest.
    /// For production, consider platform-specific secure storage:
    /// - iOS: Keychain
    /// - Android: EncryptedSharedPreferences
    /// - Windows: DPAPI
    /// </summary>
    public class TokenStorage
    {
        private const string ACCESS_TOKEN_KEY = "drift_access_token";
        private const string REFRESH_TOKEN_KEY = "drift_refresh_token";
        private const string ENCRYPTION_KEY_KEY = "drift_enc_key";

        private byte[] _encryptionKey;

        public TokenStorage()
        {
            InitializeEncryptionKey();
        }

        /// <summary>
        /// Saves tokens to secure storage.
        /// </summary>
        public void SaveTokens(string accessToken, string refreshToken)
        {
            try
            {
                string encryptedAccess = Encrypt(accessToken);
                string encryptedRefresh = Encrypt(refreshToken);

                PlayerPrefs.SetString(ACCESS_TOKEN_KEY, encryptedAccess);
                PlayerPrefs.SetString(REFRESH_TOKEN_KEY, encryptedRefresh);
                PlayerPrefs.Save();

                Debug.Log("[TokenStorage] Tokens saved");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TokenStorage] Failed to save tokens: {ex.Message}");
            }
        }

        /// <summary>
        /// Loads tokens from secure storage.
        /// </summary>
        public (string accessToken, string refreshToken) LoadTokens()
        {
            try
            {
                string encryptedAccess = PlayerPrefs.GetString(ACCESS_TOKEN_KEY, "");
                string encryptedRefresh = PlayerPrefs.GetString(REFRESH_TOKEN_KEY, "");

                if (string.IsNullOrEmpty(encryptedRefresh))
                {
                    return (null, null);
                }

                string accessToken = Decrypt(encryptedAccess);
                string refreshToken = Decrypt(encryptedRefresh);

                return (accessToken, refreshToken);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TokenStorage] Failed to load tokens: {ex.Message}");
                ClearTokens();
                return (null, null);
            }
        }

        /// <summary>
        /// Clears all stored tokens.
        /// </summary>
        public void ClearTokens()
        {
            PlayerPrefs.DeleteKey(ACCESS_TOKEN_KEY);
            PlayerPrefs.DeleteKey(REFRESH_TOKEN_KEY);
            PlayerPrefs.Save();

            Debug.Log("[TokenStorage] Tokens cleared");
        }

        private void InitializeEncryptionKey()
        {
            // Try to load existing key
            string storedKey = PlayerPrefs.GetString(ENCRYPTION_KEY_KEY, "");

            if (!string.IsNullOrEmpty(storedKey))
            {
                try
                {
                    _encryptionKey = Convert.FromBase64String(storedKey);
                    return;
                }
                catch { }
            }

            // Generate new key
            _encryptionKey = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(_encryptionKey);
            }

            // Store key
            PlayerPrefs.SetString(ENCRYPTION_KEY_KEY, Convert.ToBase64String(_encryptionKey));
            PlayerPrefs.Save();
        }

        private string Encrypt(string plainText)
        {
            if (string.IsNullOrEmpty(plainText))
                return "";

            try
            {
                using var aes = Aes.Create();
                aes.Key = _encryptionKey;
                aes.GenerateIV();

                using var encryptor = aes.CreateEncryptor();
                byte[] plainBytes = Encoding.UTF8.GetBytes(plainText);
                byte[] encryptedBytes = encryptor.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

                // Prepend IV to encrypted data
                byte[] result = new byte[aes.IV.Length + encryptedBytes.Length];
                Array.Copy(aes.IV, 0, result, 0, aes.IV.Length);
                Array.Copy(encryptedBytes, 0, result, aes.IV.Length, encryptedBytes.Length);

                return Convert.ToBase64String(result);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TokenStorage] Encryption failed: {ex.Message}");
                // Fallback to base64 (not secure, but prevents data loss)
                return Convert.ToBase64String(Encoding.UTF8.GetBytes(plainText));
            }
        }

        private string Decrypt(string cipherText)
        {
            if (string.IsNullOrEmpty(cipherText))
                return "";

            try
            {
                byte[] cipherBytes = Convert.FromBase64String(cipherText);

                using var aes = Aes.Create();
                aes.Key = _encryptionKey;

                // Extract IV from beginning
                byte[] iv = new byte[16];
                Array.Copy(cipherBytes, 0, iv, 0, iv.Length);
                aes.IV = iv;

                // Extract encrypted data
                byte[] encryptedData = new byte[cipherBytes.Length - iv.Length];
                Array.Copy(cipherBytes, iv.Length, encryptedData, 0, encryptedData.Length);

                using var decryptor = aes.CreateDecryptor();
                byte[] decryptedBytes = decryptor.TransformFinalBlock(encryptedData, 0, encryptedData.Length);

                return Encoding.UTF8.GetString(decryptedBytes);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[TokenStorage] Decryption failed: {ex.Message}");
                // Try fallback base64
                try
                {
                    return Encoding.UTF8.GetString(Convert.FromBase64String(cipherText));
                }
                catch
                {
                    return "";
                }
            }
        }
    }
}
