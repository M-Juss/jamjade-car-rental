import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { ApiError } from '../../services/http/errors.ts';

// Exercise the real hook with controlled time and lifecycle; no network requests.
function harness(availableAt) {
  let cursor = 0, now = Date.parse('2026-11-18T00:00:00Z'), nextTimer = 0;
  const slots = [], effects = [], timers = new Map();
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useCallback(callback) { return callback; },
    useEffect(effect, dependencies) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        previous?.cleanup?.();
        slots[index] = { dependencies };
        effects.push(() => { slots[index].cleanup = effect(); });
      }
    },
  };
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(new URL('./useRetryCooldown.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports,
    Date: class extends Date { static now() { return now; } },
    setInterval(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearInterval(id) { timers.delete(id); },
    require(name) {
      if (name === 'react') return hooks;
      if (name === '@/services/http/errors') return { ApiError };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return {
    render(nextAvailableAt = availableAt) {
      availableAt = nextAvailableAt;
      cursor = 0;
      const result = exports.useRetryCooldown(availableAt);
      while (effects.length) effects.shift()();
      return result;
    },
    advance(seconds) { now += seconds * 1000; for (const callback of [...timers.values()]) callback(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    get timers() { return timers.size; },
  };
}

test('uses the server retry duration and expires after suspended timers catch up', () => {
  const h = harness();
  assert.equal(h.render().seconds, 0);
  assert.equal(h.render().handleError(new ApiError('Wait', 429, undefined, 42)), true);
  assert.equal(h.render().seconds, 42);
  h.advance(41);
  assert.equal(h.render().seconds, 1);
  h.advance(120);
  assert.equal(h.render().seconds, 0);
  assert.equal(h.timers, 0);
});

test('keeps an existing resend deadline when the server returns a shorter wait', () => {
  const h = harness('2026-11-18T00:01:00Z');
  assert.equal(h.render().seconds, 60);
  h.render().handleError(new ApiError('Wait', 429, undefined, 10));
  assert.equal(h.render().seconds, 60);
  h.advance(61);
  assert.equal(h.render().seconds, 0);
});

test('a longer hourly wait takes precedence over the ordinary resend delay', () => {
  const h = harness('2026-11-18T00:01:00Z');
  h.render().handleError(new ApiError('Wait', 429, undefined, 3500));
  assert.equal(h.render().seconds, 3500);
  h.advance(60);
  assert.equal(h.render().seconds, 3440);
});

test('validation and connection failures remain retryable without a cooldown', () => {
  const h = harness();
  for (const status of [0, 408, 422, 503]) {
    assert.equal(h.render().handleError(new ApiError('Failure', status)), false);
    assert.equal(h.render().seconds, 0);
  }
  assert.equal(h.render().handleError(new Error('Failure')), false);
  assert.equal(h.render().handleError(new ApiError('Wait', 429)), true);
  assert.equal(h.render().seconds, 60);
});

test('verification and resend waits are independent and timers clean up on unmount', () => {
  const resend = harness(), verify = harness();
  resend.render().start(60);
  assert.equal(resend.render().seconds, 60);
  assert.equal(verify.render().seconds, 0);
  verify.render().start(42);
  verify.render();
  resend.unmount();
  verify.unmount();
  assert.equal(resend.timers, 0);
  assert.equal(verify.timers, 0);
});
