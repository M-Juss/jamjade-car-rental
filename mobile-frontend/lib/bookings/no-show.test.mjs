import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: (name) => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  } });
  return exports;
}

test('no-show maps from Laravel and remains filterable without telematics or payment actions', () => {
  const { mapBooking } = load('../../services/api/booking.service.ts', { '@/services/http': { API_BASE_URL: 'https://example.test/api' } });
  const booking = mapBooking({ status: 'No-show', transmission: 'automatic', fuelType: 'gasoline', driverType: 'Self-Drive', cancellation: { kind: 'no_show', refundStatus: 'not_eligible', refundAmount: 0 } });
  assert.equal(booking.status, 'No-show');
  assert.equal(booking.cancellation.refundStatus, 'not_eligible');
  const helpers = load('./helpers.ts');
  assert.equal(helpers.matchesBookingStatus(booking, 'No-show'), true);
  assert.equal(helpers.matchesBookingStatus(booking, 'Confirmed'), false);
  assert.equal(helpers.isTelematicsEnabled(booking), false);
  const { getBookingActions } = load('../../components/bookings/booking-actions.ts', { 'lucide-react-native': {} });
  assert.equal(getBookingActions('No-show').map((action) => action.key).join(','), 'view_details');
});
