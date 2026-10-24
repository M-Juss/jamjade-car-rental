import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { ReceiptSaveUnavailableError } from './errors.ts';

function harness({ missing, granted = true, canAskAgain = true, grantOnRequest = true, captureFailure, copyFailure, saveFailure, targetReady = true } = {}) {
  const calls = [];
  const source = readFileSync(new URL('./save-receipt.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const view = { current: targetReady ? {} : null };
  class Directory {
    exists = false;
    create() { this.exists = true; calls.push('create directory'); }
    delete() { this.exists = false; calls.push('delete directory'); }
  }
  class File {
    constructor(parent) { this.uri = typeof parent === 'string' ? parent : 'file:///private-cache/test-receipt.jpg'; }
    copy(destination) {
      assert.equal(this.uri, 'file:///capture.jpg');
      assert.equal(destination.uri, 'file:///private-cache/test-receipt.jpg');
      calls.push('copy JPEG');
      if (copyFailure) throw copyFailure;
    }
  }
  vm.runInNewContext(compiled, {
    exports, Date, Error, Promise,
    require(name) {
      if (name === 'expo') return { requireOptionalNativeModule: (module) => module === missing ? null : {} };
      if (name === 'react-native') return {
        TurboModuleRegistry: { get: (module) => module === missing ? null : {} },
      };
      if (name === './errors') return { ReceiptSaveUnavailableError };
      if (name === '@/lib/payments/receipt') return { receiptFilename: () => 'test-receipt.jpg' };
      if (name === 'expo-file-system') { calls.push('load filesystem'); return { Directory, File, Paths: { cache: 'private-cache' } }; }
      if (name === 'react-native-view-shot') {
        calls.push('load capture');
        return {
          captureRef: async (ref, options) => {
            assert.equal(ref, view);
            assert.equal(options.format, 'jpg');
            assert.equal(options.result, 'tmpfile');
            assert.equal(options.quality, 0.95);
            assert.equal(options.width, 1080);
            assert.equal(options.height, 1620);
            calls.push('capture receipt JPEG');
            if (captureFailure) throw captureFailure;
            return 'file:///capture.jpg';
          },
          releaseCapture: (uri) => { assert.equal(uri, 'file:///capture.jpg'); calls.push('release capture'); },
        };
      }
      if (name === 'expo-media-library') {
        calls.push('load media library');
        return {
          getPermissionsAsync: async (writeOnly, granular) => {
            assert.equal(writeOnly, true);
            assert.equal(granular.length, 0);
            calls.push('check save permission');
            return { granted, canAskAgain };
          },
          requestPermissionsAsync: async (writeOnly, granular) => {
            assert.equal(writeOnly, true);
            assert.equal(granular.length, 0);
            calls.push('request save permission');
            return { granted: grantOnRequest, canAskAgain };
          },
          saveToLibraryAsync: async (uri) => {
            assert.equal(uri, 'file:///private-cache/test-receipt.jpg');
            calls.push('save to gallery');
            if (saveFailure) throw saveFailure;
          },
        };
      }
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { save: () => exports.saveReceiptJpeg({ id: 12 }, { view, width: 360, height: 540 }), calls };
}

test('outdated native builds fail safely before importing unavailable capture, gallery or filesystem modules', async () => {
  for (const missing of ['ExpoMediaLibrary', 'FileSystem', 'RNViewShot']) {
    const { save, calls } = harness({ missing });
    await assert.rejects(save, (error) => error instanceof ReceiptSaveUnavailableError && error.message.includes('Update JamJade'));
    assert.deepEqual(calls, []);
  }
});

test('denied permission never captures or saves private receipt content', async () => {
  const { save, calls } = harness({ granted: false, grantOnRequest: false });
  await assert.rejects(save, (error) => error instanceof ReceiptSaveUnavailableError && error.message.includes('Allow photo saving'));
  assert.equal(calls.includes('request save permission'), true);
  assert.equal(calls.includes('capture receipt JPEG'), false);
  assert.equal(calls.includes('save to gallery'), false);
});

test('blocked permission points to settings without requesting permission again', async () => {
  const { save, calls } = harness({ granted: false, canAskAgain: false });
  await assert.rejects(save, /phone settings/);
  assert.equal(calls.includes('request save permission'), false);
  assert.equal(calls.includes('capture receipt JPEG'), false);
});

test('a compatible build saves a real JPEG directly and cleans both temporary copies', async () => {
  const { save, calls } = harness();
  assert.equal(await save(), 'gallery');
  assert.deepEqual(calls.slice(3), ['check save permission', 'capture receipt JPEG', 'create directory', 'copy JPEG', 'save to gallery', 'delete directory', 'release capture']);
});

test('granting save-only permission continues the same save action', async () => {
  const { save, calls } = harness({ granted: false });
  assert.equal(await save(), 'gallery');
  assert.equal(calls.includes('request save permission'), true);
  assert.equal(calls.includes('save to gallery'), true);
});

test('an unmounted receipt never starts capture or saves to the gallery', async () => {
  const { save, calls } = harness({ targetReady: false });
  await assert.rejects(save, /not ready/);
  assert.equal(calls.includes('capture receipt JPEG'), false);
  assert.equal(calls.includes('save to gallery'), false);
});

test('capture failures do not create or save a receipt file', async () => {
  const failure = new Error('Capture unavailable');
  const { save, calls } = harness({ captureFailure: failure });
  await assert.rejects(save, (error) => error === failure);
  assert.equal(calls.includes('create directory'), false);
  assert.equal(calls.includes('save to gallery'), false);
});

test('copy and gallery failures still remove the temporary receipt images', async () => {
  for (const failurePoint of ['copyFailure', 'saveFailure']) {
    const failure = new Error('Save unavailable');
    const { save, calls } = harness({ [failurePoint]: failure });
    await assert.rejects(save, (error) => error === failure);
    assert.deepEqual(calls.slice(-2), ['delete directory', 'release capture']);
  }
});
