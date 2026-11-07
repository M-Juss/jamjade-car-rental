import assert from 'node:assert/strict';
import test from 'node:test';
import { recordingPresentation } from './recording-presentation.ts';

test('recording number comes first and saved group numbers are shortened', () => {
  const input = Object.freeze({ name: 'Tiles - Level - Group 01 · Recording 031', surface: 'Tiles' });
  assert.deepEqual(recordingPresentation(input), {
    title: 'R031', metadata: [
      { label: 'Group', value: 'G1' }, { label: 'Surface', value: 'Tiles' }, { label: 'Slope', value: 'Level' },
    ],
  });
  assert.equal(input.name, 'Tiles - Level - Group 01 · Recording 031');
});

test('numbering gaps and numbers longer than three digits are retained', () => {
  assert.equal(recordingPresentation({ name: 'Tiles - Level - Group 12 · Recording 037' }).title, 'R037');
  assert.equal(recordingPresentation({ name: 'Tiles - Level - Group 12 · Recording 1000' }).title, 'R1000');
});

test('custom group names and hyphenated surfaces remain readable', () => {
  assert.deepEqual(recordingPresentation({ name: 'Morning trial · Recording 002', surface: 'Concrete' }), {
    title: 'R002', metadata: [{ label: 'Group', value: 'Morning trial' }, { label: 'Surface', value: 'Concrete' }],
  });
  assert.deepEqual(recordingPresentation({ name: 'Tiles - coarse - Uphill - Group 02 · Recording 003' }).metadata,
    [{ label: 'Group', value: 'G2' }, { label: 'Surface', value: 'Tiles - coarse' }, { label: 'Slope', value: 'Uphill' }]);
});

test('research session/exercise codes are retained as supporting information', () => {
  const result = recordingPresentation({ name: 'Tiles - Level - Group 01 · Recording 031', displayCode: 'S03-FSS-R031' });
  assert.equal(result.title, 'R031');
  assert.deepEqual(result.metadata.at(-1), { label: 'Code', value: 'S03-FSS-R031' });
});

test('ungrouped and malformed names are preserved without inventing group identities', () => {
  for (const name of ['Manual trial', 'Tiles - Level - Group 01 · Recording 000', 'Tiles - Level - Group 01 · Recording 1234567890']) {
    assert.deepEqual(recordingPresentation({ name }), { title: name, metadata: [] });
  }
  assert.deepEqual(recordingPresentation({ name: 'Manual trial', displayCode: 'S03-FSS-R031' }), { title: 'S03-FSS-R031', metadata: [] });
});
