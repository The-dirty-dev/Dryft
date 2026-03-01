using UnityEngine;
using UnityEditor;
using UnityEditor.Build.Reporting;
using System;
using System.IO;
using System.Linq;

namespace Drift.Editor
{
    /// <summary>
    /// Automated build pipeline for Drift VR.
    /// Supports Quest APK builds and SideQuest deployment.
    /// </summary>
    public static class BuildPipeline
    {
        private const string BUILD_FOLDER = "Builds";
        private const string APK_NAME = "DriftVR";

        [MenuItem("Drift/Build/Quest APK (Development)", priority = 100)]
        public static void BuildQuestDevelopment()
        {
            BuildQuest(BuildOptions.Development | BuildOptions.AllowDebugging);
        }

        [MenuItem("Drift/Build/Quest APK (Release)", priority = 101)]
        public static void BuildQuestRelease()
        {
            BuildQuest(BuildOptions.None);
        }

        [MenuItem("Drift/Build/Quest APK and Deploy to Device", priority = 102)]
        public static void BuildAndDeploy()
        {
            string apkPath = BuildQuest(BuildOptions.Development | BuildOptions.AllowDebugging);
            if (!string.IsNullOrEmpty(apkPath))
            {
                DeployToDevice(apkPath);
            }
        }

        [MenuItem("Drift/Deploy/Install to Connected Device", priority = 200)]
        public static void DeployLatestBuild()
        {
            string buildPath = Path.Combine(BUILD_FOLDER, "Quest");
            if (!Directory.Exists(buildPath))
            {
                EditorUtility.DisplayDialog("No Build Found",
                    "No Quest build found. Please build first.", "OK");
                return;
            }

            var apkFiles = Directory.GetFiles(buildPath, "*.apk")
                .OrderByDescending(f => File.GetLastWriteTime(f))
                .ToArray();

            if (apkFiles.Length == 0)
            {
                EditorUtility.DisplayDialog("No APK Found",
                    "No APK files found in build folder.", "OK");
                return;
            }

            DeployToDevice(apkFiles[0]);
        }

        [MenuItem("Drift/Deploy/Open Build Folder", priority = 201)]
        public static void OpenBuildFolder()
        {
            string buildPath = Path.Combine(BUILD_FOLDER, "Quest");
            Directory.CreateDirectory(buildPath);
            EditorUtility.RevealInFinder(buildPath);
        }

        private static string BuildQuest(BuildOptions options)
        {
            Debug.Log("[DriftBuild] Starting Quest build...");

            // Ensure build folder exists
            string buildPath = Path.Combine(BUILD_FOLDER, "Quest");
            Directory.CreateDirectory(buildPath);

            // Generate APK filename with timestamp
            string timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
            bool isDev = (options & BuildOptions.Development) != 0;
            string suffix = isDev ? "_dev" : "_release";
            string apkPath = Path.Combine(buildPath, $"{APK_NAME}_{timestamp}{suffix}.apk");

            // Configure build settings
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.drift.vr");
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel29;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevel32;
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;

            // Get scenes to build
            string[] scenes = GetBuildScenes();
            if (scenes.Length == 0)
            {
                Debug.LogError("[DriftBuild] No scenes found to build!");
                return null;
            }

            Debug.Log($"[DriftBuild] Building {scenes.Length} scenes...");
            foreach (var scene in scenes)
            {
                Debug.Log($"  - {scene}");
            }

            // Build
            BuildPlayerOptions buildPlayerOptions = new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = apkPath,
                target = BuildTarget.Android,
                options = options
            };

            BuildReport report = UnityEditor.BuildPipeline.BuildPlayer(buildPlayerOptions);
            BuildSummary summary = report.summary;

            if (summary.result == BuildResult.Succeeded)
            {
                Debug.Log($"[DriftBuild] Build succeeded: {summary.totalSize / 1024 / 1024} MB");
                Debug.Log($"[DriftBuild] APK: {apkPath}");

                // Show success notification
                EditorUtility.DisplayDialog("Build Complete",
                    $"Quest APK built successfully!\n\nSize: {summary.totalSize / 1024 / 1024} MB\nPath: {apkPath}",
                    "OK");

                return apkPath;
            }
            else
            {
                Debug.LogError($"[DriftBuild] Build failed with {summary.totalErrors} errors");
                return null;
            }
        }

        private static string[] GetBuildScenes()
        {
            // Get enabled scenes from build settings
            var scenes = EditorBuildSettings.scenes
                .Where(s => s.enabled)
                .Select(s => s.path)
                .ToArray();

            // If no scenes in build settings, find all scenes in Assets
            if (scenes.Length == 0)
            {
                scenes = AssetDatabase.FindAssets("t:Scene", new[] { "Assets/Scenes" })
                    .Select(guid => AssetDatabase.GUIDToAssetPath(guid))
                    .OrderBy(path => path.Contains("Bootstrap") ? 0 : 1) // Bootstrap first
                    .ToArray();
            }

            return scenes;
        }

        private static void DeployToDevice(string apkPath)
        {
            Debug.Log($"[DriftBuild] Deploying to device: {apkPath}");

            // Use adb to install
            string adbPath = GetAdbPath();
            if (string.IsNullOrEmpty(adbPath))
            {
                EditorUtility.DisplayDialog("ADB Not Found",
                    "Could not find adb. Please ensure Android SDK is installed.", "OK");
                return;
            }

            try
            {
                // Check for connected devices
                var deviceCheck = RunProcess(adbPath, "devices");
                if (!deviceCheck.Contains("device"))
                {
                    EditorUtility.DisplayDialog("No Device",
                        "No device connected. Please connect your Quest via USB and enable developer mode.",
                        "OK");
                    return;
                }

                // Install APK
                EditorUtility.DisplayProgressBar("Deploying", "Installing APK to device...", 0.5f);
                var result = RunProcess(adbPath, $"install -r \"{apkPath}\"");

                EditorUtility.ClearProgressBar();

                if (result.Contains("Success"))
                {
                    Debug.Log("[DriftBuild] APK installed successfully!");
                    EditorUtility.DisplayDialog("Deploy Complete",
                        "APK installed to device successfully!\n\nYou can now launch Drift VR on your Quest.",
                        "OK");
                }
                else
                {
                    Debug.LogError($"[DriftBuild] Install failed: {result}");
                    EditorUtility.DisplayDialog("Deploy Failed",
                        $"Failed to install APK:\n{result}", "OK");
                }
            }
            finally
            {
                EditorUtility.ClearProgressBar();
            }
        }

        private static string GetAdbPath()
        {
            // Try to find adb in common locations
            string androidSdkRoot = EditorPrefs.GetString("AndroidSdkRoot");
            if (!string.IsNullOrEmpty(androidSdkRoot))
            {
                string adbPath = Path.Combine(androidSdkRoot, "platform-tools", "adb");
                if (Application.platform == RuntimePlatform.WindowsEditor)
                    adbPath += ".exe";

                if (File.Exists(adbPath))
                    return adbPath;
            }

            // Try PATH
            return "adb";
        }

        private static string RunProcess(string fileName, string arguments)
        {
            try
            {
                var process = new System.Diagnostics.Process
                {
                    StartInfo = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = fileName,
                        Arguments = arguments,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                string output = process.StandardOutput.ReadToEnd();
                string error = process.StandardError.ReadToEnd();
                process.WaitForExit();

                return output + error;
            }
            catch (Exception e)
            {
                return $"Error: {e.Message}";
            }
        }
    }
}
