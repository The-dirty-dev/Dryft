using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Events;

namespace Drift.DeepLink
{
    public enum DeepLinkType
    {
        Unknown,
        Profile,
        VRInvite,
        VRRoom,
        Match,
        Settings
    }

    [Serializable]
    public class DeepLinkData
    {
        public DeepLinkType type;
        public string rawUrl;
        public Dictionary<string, string> parameters = new Dictionary<string, string>();
        public long timestamp;

        public string GetParam(string key, string defaultValue = "")
        {
            return parameters.TryGetValue(key, out var value) ? value : defaultValue;
        }
    }

    public class DeepLinkManager : MonoBehaviour
    {
        public static DeepLinkManager Instance { get; private set; }

        [Header("Configuration")]
        [SerializeField] private string[] supportedSchemes = { "dryft://", "https://dryft.site/", "https://link.dryft.site/" };

        [Header("Events")]
        public UnityEvent<DeepLinkData> onDeepLinkReceived;
        public UnityEvent<DeepLinkData> onProfileLinkReceived;
        public UnityEvent<DeepLinkData> onVRInviteLinkReceived;
        public UnityEvent<DeepLinkData> onVRRoomLinkReceived;

        private DeepLinkData _pendingLink;
        private bool _isInitialized;

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
            // Subscribe to Unity's deep link callback
            Application.deepLinkActivated += OnDeepLinkActivated;

            // Check if launched with a deep link
            if (!string.IsNullOrEmpty(Application.absoluteURL))
            {
                OnDeepLinkActivated(Application.absoluteURL);
            }

            _isInitialized = true;
        }

        private void OnDestroy()
        {
            Application.deepLinkActivated -= OnDeepLinkActivated;
        }

        private void OnDeepLinkActivated(string url)
        {
            Debug.Log($"[DeepLink] Received: {url}");

            var linkData = ParseDeepLink(url);
            if (linkData == null)
            {
                Debug.LogWarning($"[DeepLink] Failed to parse: {url}");
                return;
            }

            // Store as pending if not ready to handle
            _pendingLink = linkData;

            // Fire general event
            onDeepLinkReceived?.Invoke(linkData);

            // Fire type-specific events
            switch (linkData.type)
            {
                case DeepLinkType.Profile:
                    onProfileLinkReceived?.Invoke(linkData);
                    break;
                case DeepLinkType.VRInvite:
                    onVRInviteLinkReceived?.Invoke(linkData);
                    HandleVRInvite(linkData);
                    break;
                case DeepLinkType.VRRoom:
                    onVRRoomLinkReceived?.Invoke(linkData);
                    HandleVRRoom(linkData);
                    break;
            }
        }

        public DeepLinkData ParseDeepLink(string url)
        {
            if (string.IsNullOrEmpty(url)) return null;

            var linkData = new DeepLinkData
            {
                rawUrl = url,
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            // Normalize URL
            string path = url;
            foreach (var scheme in supportedSchemes)
            {
                if (url.StartsWith(scheme, StringComparison.OrdinalIgnoreCase))
                {
                    path = url.Substring(scheme.Length);
                    break;
                }
            }

            // Remove query string and parse it
            var queryIndex = path.IndexOf('?');
            string queryString = "";
            if (queryIndex >= 0)
            {
                queryString = path.Substring(queryIndex + 1);
                path = path.Substring(0, queryIndex);
            }

            // Parse query parameters
            if (!string.IsNullOrEmpty(queryString))
            {
                var pairs = queryString.Split('&');
                foreach (var pair in pairs)
                {
                    var keyValue = pair.Split('=');
                    if (keyValue.Length == 2)
                    {
                        linkData.parameters[Uri.UnescapeDataString(keyValue[0])] =
                            Uri.UnescapeDataString(keyValue[1]);
                    }
                }
            }

            // Remove trailing slash
            path = path.TrimEnd('/');

            // Parse path
            var segments = path.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries);

            if (segments.Length == 0)
            {
                linkData.type = DeepLinkType.Unknown;
                return linkData;
            }

            // Determine link type
            switch (segments[0].ToLower())
            {
                case "profile":
                    linkData.type = DeepLinkType.Profile;
                    if (segments.Length > 1)
                    {
                        linkData.parameters["userId"] = segments[1];
                    }
                    break;

                case "vr":
                    if (segments.Length > 1)
                    {
                        switch (segments[1].ToLower())
                        {
                            case "invite":
                                linkData.type = DeepLinkType.VRInvite;
                                if (segments.Length > 2)
                                {
                                    linkData.parameters["inviteCode"] = segments[2];
                                }
                                break;
                            case "room":
                                linkData.type = DeepLinkType.VRRoom;
                                if (segments.Length > 2)
                                {
                                    linkData.parameters["roomId"] = segments[2];
                                }
                                break;
                        }
                    }
                    break;

                case "match":
                case "chat":
                    linkData.type = DeepLinkType.Match;
                    if (segments.Length > 1)
                    {
                        linkData.parameters["matchId"] = segments[1];
                    }
                    break;

                case "settings":
                    linkData.type = DeepLinkType.Settings;
                    if (segments.Length > 1)
                    {
                        linkData.parameters["section"] = segments[1];
                    }
                    break;

                default:
                    linkData.type = DeepLinkType.Unknown;
                    linkData.parameters["path"] = path;
                    break;
            }

            return linkData;
        }

