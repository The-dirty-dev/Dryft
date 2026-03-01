using UnityEngine;
using System;
using System.Collections.Generic;
using Drift.Player;

namespace Drift.Environment
{
    /// <summary>
    /// Manages different zones within the bar environment.
    ///
    /// Zones:
    /// - Lounge: Main socializing area with seating
    /// - Bar: The counter area for drinks/ordering
    /// - DanceFloor: Active area with music-reactive lighting
    /// - BoothEntrance: Transition area to private booths
    /// - Stage: Performance area (if applicable)
    /// </summary>
    public class ZoneManager : MonoBehaviour
    {
        public static ZoneManager Instance { get; private set; }

        [Header("Zone Definitions")]
        [SerializeField] private Zone[] _zones;

        [Header("Settings")]
        [SerializeField] private float _zoneDetectionRadius = 0.5f;
        [SerializeField] private float _checkInterval = 0.5f;

        // Current state
        public Zone CurrentZone { get; private set; }
        public ZoneType CurrentZoneType => CurrentZone?.zoneType ?? ZoneType.None;

        // Events
        public event Action<Zone, Zone> OnZoneChanged; // (oldZone, newZone)
        public event Action<Zone> OnZoneEntered;
        public event Action<Zone> OnZoneExited;

        private float _lastCheckTime;
        private Dictionary<ZoneType, Zone> _zoneMap = new Dictionary<ZoneType, Zone>();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            // Build zone map
            foreach (var zone in _zones)
            {
                if (zone != null && !_zoneMap.ContainsKey(zone.zoneType))
                {
                    _zoneMap[zone.zoneType] = zone;
                }
            }
        }

        private void Update()
        {
            // Check zone at intervals
            if (Time.time - _lastCheckTime >= _checkInterval)
            {
                _lastCheckTime = Time.time;
                CheckCurrentZone();
            }
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void CheckCurrentZone()
        {
            if (PlayerController.Instance == null) return;

            Vector3 playerPos = PlayerController.Instance.transform.position;
            Zone newZone = null;
            float closestDistance = float.MaxValue;

            // Find the zone the player is in
            foreach (var zone in _zones)
            {
                if (zone == null || zone.bounds == null) continue;

                // Check if player is within zone bounds
                if (zone.bounds.bounds.Contains(playerPos))
                {
                    float distance = Vector3.Distance(playerPos, zone.bounds.bounds.center);
                    if (distance < closestDistance)
                    {
                        closestDistance = distance;
                        newZone = zone;
                    }
                }
            }

            // Handle zone change
            if (newZone != CurrentZone)
            {
                Zone oldZone = CurrentZone;

                if (oldZone != null)
                {
                    OnZoneExited?.Invoke(oldZone);
                    oldZone.OnPlayerExit();
                }

                CurrentZone = newZone;

                if (newZone != null)
                {
                    OnZoneEntered?.Invoke(newZone);
                    newZone.OnPlayerEnter();
                }

                OnZoneChanged?.Invoke(oldZone, newZone);
                Debug.Log($"[ZoneManager] Zone changed: {oldZone?.zoneName ?? "None"} -> {newZone?.zoneName ?? "None"}");
            }
        }

        /// <summary>
        /// Gets a zone by type.
        /// </summary>
        public Zone GetZone(ZoneType type)
        {
            _zoneMap.TryGetValue(type, out Zone zone);
            return zone;
        }

        /// <summary>
        /// Gets the spawn point for a specific zone.
        /// </summary>
        public Transform GetZoneSpawnPoint(ZoneType type)
        {
            var zone = GetZone(type);
            return zone?.spawnPoint ?? transform;
        }

        /// <summary>
        /// Teleports player to a specific zone.
        /// </summary>
        public void TeleportToZone(ZoneType type)
        {
            var zone = GetZone(type);
            if (zone == null || zone.spawnPoint == null) return;

            PlayerController.Instance?.TeleportTo(
                zone.spawnPoint.position,
                zone.spawnPoint.rotation
            );
        }

        /// <summary>
        /// Gets all players in a specific zone.
        /// </summary>
        public int GetPlayerCountInZone(ZoneType type)
        {
            var zone = GetZone(type);
            return zone?.currentPlayerCount ?? 0;
        }
    }

    /// <summary>
    /// Zone types in the bar environment.
    /// </summary>
    public enum ZoneType
    {
        None,
        Lounge,
        Bar,
        DanceFloor,
        BoothEntrance,
        Stage,
        VIPArea,
        Entrance
    }

    /// <summary>
    /// Individual zone definition.
    /// </summary>
    [Serializable]
    public class Zone
    {
        public string zoneName;
        public ZoneType zoneType;
        public Collider bounds;
        public Transform spawnPoint;

        [Header("Zone Settings")]
        public float ambientVolume = 1f;
        public float musicVolume = 1f;
        public bool allowVoiceChat = true;
        public int maxCapacity = 20;

        [Header("Visual")]
        public Color zoneLightColor = Color.white;
        public float zoneLightIntensity = 1f;

        [Header("Audio")]
        public AudioClip zoneAmbience;
        public AudioClip zoneMusic;

        // Runtime state
        [HideInInspector] public int currentPlayerCount;

        /// <summary>
        /// Called when local player enters this zone.
        /// </summary>
        public void OnPlayerEnter()
        {
            currentPlayerCount++;

            // Apply zone-specific settings
            if (EnvironmentManager.Instance != null)
            {
                EnvironmentManager.Instance.SetAmbientVolume(ambientVolume);
            }

            // Trigger zone-specific effects
            switch (zoneType)
            {
                case ZoneType.DanceFloor:
                    EnvironmentManager.Instance?.SetLightPulse(true);
                    break;

                case ZoneType.Lounge:
                case ZoneType.Bar:
                    EnvironmentManager.Instance?.SetLightPulse(false);
                    break;
            }
        }

        /// <summary>
        /// Called when local player exits this zone.
        /// </summary>
        public void OnPlayerExit()
        {
            currentPlayerCount = Mathf.Max(0, currentPlayerCount - 1);
        }
    }
}
