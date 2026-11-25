import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
const source = ts.transpileModule(readFileSync(new URL('./OperatorsNeedingAttention.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const jsx = (type, props) => ({ type, props });
vm.runInNewContext(source, { exports, require(name) {
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
  if (name === 'lucide-react') return { Eye: 'Eye' };
  if (name === '@/components/common/tables/ManagementTable') return { ManagementTable: 'Table', ManagementTableCell: 'Cell', TableCard: 'Card' };
  if (name === '@/components/common/tables/TablePagination') return { TablePagination: 'Pagination' };
  if (name === '@/components/ui/button') return { Button: 'Button' };
  if (name === '@/components/ui/table') return { TableBody: 'Body', TableHead: 'Head', TableHeader: 'Header', TableRow: 'Row' };
  throw new Error(`Unexpected dependency: ${name}`);
} });

function nodes(node) {
  if (node == null || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function content(node) {
  if (node == null) return '';
  if (Array.isArray(node)) return node.map(content).join('');
  return typeof node === 'object' ? content(node.props?.children) : String(node);
}

test('attention records preserve operator identity for View and retain grade count and sync context', () => {
  const operator = { id: 7, name: 'Test Operator', operator_type: 'driver', average_score: 58, monitored_rentals: 1,
    latest_score: 58, harsh_events: 16, incomplete_grades: 1, latest_sync_incomplete: true };
  const views = [];
  const pages = [];
  const tree = exports.OperatorsNeedingAttention({ data: { threshold: 70, operators: [operator], page: 1, lastPage: 2, total: 11 },
    onView: (...args) => views.push(args), onPageChange: page => pages.push(page) });
  const text = content(tree);
  assert.match(text, /Operators needing attention \(Below 70\)/);
  assert.match(text, /Driver/);
  assert.match(text, /58\.0 \/ 100/);
  assert.match(text, /1 with incomplete sync/);
  const button = nodes(tree).find(node => node.type === 'Button');
  assert.equal(button.props['aria-label'], 'View rentals for Test Operator');
  const trigger = {};
  button.props.onClick({ currentTarget: trigger });
  assert.equal(views[0][0], operator);
  assert.equal(views[0][1], trigger);
  nodes(tree).find(node => node.type === 'Pagination').props.onPageChange(2);
  assert.deepEqual(pages, [2]);
});

test('empty attention results state the grade threshold without inventing low scores', () => {
  const tree = exports.OperatorsNeedingAttention({ data: { threshold: 70, operators: [], page: 1, lastPage: 1, total: 0 } });
  assert.match(content(tree), /No graded operators below 70 \/ 100 in this period/);
  assert.equal(nodes(tree).some(node => node.type === 'Button'), false);
});
