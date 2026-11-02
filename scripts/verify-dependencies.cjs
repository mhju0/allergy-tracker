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

console.log('Dependency compatibility passed: routing, image assets, Expo plugin schemas.');
