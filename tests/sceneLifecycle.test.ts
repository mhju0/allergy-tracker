const { adoptSceneLifecycle, SCENE_MANIFEST } = require('../plugins/with-scene-lifecycle') as {
  adoptSceneLifecycle: (source: string) => string;
  SCENE_MANIFEST: Record<string, unknown>;
};

// The SDK 57 prebuild template creates the window in the app delegate, which
// iOS 27 rejects at launch (build 1 crashed in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption).
const { readFileSync } = jest.requireActual<{ readFileSync: (path: string, encoding: 'utf8') => string }>('node:fs');
const template = readFileSync('tests/fixtures/AppDelegate.sdk57.swift', 'utf8');

describe('scene lifecycle plugin', () => {
  test('the app delegate provides the React Native factory and no longer owns the window', () => {
    const patched = adoptSceneLifecycle(template);
    expect(patched).toContain('class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    expect(patched).toContain('reactNativeFactory = factory');
    expect(patched).not.toContain('UIWindow(frame: UIScreen.main.bounds)');
    expect(patched).not.toContain('factory.startReactNative(');
  });

  test('applying it twice changes nothing', () => {
    const once = adoptSceneLifecycle(template);
    expect(adoptSceneLifecycle(once)).toBe(once);
  });

  test('an unexpected app delegate fails the build instead of shipping a launch crash', () => {
    expect(() => adoptSceneLifecycle('class AppDelegate: UIResponder {}')).toThrow(/scene lifecycle/);
  });

  test('the scene manifest hands the window to Expo’s scene delegate', () => {
    expect(SCENE_MANIFEST).toEqual({
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
        }],
      },
    });
  });
});
