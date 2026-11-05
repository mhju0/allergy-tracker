const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Malformed-image regressions can loop forever; bound the fixture process.
if (process.argv[2] !== '--worker') {
  execFileSync(process.execPath, [__filename, '--worker'], { timeout: 30_000, stdio: 'inherit' });
  process.exit(0);
}

// Exercise the upstream callers whose transitive dependencies are overridden.
const routerRoot = path.dirname(require.resolve('expo-router/package.json'));
const { getStateFromPath } = require(path.join(routerRoot, 'build/react-navigation/core/getStateFromPath.js'));
const { getPathFromState } = require(path.join(routerRoot, 'build/react-navigation/core/getPathFromState.js'));
const screens = { screens: { food: 'food/:id' } };
const state = getStateFromPath('/food/egg?note=%EB%91%90%EB%93%9C%EB%9F%AC%EA%B8%B0&filter=safe&filter=reacted', screens);
assert.equal(state.routes[0].params.id, 'egg');
assert.equal(state.routes[0].params.note, '두드러기');
assert.deepEqual(state.routes[0].params.filter, ['safe', 'reacted']);
const roundTrip = getStateFromPath(getPathFromState(state, screens), screens);
assert.deepEqual(roundTrip.routes[0].params, { id: 'egg', note: '두드러기', filter: 'safe,reacted' });
assert.equal(getStateFromPath('/food/egg?note=%zz', screens).routes[0].params.note, '%zz');

const { getAssetSize } = require(path.join(path.dirname(require.resolve('metro/package.json')), 'src/Assets.js'));
const icon = fs.readFileSync(path.join(__dirname, '../assets/images/icon.png'));
const asset = getAssetSize('png', icon, 'icon.png');
assert.ok(asset.width > 0 && asset.height > 0);
const malformedIcns = Buffer.from('69636e73000000106963703000000000', 'hex');
assert.throws(() => getAssetSize('png', malformedIcns, 'malformed.icns'));

const expoRoot = path.dirname(require.resolve('expo/package.json'));
const cliRoot = path.dirname(require.resolve('@expo/cli/package.json', { paths: [expoRoot] }));
const { PluginSchema, DevToolsPluginOutputSchema } = require(path.join(cliRoot, 'build/src/start/server/DevToolsPlugin.schema.js'));
const { createMCPDevToolsExtensionSchema } = require(path.join(cliRoot, 'build/src/start/server/createMCPDevToolsExtensionSchema.js'));
const plugin = PluginSchema.parse({
  packageName: 'audit-plugin',
  packageRoot: '/audit/plugin',
  cliExtensions: {
    description: 'Compatibility fixture',
    entryPoint: 'index.js',
    commands: [{
      name: 'inspect', title: 'Inspect', environments: ['cli', 'mcp'],
      parameters: [{ name: 'limit', type: 'number' }],
    }],
  },
});
assert.equal(PluginSchema.safeParse({ ...plugin, packageName: '' }).success, false);
assert.equal(DevToolsPluginOutputSchema.safeParse([{ type: 'text', text: 'ok', level: 'info' }]).success, true);
assert.equal(DevToolsPluginOutputSchema.safeParse([{ type: 'text', text: 1, level: 'info' }]).success, false);
const commandSchema = createMCPDevToolsExtensionSchema(plugin);
assert.deepEqual(commandSchema.parse({ command: 'inspect', limit: 3 }), { command: 'inspect', limit: 3 });
assert.equal(commandSchema.safeParse({ command: 'unknown' }).success, false);
assert.equal(commandSchema.safeParse({ command: 'inspect', limit: 'three' }).success, false);
assert.equal(commandSchema.safeParse({ command: 'inspect', extra: true }).success, false);

// Every Expo tooling caller of glob must resolve a version with the abort fix.
const globParents = [
  require.resolve('@expo/config-plugins/package.json'),
  require.resolve('@expo/config/package.json', { paths: [expoRoot] }),
  require.resolve('@expo/fingerprint/package.json', { paths: [expoRoot] }),
  require.resolve('@expo/metro-config/package.json', { paths: [expoRoot] }),
  path.join(cliRoot, 'package.json'),
];
for (const parent of globParents) {
  const globPackage = require.resolve('glob/package.json', { paths: [path.dirname(parent)] });
  const [major, minor, patch] = require(globPackage).version.split('.').map(Number);
  assert.ok(major > 14 || (major === 14 && (minor > 0 || patch >= 2)), `${parent} resolves glob ${major}.${minor}.${patch}`);
}

// Expo fingerprint matches ignore paths with minimatch; it must have the globparts fix.
const fingerprintRoot = path.dirname(globParents[2]);
const minimatchVersion = require(require.resolve('minimatch/package.json', { paths: [fingerprintRoot] })).version;
const [mmMajor, mmMinor, mmPatch] = minimatchVersion.split('.').map(Number);
assert.ok(mmMajor > 11 || (mmMajor === 11 && (mmMinor > 0 || mmPatch >= 1)), `@expo/fingerprint resolves minimatch ${minimatchVersion}`);
const { isIgnoredPath, buildPathMatchObjects, buildDirMatchObjects } = require(path.join(fingerprintRoot, 'build/utils/Path.js'));
const { DEFAULT_IGNORE_PATHS } = require(path.join(fingerprintRoot, 'build/Options.js'));
const ignorePaths = [...DEFAULT_IGNORE_PATHS, '!ios/Pods/Keep/**'];
assert.equal(isIgnoredPath('ios/Pods/RNSVG/RNSVG.h', DEFAULT_IGNORE_PATHS), true);
assert.equal(isIgnoredPath('../../node_modules/x/ios/Pods/a.h', DEFAULT_IGNORE_PATHS), true);
assert.equal(isIgnoredPath('node_modules/expo-sqlite/ios/sqlite3.c', DEFAULT_IGNORE_PATHS), true);
assert.equal(isIgnoredPath('node_modules/expo-sqlite/ios/sqlite3.m', DEFAULT_IGNORE_PATHS), false);
assert.equal(isIgnoredPath('src/.hidden/.DS_Store', DEFAULT_IGNORE_PATHS), true);
assert.equal(isIgnoredPath('plugins/withNotifications.js', DEFAULT_IGNORE_PATHS), false);
assert.equal(isIgnoredPath('ios/Pods/Keep/a.h', ignorePaths), false);
assert.ok(buildDirMatchObjects(buildPathMatchObjects(ignorePaths)).some((matcher) => matcher.match('ios/build')));

const globFixture = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'glob-compat-'));
for (const dir of ['ios/AuditApp', 'ios/Pods']) {
  fs.mkdirSync(path.join(globFixture, dir), { recursive: true });
  fs.writeFileSync(path.join(globFixture, dir, 'Info.plist'), '');
}
const { IOSConfig } = require('@expo/config-plugins');
assert.deepEqual(IOSConfig.Paths.getAllInfoPlistPaths(globFixture), [path.join(globFixture, 'ios/AuditApp/Info.plist')]);
const { anyMatchAsync } = require(path.join(cliRoot, 'build/src/utils/glob.js'));

anyMatchAsync('ios/**/Info.plist', { cwd: globFixture, ignore: ['**/Pods/**'] }).then((matches) => {
  assert.deepEqual(matches, [path.normalize('ios/AuditApp/Info.plist')]);
  fs.rmSync(globFixture, { recursive: true, force: true });
  console.log('Dependency compatibility passed: routing, image assets, Expo plugin schemas, glob and minimatch callers.');
});
