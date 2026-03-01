/**
 * Expo Config Plugin: Screen Security
 *
 * This plugin adds native code for screen capture prevention:
 * - iOS: Adds screen capture detection using UIScreen.isCaptured
 * - Android: Adds FLAG_SECURE to prevent screenshots and screen recording
 *
 * Usage in app.json/app.config.js:
 * {
 *   "plugins": [
 *     ["./plugins/withScreenSecurity", { "enableByDefault": true }]
 *   ]
 * }
 */

const {
  withMainActivity,
  withAppDelegate,
  withInfoPlist,
  withAndroidManifest,
} = require('@expo/config-plugins');

// =============================================================================
// Android Configuration
// =============================================================================

/**
 * Modify MainActivity to add FLAG_SECURE support
 */
function withAndroidScreenSecurity(config, options = {}) {
  return withMainActivity(config, async (config) => {
    const mainActivity = config.modResults;

    // Add import for WindowManager
    if (!mainActivity.contents.includes('import android.view.WindowManager')) {
      mainActivity.contents = mainActivity.contents.replace(
        'import android.os.Bundle;',
        `import android.os.Bundle;
import android.view.WindowManager;`
      );
    }

    // Add FLAG_SECURE setup in onCreate
    if (!mainActivity.contents.includes('FLAG_SECURE')) {
      const onCreateRegex = /super\.onCreate\(savedInstanceState\);/;

      if (options.enableByDefault) {
        // Enable FLAG_SECURE by default
        mainActivity.contents = mainActivity.contents.replace(
          onCreateRegex,
          `super.onCreate(savedInstanceState);

    // Screen Security: Prevent screenshots and screen recording by default
    getWindow().setFlags(
      WindowManager.LayoutParams.FLAG_SECURE,
      WindowManager.LayoutParams.FLAG_SECURE
    );`
        );
      }

      // Add methods to toggle FLAG_SECURE dynamically
      const classEndRegex = /(\s*}\s*)$/;
      mainActivity.contents = mainActivity.contents.replace(
        classEndRegex,
        `
  /**
   * Enable screen security (FLAG_SECURE)
   * Called from React Native bridge
   */
  public void enableScreenSecurity() {
    runOnUiThread(() -> {
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    });
  }

  /**
   * Disable screen security (FLAG_SECURE)
   * Called from React Native bridge
   */
  public void disableScreenSecurity() {
    runOnUiThread(() -> {
      getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
    });
  }

  /**
   * Check if screen security is enabled
   */
  public boolean isScreenSecurityEnabled() {
    return (getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0;
  }
$1`
      );
    }

    return config;
  });
}

// =============================================================================
// iOS Configuration
// =============================================================================

/**
 * Modify AppDelegate to add screen capture detection
 */
function withIOSScreenSecurity(config, options = {}) {
  return withAppDelegate(config, async (config) => {
    const appDelegate = config.modResults;

    // Add notification observer for screen capture in didFinishLaunchingWithOptions
    if (!appDelegate.contents.includes('capturedDidChangeNotification')) {
      // For Objective-C AppDelegate
      if (appDelegate.language === 'objc' || appDelegate.contents.includes('@implementation AppDelegate')) {
        // Add import
        if (!appDelegate.contents.includes('#import <React/RCTBridge.h>')) {
          appDelegate.contents = appDelegate.contents.replace(
            '#import "AppDelegate.h"',
            `#import "AppDelegate.h"
#import <React/RCTBridge.h>
#import <React/RCTEventEmitter.h>`
          );
        }

        // Add screen capture observer setup
        const didFinishRegex = /return YES;\s*$/m;
        appDelegate.contents = appDelegate.contents.replace(
          didFinishRegex,
          `// Screen Security: Add observer for screen capture changes
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(screenCaptureStatusChanged:)
                                               name:UIScreenCapturedDidChangeNotification
                                             object:nil];

  return YES;`
        );

        // Add handler method before @end
        const endRegex = /@end\s*$/;
        appDelegate.contents = appDelegate.contents.replace(
          endRegex,
          `// Screen Security: Handle screen capture status changes
- (void)screenCaptureStatusChanged:(NSNotification *)notification {
  BOOL isCaptured = [[UIScreen mainScreen] isCaptured];

  // Post notification to React Native
  [[NSNotificationCenter defaultCenter] postNotificationName:@"ScreenCaptureStatusChanged"
                                                      object:nil
                                                    userInfo:@{@"isCaptured": @(isCaptured)}];
}

@end`
        );
      }

      // For Swift AppDelegate
      if (appDelegate.language === 'swift' || appDelegate.contents.includes('class AppDelegate')) {
        // Add observer in application didFinishLaunchingWithOptions
        const returnTrue = /return true\s*$/m;
        appDelegate.contents = appDelegate.contents.replace(
          returnTrue,
          `// Screen Security: Add observer for screen capture changes
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(screenCaptureStatusChanged),
      name: UIScreen.capturedDidChangeNotification,
      object: nil
    )

    return true`
        );

        // Add handler method before closing brace of class
        const classEnd = /}\s*$/;
        appDelegate.contents = appDelegate.contents.replace(
          classEnd,
          `
  // Screen Security: Handle screen capture status changes
  @objc func screenCaptureStatusChanged(_ notification: Notification) {
    let isCaptured = UIScreen.main.isCaptured

    NotificationCenter.default.post(
      name: Notification.Name("ScreenCaptureStatusChanged"),
      object: nil,
      userInfo: ["isCaptured": isCaptured]
    )
  }
}`
        );
      }
    }

    return config;
  });
}

/**
 * Add required usage descriptions to Info.plist
 */
function withIOSInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    // No specific plist entries needed for screen capture detection
    // but we can add a custom key to indicate the feature is enabled
    config.modResults.DriftScreenSecurityEnabled = true;
    return config;
  });
}

// =============================================================================
// Main Plugin Export
// =============================================================================

/**
 * Main plugin function
 * @param {Object} config - Expo config object
 * @param {Object} options - Plugin options
 * @param {boolean} options.enableByDefault - Enable screen security by default (Android only)
 */
function withScreenSecurity(config, options = {}) {
  const { enableByDefault = false } = options;

  // Apply Android modifications
  config = withAndroidScreenSecurity(config, { enableByDefault });

  // Apply iOS modifications
  config = withIOSScreenSecurity(config, { enableByDefault });
  config = withIOSInfoPlist(config);

  return config;
}

module.exports = withScreenSecurity;
