using System;
using System.Collections.Generic;

namespace Drift.API
{
    /// <summary>
    /// Data models for companion session API
    /// </summary>

    [Serializable]
    public class CreateSessionRequest
    {
        public int max_participants;
        public string vr_device_type;
        public int expires_in_mins;
    }

    [Serializable]
    public class CreateSessionResponse
    {
        public string session_id;
        public string session_code;
        public string expires_at;
    }

    [Serializable]
    public class JoinSessionRequest
    {
        public string session_code;
        public string display_name;
        public string device_type;
    }

    [Serializable]
    public class SessionUser
    {
        public string user_id;
        public string display_name;
        public string photo_url;
        public string device_type;
        public bool is_host;
        public long joined_at;
    }

    [Serializable]
    public class CompanionSession
    {
        public string id;
        public string host_id;
        public string session_code;
        public string status;
        public int max_participants;
        public string vr_device_type;
        public string vr_room;
        public string created_at;
        public string expires_at;
        public string ended_at;
    }

    [Serializable]
    public class SessionInfo
    {
        public CompanionSession session;
        public List<SessionUser> participants;
        public SessionUser host;
    }

    [Serializable]
    public class VRStatePayload
    {
        public string session_id;
        public string user_id;
        public Vector3Data avatar_position;
        public Vector3Data avatar_rotation;
        public Vector3Data head_position;
        public Vector3Data left_hand_pos;
        public Vector3Data right_hand_pos;
        public string current_activity;
        public string current_room;
        public bool haptic_device_connected;
        public string haptic_device_name;
        public float haptic_intensity;
    }

    [Serializable]
    public class Vector3Data
    {
        public float x;
        public float y;
        public float z;

        public Vector3Data() { }

        public Vector3Data(UnityEngine.Vector3 v)
        {
            x = v.x;
            y = v.y;
            z = v.z;
        }

        public UnityEngine.Vector3 ToVector3()
        {
            return new UnityEngine.Vector3(x, y, z);
        }
    }

    [Serializable]
    public class SessionChatPayload
    {
        public string session_id;
        public string user_id;
        public string display_name;
        public string content;
        public long timestamp;
    }

    [Serializable]
    public class SessionHapticPayload
    {
        public string session_id;
        public string from_user_id;
        public string to_user_id;
        public string command_type;
        public float intensity;
        public int duration_ms;
        public string pattern_name;
    }

    [Serializable]
    public class SessionUserJoinedPayload
    {
        public string session_id;
        public SessionUser user;
    }

    [Serializable]
    public class SessionUserLeftPayload
    {
        public string session_id;
        public string user_id;
        public string reason;
    }

    [Serializable]
    public class SessionEndedPayload
    {
        public string session_id;
        public string reason;
    }

    [Serializable]
    public class SetHapticPermissionRequest
    {
        public string controller_id;
        public string permission_type; // always, request, never
        public float max_intensity;
    }

    [Serializable]
    public class SendHapticRequest
    {
        public string to_user_id;
        public string command_type;
        public float intensity;
        public int duration_ms;
    }

    /// <summary>
    /// VR state data to broadcast to companions.
    /// </summary>
    [Serializable]
    public class VRStateData
    {
        public string state; // "in_lounge", "matchmaking", "in_booth", "idle"
        public string partner_name;
        public string current_room;
        public bool is_interacting;
        public float haptic_intensity;
    }
}
