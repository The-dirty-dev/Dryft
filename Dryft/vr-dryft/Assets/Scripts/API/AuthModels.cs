using System;

namespace Drift.API
{
    // ==================== Authentication ====================

    /// <summary>
    /// Login request payload.
    /// </summary>
    [Serializable]
    public class LoginRequest
    {
        public string email;
        public string password;
    }

    /// <summary>
    /// Registration request payload.
    /// </summary>
    [Serializable]
    public class RegisterRequest
    {
        public string email;
        public string password;
        public string display_name;
    }

    /// <summary>
    /// Authentication response (login/register).
    /// </summary>
    [Serializable]
    public class AuthResponse
    {
        public string token;
        public string refresh_token;
        public long expires_at;
        public UserResponse user;
    }

    /// <summary>
    /// Token refresh request.
    /// </summary>
    [Serializable]
    public class RefreshTokenRequest
    {
        public string refresh_token;
    }

    /// <summary>
    /// User profile response.
    /// </summary>
    [Serializable]
    public class UserResponse
    {
        public string id;
        public string email;
        public string display_name;
        public string bio;
        public string profile_photo_url;
        public bool verified;
        public string verified_at;
        public string created_at;
    }

    // ==================== Age Verification ====================

    /// <summary>
    /// Card verification initiation response.
    /// </summary>
    [Serializable]
    public class CardVerificationInitResponse
    {
        public string client_secret;
    }

    /// <summary>
    /// Card verification confirmation request.
    /// </summary>
    [Serializable]
    public class CardVerificationConfirmRequest
    {
        public string setup_intent_id;
    }

    /// <summary>
    /// ID verification initiation response.
    /// </summary>
    [Serializable]
    public class IDVerificationInitResponse
    {
        public string redirect_url;
        public string sdk_token;
    }

    /// <summary>
    /// Overall verification status response.
    /// </summary>
    [Serializable]
    public class VerificationStatusResponse
    {
        public string status; // PENDING, VERIFIED, REJECTED, MANUAL_REVIEW
        public bool card_verified;
        public bool id_verified;
        public bool face_match_verified;
        public string rejection_reason;
        public bool can_retry;
        public string retry_available_at;
    }

    // ==================== Profile ====================

    /// <summary>
    /// Profile update request.
    /// </summary>
    [Serializable]
    public class ProfileUpdateRequest
    {
        public string display_name;
        public string bio;
    }

    /// <summary>
    /// Profile photo upload response.
    /// </summary>
    [Serializable]
    public class PhotoUploadResponse
    {
        public string upload_url;
        public string photo_key;
    }

    // ==================== Generic ====================

    /// <summary>
    /// Simple success response.
    /// </summary>
    [Serializable]
    public class SuccessResponse
    {
        public bool success;
    }

    /// <summary>
    /// Verification status enum helper.
    /// </summary>
    public static class VerificationStatus
    {
        public const string Pending = "PENDING";
        public const string Verified = "VERIFIED";
        public const string Rejected = "REJECTED";
        public const string ManualReview = "MANUAL_REVIEW";

        public static bool IsVerified(string status) => status == Verified;
        public static bool IsPending(string status) => status == Pending;
        public static bool IsRejected(string status) => status == Rejected;
        public static bool NeedsReview(string status) => status == ManualReview;
    }
}
