import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('./vehicle-image-source.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const assets = new Map();
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require(path) {
    assert.ok(existsSync(new URL(path, import.meta.url)), `Missing cutout: ${path}`);
    assets.set(path, assets.size + 1);
    return assets.get(path);
  },
});
const { getVehicleImageSource } = exports;

test('every original vehicle upload resolves to a distinct bundled transparent image', () => {
  const filenames = [...source.matchAll(/'([^']+\.jpg)': require/g)].map((match) => match[1]);
  assert.equal(filenames.length, 7);
  const resolved = filenames.map((filename) => getVehicleImageSource(`https://example.test/storage/vehicles/${filename}`));
  assert.equal(new Set(resolved).size, 7);
  assert.ok(resolved.every((value) => typeof value === 'number'));
  for (const [index, filename] of filenames.entries()) {
    assert.equal(getVehicleImageSource(`/storage/vehicles/${filename}?v=2#photo`), resolved[index]);
    assert.equal(getVehicleImageSource(`http://192.0.2.1:8000/storage/vehicles/${filename}`), resolved[index]);
  }
});

test('new uploads and gallery images keep their source; missing images stay missing', () => {
  for (const uri of ['https://example.test/storage/vehicles/replacement.jpg', '/storage/vehicles/gallery.png', 'file:///example.jpg']) {
    assert.equal(getVehicleImageSource(uri).uri, uri);
  }
  assert.equal(getVehicleImageSource(null), undefined);
  assert.equal(getVehicleImageSource(''), undefined);
  assert.equal(getVehicleImageSource(), undefined);
});
