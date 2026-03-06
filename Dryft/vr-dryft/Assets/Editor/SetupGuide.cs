using UnityEngine;
using UnityEditor;
using System.IO;

namespace Drift.Editor
{
    /// <summary>
    /// First-time setup wizard for Drift VR project.
    /// </summary>
    public class SetupGuide : EditorWindow
    {
        private Vector2 scrollPos;
        private bool xrChecked;
        private bool oculusChecked;
        private bool normcoreChecked;
        private bool scenesChecked;

        [MenuItem("Drift/Setup Guide", priority = 0)]
        public static void ShowWindow()
        {
            var window = GetWindow<SetupGuide>("Drift VR Setup");
            window.minSize = new Vector2(500, 600);
            window.Show();
        }

        [InitializeOnLoadMethod]
        private static void CheckFirstRun()
        {
            // Show setup guide on first open
            if (!EditorPrefs.HasKey("DriftVR_SetupComplete"))
            {
                EditorApplication.delayCall += () => ShowWindow();
            }
        }

        private void OnEnable()
        {
            RefreshChecks();
        }

        private void RefreshChecks()
        {
            // Check XR Plugin Management
            xrChecked = IsPackageInstalled("com.unity.xr.management");

            // Check Oculus XR Plugin
            oculusChecked = IsPackageInstalled("com.unity.xr.oculus");

            // Check if Normcore package is installed.
            normcoreChecked = IsPackageInstalled("com.normalvr.normcore");

            // Check if scenes exist
            scenesChecked = Directory.Exists("Assets/Scenes") &&
                Directory.GetFiles("Assets/Scenes", "*.unity").Length > 0;
        }

        private bool IsPackageInstalled(string packageId)
        {
            string manifestPath = "Packages/manifest.json";
            if (File.Exists(manifestPath))
            {
                string manifest = File.ReadAllText(manifestPath);
                return manifest.Contains(packageId);
            }
            return false;
        }

        private void OnGUI()
        {
            scrollPos = EditorGUILayout.BeginScrollView(scrollPos);

            // Header
            GUILayout.Space(10);
            EditorGUILayout.LabelField("Drift VR Setup Guide", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("Follow these steps to set up your development environment.", EditorStyles.wordWrappedLabel);
            GUILayout.Space(20);

            // Step 1: Unity Version
            DrawStep("1. Unity Version",
                "This project requires Unity 2022.3 LTS or later with Android Build Support.",
                true,
                "Unity is running");

            // Step 2: XR Plugin Management
            DrawStep("2. XR Plugin Management",
                "Required for VR support. Should be auto-installed from manifest.json.",
                xrChecked,
                xrChecked ? "Installed" : "Not found - Window > Package Manager > XR Plugin Management");

            // Step 3: Oculus XR Plugin
            DrawStep("3. Oculus XR Plugin",
                "Required for Quest support.",
                oculusChecked,
                oculusChecked ? "Installed" : "Not found - Window > Package Manager > Oculus XR Plugin");

            // Step 4: Normcore
            DrawStep("4. Normcore (Multiplayer)",
                "Required for networked VR. Install from Package Manager using the Normcore registry.",
                normcoreChecked,
                normcoreChecked ? "Installed" : "Install from Package Manager");

            // Step 5: Configure XR
            GUILayout.Space(10);
            EditorGUILayout.LabelField("5. Configure XR Settings", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("Go to Edit > Project Settings > XR Plug-in Management and enable Oculus for Android.", EditorStyles.wordWrappedLabel);
            if (GUILayout.Button("Open XR Settings", GUILayout.Height(30)))
            {
                SettingsService.OpenProjectSettings("Project/XR Plug-in Management");
            }
            GUILayout.Space(10);

            // Step 6: Create Scenes
            DrawStep("6. Create Scenes",
                "Create your VR scenes in Assets/Scenes/",
                scenesChecked,
                scenesChecked ? "Scenes found" : "No scenes - Create Bootstrap.unity and Bar_Main.unity");

            if (!scenesChecked)
            {
                if (GUILayout.Button("Create Default Scenes", GUILayout.Height(30)))
                {
                    CreateDefaultScenes();
                }
            }

            // Step 7: Android SDK
            GUILayout.Space(10);
            EditorGUILayout.LabelField("7. Android SDK", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("Ensure Android SDK is installed with API Level 29+.", EditorStyles.wordWrappedLabel);
            if (GUILayout.Button("Open External Tools Settings", GUILayout.Height(30)))
            {
                SettingsService.OpenUserPreferences("Preferences/External Tools");
            }
            GUILayout.Space(10);

            // Step 8: Quest Developer Mode
            GUILayout.Space(10);
            EditorGUILayout.LabelField("8. Quest Developer Mode", EditorStyles.boldLabel);
            EditorGUILayout.HelpBox(
                "Enable Developer Mode on your Quest:\n" +
                "1. Install Oculus app on phone\n" +
                "2. Go to Devices > Your Quest > Developer Mode\n" +
                "3. Enable Developer Mode\n" +
                "4. Connect Quest via USB and allow debugging",
                MessageType.Info);
            GUILayout.Space(10);

            // Complete Setup
            GUILayout.Space(20);
            EditorGUILayout.LabelField("Ready to Build!", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("Once setup is complete, use Drift > Build > Quest APK to create your APK.", EditorStyles.wordWrappedLabel);

            GUILayout.Space(10);
            if (GUILayout.Button("Mark Setup Complete", GUILayout.Height(40)))
            {
                EditorPrefs.SetBool("DriftVR_SetupComplete", true);
                Close();
            }

            if (GUILayout.Button("Refresh Checks"))
            {
                RefreshChecks();
            }

            EditorGUILayout.EndScrollView();
        }

        private void DrawStep(string title, string description, bool complete, string status)
        {
            GUILayout.Space(10);
            EditorGUILayout.BeginHorizontal();

            // Checkbox
            var icon = complete ? EditorGUIUtility.IconContent("d_Toggle Icon") : EditorGUIUtility.IconContent("d_winbtn_mac_close");
            GUILayout.Label(icon, GUILayout.Width(20), GUILayout.Height(20));

            EditorGUILayout.BeginVertical();
            EditorGUILayout.LabelField(title, EditorStyles.boldLabel);
            EditorGUILayout.LabelField(description, EditorStyles.wordWrappedLabel);
            EditorGUILayout.LabelField(status, complete ? EditorStyles.miniLabel : EditorStyles.miniBoldLabel);
            EditorGUILayout.EndVertical();

            EditorGUILayout.EndHorizontal();
        }

        private void CreateDefaultScenes()
        {
            Directory.CreateDirectory("Assets/Scenes");

            // Create empty scenes (user needs to set them up)
            var bootstrapScene = EditorBuildSettings.scenes;
            Debug.Log("[DriftSetup] Please create Bootstrap.unity and Bar_Main.unity in Assets/Scenes/");
            EditorUtility.DisplayDialog("Create Scenes",
                "Please create the following scenes in Assets/Scenes/:\n\n" +
                "1. Bootstrap.unity - Initial loading/auth scene\n" +
                "2. Bar_Main.unity - Main neon bar environment\n" +
                "3. Booth_Private.unity - Private booth template",
                "OK");

            RefreshChecks();
        }
    }
}
