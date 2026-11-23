import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, dependencies) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require(name) {
    if (name === 'lucide-react') return {};
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports;
}
const registry = load('./module-registry.ts', {});
const visible = (portal, permissions) => Array.from(registry.managementModulesForPortal(portal, new Set(permissions)), module => module.id);

test('technical Admin sees monitoring and research without business modules', () => {
  assert.deepEqual(visible('admin', ['view dashboard', 'view fleet tracker', 'view driving analysis', 'manage geofences', 'view research', 'view activity log']),
    ['errors', 'dashboard', 'geofences', 'fleetTracker', 'drivingAnalysis', 'research', 'modelExplorer', 'driveMonitoring']);
});

test('Owner sees business controls without inheriting research from the admin route', () => {
  const modules = visible('admin', ['view dashboard', 'manage bookings', 'manage vehicles', 'manage maintenance', 'review documents', 'view reports', 'view personnel', 'manage delivery pricing', 'view activity log']);
  assert.ok(modules.includes('personnel') && modules.includes('deliveryPricing') && modules.includes('bookings'));
  assert.ok(!modules.includes('research') && !modules.includes('modelExplorer'));
  assert.deepEqual(visible('admin', []), []);
});

test('Staff sees verified-edit pricing and Driver directory without technical administration', () => {
  const modules = visible('staff', ['view dashboard', 'manage bookings', 'manage vehicles', 'manage maintenance', 'review documents', 'view reports', 'view personnel', 'manage delivery pricing']);
  assert.ok(modules.includes('deliveryPricing') && modules.includes('personnel'));
  assert.ok(!modules.includes('research') && !modules.includes('errors'));
  assert.equal(registry.managementPath('staff', 'deliveryPricing'), '/staff/delivery-pricing');
});

test('Owner-only accounts and technical Admins use the shared portal while Staff retains its portal', () => {
  const auth = load('../../../../services/auth/auth.service.ts', {
    '@/services/http': {}, '@/modules/management/shell/config/module-registry': registry,
  });
  assert.equal(auth.getDashboardPathForUser({ roles: ['owner'], permissions: ['view dashboard'] }), '/admin');
  assert.equal(auth.getDashboardPathForUser({ roles: ['admin'], permissions: ['view dashboard'] }), '/admin');
  assert.equal(auth.getDashboardPathForUser({ roles: ['staff'], permissions: ['view dashboard'] }), '/staff');
  assert.equal(auth.getDashboardPathForUser({ roles: ['customer'], permissions: [] }), '/login');
});
