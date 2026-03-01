using System;
using UnityEngine;

namespace Drift.Haptics
{
    /// <summary>
    /// Represents a haptic feedback pattern - a sequence of intensity/duration steps.
    /// </summary>
    [Serializable]
    public class HapticPattern
    {
        public string Name;
        public HapticStep[] Steps;
        public bool Loop;
        public float LoopDelaySeconds;

        public HapticPattern() { }

        public HapticPattern(string name, HapticStep[] steps, bool loop = false, float loopDelay = 0f)
        {
            Name = name;
            Steps = steps;
            Loop = loop;
            LoopDelaySeconds = loopDelay;
        }

        /// <summary>
        /// Total duration of one cycle of the pattern.
        /// </summary>
        public float TotalDuration
        {
            get
            {
                float total = 0f;
                if (Steps != null)
                {
                    foreach (var step in Steps)
                    {
                        total += step.DurationSeconds;
                    }
                }
                return total;
            }
        }
    }

    /// <summary>
    /// A single step in a haptic pattern.
    /// </summary>
    [Serializable]
    public struct HapticStep
    {
        /// <summary>
        /// Intensity from 0.0 (off) to 1.0 (maximum).
        /// </summary>
        [Range(0f, 1f)]
        public float Intensity;

        /// <summary>
        /// Duration of this step in seconds.
        /// </summary>
        public float DurationSeconds;

        public HapticStep(float intensity, float durationSeconds)
        {
            Intensity = Mathf.Clamp01(intensity);
            DurationSeconds = Mathf.Max(0f, durationSeconds);
        }
    }

    /// <summary>
    /// Library of predefined haptic patterns.
    /// The Foreplay pattern is the signature "slow build" pulse.
    /// </summary>
    public static class HapticPatternLibrary
    {
        /// <summary>
        /// Foreplay - A teasing, building pattern. Slow, sensual, anticipatory.
        /// Loops with brief pauses to maintain tension.
        /// </summary>
        public static HapticPattern Foreplay => new HapticPattern(
            "Foreplay",
            new HapticStep[]
            {
                new HapticStep(0.10f, 0.30f),  // Light touch
                new HapticStep(0.00f, 0.50f),  // Pause - anticipation
                new HapticStep(0.20f, 0.30f),  // Slightly more
                new HapticStep(0.00f, 0.40f),  // Pause
                new HapticStep(0.30f, 0.40f),  // Building
                new HapticStep(0.20f, 0.20f),  // Ease back
                new HapticStep(0.40f, 0.50f),  // Tease higher
                new HapticStep(0.00f, 0.30f),  // Breathe
                new HapticStep(0.50f, 0.60f),  // Pulse up
                new HapticStep(0.30f, 0.30f),  // Hold tension
                new HapticStep(0.15f, 0.40f),  // Gentle fade
            },
            loop: true,
            loopDelay: 0.5f
        );

        /// <summary>
        /// Touch - A gentle, single touch sensation.
        /// </summary>
        public static HapticPattern Touch => new HapticPattern(
            "Touch",
            new HapticStep[]
            {
                new HapticStep(0.30f, 0.15f),  // Initial contact
                new HapticStep(0.50f, 0.10f),  // Press
                new HapticStep(0.30f, 0.20f),  // Release
                new HapticStep(0.10f, 0.15f),  // Fade
            },
            loop: false
        );

        /// <summary>
        /// Caress - A slow, sweeping sensation.
        /// </summary>
        public static HapticPattern Caress => new HapticPattern(
            "Caress",
            new HapticStep[]
            {
                new HapticStep(0.15f, 0.20f),
                new HapticStep(0.25f, 0.30f),
                new HapticStep(0.35f, 0.40f),
                new HapticStep(0.25f, 0.30f),
                new HapticStep(0.15f, 0.20f),
                new HapticStep(0.05f, 0.20f),
            },
            loop: true,
            loopDelay: 0.3f
        );

        /// <summary>
        /// Thrust - A rhythmic, pulsing pattern.
        /// </summary>
        public static HapticPattern Thrust => new HapticPattern(
            "Thrust",
            new HapticStep[]
            {
                new HapticStep(0.70f, 0.15f),  // In
                new HapticStep(0.90f, 0.10f),  // Peak
                new HapticStep(0.40f, 0.15f),  // Out
                new HapticStep(0.10f, 0.20f),  // Reset
            },
            loop: true,
            loopDelay: 0.1f
        );

        /// <summary>
        /// Climax - An intense, building-to-peak pattern.
        /// </summary>
        public static HapticPattern Climax => new HapticPattern(
            "Climax",
            new HapticStep[]
            {
                new HapticStep(0.50f, 0.20f),
                new HapticStep(0.60f, 0.20f),
                new HapticStep(0.70f, 0.20f),
                new HapticStep(0.80f, 0.20f),
                new HapticStep(0.90f, 0.30f),
                new HapticStep(1.00f, 0.50f),  // Peak
                new HapticStep(0.90f, 0.30f),
                new HapticStep(0.70f, 0.40f),
                new HapticStep(0.50f, 0.50f),
                new HapticStep(0.30f, 0.60f),  // Afterglow
                new HapticStep(0.15f, 0.80f),
                new HapticStep(0.05f, 1.00f),
            },
            loop: false
        );

        /// <summary>
        /// Heartbeat - A rhythmic pulse mimicking heartbeat.
        /// </summary>
        public static HapticPattern Heartbeat => new HapticPattern(
            "Heartbeat",
            new HapticStep[]
            {
                new HapticStep(0.60f, 0.08f),  // Lub
                new HapticStep(0.20f, 0.06f),
                new HapticStep(0.70f, 0.10f),  // Dub
                new HapticStep(0.00f, 0.50f),  // Pause
            },
            loop: true,
            loopDelay: 0.2f
        );

        /// <summary>
        /// Wave - A smooth, oscillating pattern.
        /// </summary>
        public static HapticPattern Wave => new HapticPattern(
            "Wave",
            new HapticStep[]
            {
                new HapticStep(0.20f, 0.25f),
                new HapticStep(0.40f, 0.25f),
                new HapticStep(0.60f, 0.25f),
                new HapticStep(0.80f, 0.25f),
                new HapticStep(0.60f, 0.25f),
                new HapticStep(0.40f, 0.25f),
                new HapticStep(0.20f, 0.25f),
            },
            loop: true,
            loopDelay: 0.1f
        );

        /// <summary>
        /// Gets a pattern by name (case-insensitive).
        /// </summary>
        public static HapticPattern GetByName(string name)
        {
            return name?.ToLower() switch
            {
                "foreplay" => Foreplay,
                "touch" => Touch,
                "caress" => Caress,
                "thrust" => Thrust,
                "climax" => Climax,
                "heartbeat" => Heartbeat,
                "wave" => Wave,
                _ => null
            };
        }

        /// <summary>
        /// All available pattern names.
        /// </summary>
        public static string[] AllPatternNames => new[]
        {
            "Foreplay", "Touch", "Caress", "Thrust", "Climax", "Heartbeat", "Wave"
        };
    }
}
