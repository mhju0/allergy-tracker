// iOS 27 terminates an app built with the iOS 27 SDK at launch unless it
// adopts the scene-based life cycle. Expo SDK 57 ships ExpoAppSceneDelegate,
// but its prebuild template still creates the window in the app delegate.
// This mirrors the SDK 58 template: the app delegate only builds the React
// Native factory, and Expo's scene delegate creates the window and starts it.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const DECLARATION = 'class AppDelegate: ExpoAppDelegate {';
const PROVIDER_DECLARATION = 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';
const WINDOW_START = /\n#if os\(iOS\) \|\| os\(tvOS\)\n {4}window = UIWindow\(frame: UIScreen\.main\.bounds\)\n {4}factory\.startReactNative\([\s\S]*?\n#endif\n/;

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [{
      UISceneConfigurationName: 'Default Configuration',
      UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
    }],
  },
};

function adoptSceneLifecycle(source) {
  if (source.includes(PROVIDER_DECLARATION) && !WINDOW_START.test(source)) return source;
  if (!source.includes(DECLARATION) || !WINDOW_START.test(source)) {
    throw new Error('with-scene-lifecycle: AppDelegate.swift no longer matches the SDK 57 template; '
      + 'adopt the scene lifecycle by hand (see the expo-template-bare-minimum SDK 58 AppDelegate).');
  }
  return source
    .replace(DECLARATION, PROVIDER_DECLARATION)
    .replace(WINDOW_START, '\n    // ExpoAppSceneDelegate creates the window and starts React Native.\n');
}

const withSceneLifecycle = (config) => {
  config = withAppDelegate(config, (c) => {
    c.modResults.contents = adoptSceneLifecycle(c.modResults.contents);
    return c;
  });
  return withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return c;
  });
};

module.exports = withSceneLifecycle;
module.exports.adoptSceneLifecycle = adoptSceneLifecycle;
module.exports.SCENE_MANIFEST = SCENE_MANIFEST;
