using UnityEngine;
using UnityEngine.SceneManagement;
using System.Threading.Tasks;
using Drift.Core;
using Drift.Auth;

namespace Drift.Environment
{
    /// <summary>
    /// Bootstrap scene controller.
    ///
    /// Handles initial loading, splash screen, and transitions to
    /// appropriate scene based on auth state.
    /// </summary>
    public class SceneBootstrap : MonoBehaviour
    {
        [Header("Scene Names")]
        [SerializeField] private string _loginScene = "Login";
        [SerializeField] private string _verificationScene = "Verification";
        [SerializeField] private string _lobbyScene = "Lobby";
        [SerializeField] private string _mainBarScene = "Bar_Main";

        [Header("UI References")]
        [SerializeField] private CanvasGroup _splashScreen;
        [SerializeField] private GameObject _loadingIndicator;
        [SerializeField] private UnityEngine.UI.Text _statusText;

        [Header("Settings")]
        [SerializeField] private float _splashDuration = 2f;
        [SerializeField] private float _fadeSpeed = 1f;

        private async void Start()
        {
            // Show splash
            if (_splashScreen != null)
            {
                _splashScreen.alpha = 1f;
            }

            SetStatus("Initializing...");

            // Wait for GameManager to initialize
            await WaitForGameManager();

            // Wait for splash duration
            await Task.Delay((int)(_splashDuration * 1000));

            // Check state and navigate
            await NavigateBasedOnState();
        }

        private async Task WaitForGameManager()
        {
            // Wait for GameManager to be available and initialized
            while (GameManager.Instance == null ||
                   GameManager.Instance.CurrentState == GameState.Initializing)
            {
                await Task.Delay(100);
            }
        }

        private async Task NavigateBasedOnState()
        {
            if (GameManager.Instance == null)
            {
                SetStatus("Error: GameManager not found");
                return;
            }

            var state = GameManager.Instance.CurrentState;

            switch (state)
            {
                case GameState.NeedsAuthentication:
                    SetStatus("Please sign in...");
                    await TransitionToScene(_loginScene);
                    break;

                case GameState.NeedsVerification:
                    SetStatus("Verification required...");
                    await TransitionToScene(_verificationScene);
                    break;

                case GameState.Ready:
                    SetStatus("Welcome back!");
                    await TransitionToScene(_lobbyScene);
                    break;

                default:
                    SetStatus("Loading...");
                    await TransitionToScene(_lobbyScene);
                    break;
            }
        }

        private async Task TransitionToScene(string sceneName)
        {
            // Fade out splash
            if (_splashScreen != null)
            {
                while (_splashScreen.alpha > 0)
                {
                    _splashScreen.alpha -= Time.deltaTime * _fadeSpeed;
                    await Task.Yield();
                }
            }

            // Load scene
            var op = SceneManager.LoadSceneAsync(sceneName);
            op.allowSceneActivation = false;

            while (op.progress < 0.9f)
            {
                await Task.Yield();
            }

            op.allowSceneActivation = true;
        }

        private void SetStatus(string status)
        {
            if (_statusText != null)
            {
                _statusText.text = status;
            }
            Debug.Log($"[Bootstrap] {status}");
        }
    }
}