        private void HandleVRInvite(DeepLinkData linkData)
        {
            var inviteCode = linkData.GetParam("inviteCode");
            if (string.IsNullOrEmpty(inviteCode))
            {
                Debug.LogWarning("[DeepLink] VR invite missing invite code");
                return;
            }

            Debug.Log($"[DeepLink] Processing VR invite: {inviteCode}");

            // Validate and join the VR session
            StartCoroutine(ValidateAndJoinVRInvite(inviteCode));
        }

        private System.Collections.IEnumerator ValidateAndJoinVRInvite(string inviteCode)
        {
            // Call backend to validate invite
            var request = new UnityEngine.Networking.UnityWebRequest(
                $"{GetApiBaseUrl()}/api/v1/links/vr-invite/{inviteCode}/validate",
                "GET"
            );
            request.downloadHandler = new UnityEngine.Networking.DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");

            yield return request.SendWebRequest();

            if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
            {
                var response = JsonUtility.FromJson<VRInviteValidationResponse>(request.downloadHandler.text);
                if (response.valid)
                {
                    // Show invite UI or auto-join
                    ShowVRInvitePrompt(response);
                }
                else
                {
                    ShowInviteExpiredMessage();
                }
            }
            else
            {
                Debug.LogError($"[DeepLink] Failed to validate invite: {request.error}");
                ShowInviteErrorMessage();
            }
        }

        private void HandleVRRoom(DeepLinkData linkData)
        {
            var roomId = linkData.GetParam("roomId");
            if (string.IsNullOrEmpty(roomId))
            {
                Debug.LogWarning("[DeepLink] VR room missing room ID");
                return;
            }

            Debug.Log($"[DeepLink] Joining VR room: {roomId}");
            // Trigger room join logic
        }

        private void ShowVRInvitePrompt(VRInviteValidationResponse invite)
        {
            // Show UI prompt to accept/decline VR invite
            Debug.Log($"[DeepLink] VR Invite from {invite.hostName} to {invite.roomType}");
        }

        private void ShowInviteExpiredMessage()
        {
            Debug.Log("[DeepLink] VR Invite has expired");
        }

        private void ShowInviteErrorMessage()
        {
            Debug.Log("[DeepLink] Failed to process VR invite");
        }

        private string GetApiBaseUrl()
        {
            #if UNITY_EDITOR || DEVELOPMENT_BUILD
            return "http://localhost:8080";
            #else
            return "https://api.dryft.site";
            #endif
        }

        // Public methods for generating links
        public string GenerateProfileLink(string userId)
        {
            return $"https://dryft.site/profile/{userId}";
        }

        public string GenerateVRInviteLink(string inviteCode)
        {
            return $"https://dryft.site/vr/invite/{inviteCode}";
        }

        public string GenerateVRRoomLink(string roomId)
        {
            return $"https://dryft.site/vr/room/{roomId}";
        }

        // Get pending link (for delayed processing)
        public DeepLinkData GetAndClearPendingLink()
        {
            var link = _pendingLink;
            _pendingLink = null;
            return link;
        }

        public bool HasPendingLink => _pendingLink != null;
    }

    [Serializable]
    public class VRInviteValidationResponse
    {
        public bool valid;
        public string inviteCode;
        public string hostId;
        public string hostName;
        public string roomId;
        public string roomType;
        public long expiresAt;
    }
}
