import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('./useTelematicsHandover.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness() {
  class ApiError extends Error {
    constructor(status) {
      super('Request failed');
      this.status = status;
    }
  }
  const released = { bookingCode: 'BK-TEST', eligibility: { state: 'released' } };
  let read = async () => released;
  let focus;
  let index = 0;
  const states = [];
  const refs = [];
  const exports = {};
  const dependencies = {
    react: {
      useState(initial) {
        const key = index++;
        if (!(key in states)) states[key] = initial;
        return [states[key], value => { states[key] = value; }];
      },
      useRef(initial) {
        const key = index++;
        return refs[key] ??= { current: initial };
      },
      useCallback: callback => callback,
    },
    '@react-navigation/native': { useFocusEffect: callback => { focus = callback; } },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '@/providers/AuthProvider': { useAuth: () => ({ user: { id: 7 } }) },
    '@/services/api': {
      getBookingTelematicsSetup: () => read(),
      getBooking: async () => ({}),
    },
    '@/services/http': { ApiError },
    '@/services/telematics/setup-workflow': {},
    '@/services/telematics/calibration-workflow': {},
  };
  vm.runInNewContext(compiled, {
    exports, setInterval: () => 0, clearInterval() {},
    require: name => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    },
  });
  const render = () => { index = 0; return exports.useTelematicsHandover('BK-TEST'); };
  render();
  focus();
  return {
    released, render,
    refreshWith: async failure => {
      read = async () => {
        if (failure) throw failure === 'offline' ? new Error('Network request failed') : new ApiError(failure);
        return released;
      };
      await render().refresh();
      return render();
    },
  };
}

test('a transient handover failure retains the released rental and does not signal access loss', async () => {
  const h = harness();
  await h.refreshWith();
  for (const failure of ['offline', 503]) {
    const offline = await h.refreshWith(failure);
    assert.equal(offline.handover, h.released);
    assert.equal(offline.accessLost, false);
    assert.match(offline.loadError, /could not be refreshed/);
  }
  assert.equal((await h.refreshWith()).loadError, null);
});

test('a definitive denial clears cached rental details and signals access loss', async () => {
  const h = harness();
  for (const status of [401, 403, 404]) {
    await h.refreshWith();
    const denied = await h.refreshWith(status);
    assert.equal(denied.handover, null);
    assert.equal(denied.accessLost, true);
  }
});
