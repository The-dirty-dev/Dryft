using UnityEngine;
using UnityEngine.Networking;
using System;
using System.Text;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace Drift.API
{
    /// <summary>
    /// HTTP client for communicating with the Drift Go backend.
    /// Handles authentication headers, request/response serialization,
    /// and error handling.
    /// </summary>
    public class ApiClient
    {
        private static ApiClient _instance;
        public static ApiClient Instance => _instance ??= new ApiClient();

        private string _baseUrl = "http://localhost:8080";
        private string _authToken;
        private int _timeoutSeconds = 30;

        public bool IsAuthenticated => !string.IsNullOrEmpty(_authToken);

        /// <summary>
        /// Configures the API client.
        /// </summary>
        public void Configure(string baseUrl, int timeoutSeconds = 30)
        {
            _baseUrl = baseUrl.TrimEnd('/');
            _timeoutSeconds = timeoutSeconds;
            Debug.Log($"[ApiClient] Configured: {_baseUrl}");
        }

        /// <summary>
        /// Sets the authentication token for subsequent requests.
        /// </summary>
        public void SetAuthToken(string token)
        {
            _authToken = token;
        }

        /// <summary>
        /// Clears the authentication token.
        /// </summary>
        public void ClearAuthToken()
        {
            _authToken = null;
        }

        /// <summary>
        /// Performs a GET request.
        /// </summary>
        public async Task<ApiResponse<T>> GetAsync<T>(string endpoint)
        {
            return await SendRequestAsync<T>(endpoint, "GET", null);
        }

        /// <summary>
        /// Performs a POST request with JSON body.
        /// </summary>
        public async Task<ApiResponse<T>> PostAsync<T>(string endpoint, object body)
        {
            string json = body != null ? JsonUtility.ToJson(body) : null;
            return await SendRequestAsync<T>(endpoint, "POST", json);
        }

        /// <summary>
        /// Performs a POST request with raw JSON string.
        /// </summary>
        public async Task<ApiResponse<T>> PostJsonAsync<T>(string endpoint, string json)
        {
            return await SendRequestAsync<T>(endpoint, "POST", json);
        }

        /// <summary>
        /// Performs a PUT request.
        /// </summary>
        public async Task<ApiResponse<T>> PutAsync<T>(string endpoint, object body)
        {
            string json = body != null ? JsonUtility.ToJson(body) : null;
            return await SendRequestAsync<T>(endpoint, "PUT", json);
        }

        /// <summary>
        /// Performs a DELETE request with typed response.
        /// </summary>
        public async Task<ApiResponse<T>> DeleteAsync<T>(string endpoint)
        {
            return await SendRequestAsync<T>(endpoint, "DELETE", null);
        }

        /// <summary>
        /// Performs a DELETE request without expecting a response body.
        /// </summary>
        public async Task<bool> DeleteAsync(string endpoint)
        {
            var response = await SendRequestAsync<object>(endpoint, "DELETE", null);
            return response.Success;
        }

        /// <summary>
        /// Performs a POST request without expecting a response body.
        /// </summary>
        public async Task<bool> PostAsync(string endpoint, object body)
        {
            string json = body != null ? JsonUtility.ToJson(body) : null;
            var response = await SendRequestAsync<object>(endpoint, "POST", json);
            return response.Success;
        }

        private async Task<ApiResponse<T>> SendRequestAsync<T>(string endpoint, string method, string jsonBody)
        {
            string url = _baseUrl + endpoint;
            var response = new ApiResponse<T>();

            try
            {
                using var request = new UnityWebRequest(url, method);

                // Set body for POST/PUT
                if (!string.IsNullOrEmpty(jsonBody))
                {
                    byte[] bodyRaw = Encoding.UTF8.GetBytes(jsonBody);
                    request.uploadHandler = new UploadHandlerRaw(bodyRaw);
                }

                request.downloadHandler = new DownloadHandlerBuffer();
                request.timeout = _timeoutSeconds;

                // Headers
                request.SetRequestHeader("Content-Type", "application/json");
                request.SetRequestHeader("Accept", "application/json");

                // Auth header
                if (!string.IsNullOrEmpty(_authToken))
                {
                    request.SetRequestHeader("Authorization", $"Bearer {_authToken}");
                }

                // Send request
                var operation = request.SendWebRequest();

                while (!operation.isDone)
                {
                    await Task.Yield();
                }

                // Parse response
                response.StatusCode = (int)request.responseCode;
                response.RawResponse = request.downloadHandler.text;

                if (request.result == UnityWebRequest.Result.Success)
                {
                    response.Success = true;

                    // Parse JSON response
                    if (!string.IsNullOrEmpty(response.RawResponse))
                    {
                        try
                        {
                            response.Data = JsonUtility.FromJson<T>(response.RawResponse);
                        }
                        catch (Exception ex)
                        {
                            Debug.LogWarning($"[ApiClient] JSON parse error: {ex.Message}");
                            // Try to parse as wrapper
                            response.Data = default;
                        }
                    }
                }
                else
                {
                    response.Success = false;
                    response.Error = ParseError(response.RawResponse, request.error);

                    Debug.LogWarning($"[ApiClient] {method} {endpoint} failed: {response.Error}");
                }
            }
            catch (Exception ex)
            {
                response.Success = false;
                response.Error = ex.Message;
                Debug.LogError($"[ApiClient] Exception: {ex}");
            }

            return response;
        }

        private string ParseError(string rawResponse, string defaultError)
        {
            if (string.IsNullOrEmpty(rawResponse))
                return defaultError;

            try
            {
                var errorResponse = JsonUtility.FromJson<ApiErrorResponse>(rawResponse);
                return errorResponse?.error ?? defaultError;
            }
            catch
            {
                return defaultError;
            }
        }

        /// <summary>
        /// Performs a health check.
        /// </summary>
        public async Task<bool> HealthCheckAsync()
        {
            try
            {
                using var request = UnityWebRequest.Get(_baseUrl + "/health");
                request.timeout = 5;

                var operation = request.SendWebRequest();
                while (!operation.isDone)
                {
                    await Task.Yield();
                }

                return request.result == UnityWebRequest.Result.Success;
            }
            catch
            {
                return false;
            }
        }
    }

    /// <summary>
    /// Generic API response wrapper.
    /// </summary>
    [Serializable]
    public class ApiResponse<T>
    {
        public bool Success;
        public int StatusCode;
        public T Data;
        public string Error;
        public string RawResponse;
    }

    /// <summary>
    /// Error response from API.
    /// </summary>
    [Serializable]
    public class ApiErrorResponse
    {
        public string error;
    }
}
