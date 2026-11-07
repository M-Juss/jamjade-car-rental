import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as zod from "zod";

function load(file, dependencies) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => {
    assert.ok(name in dependencies, `Unconfigured dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const schema = load("../../validations/research/annotations.ts", { zod });
const metadata = load("../../components/common/data-display/MetadataList.tsx", {
  "react/jsx-runtime": jsx, "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(' ') },
});
const timeline = load("../../modules/management/research/components/ReviewTimelineContext.tsx", {
  react: React, "react/jsx-runtime": jsx,
  "../review-workflow": load("../../modules/management/research/review-workflow.ts", {}),
});
const interval = (start, end, movement = "stationary") => ({ start_ms: start, end_ms: end, movement,
  direction: "not_applicable", severity: "not_applicable", certainty: "uncertain", source: "operator_report", notes: "" });

// A structural field-array update changes its rows before the watch subscription
// publishes. Exercise the actual form renderer during that intermediate render.
function harness(current, watched, protocolCode) {
  const handlers = new Map();
  const form = { control: {}, formState: { errors: {}, isSubmitting: false, isDirty: true },
    getValues: name => { assert.equal(name, "intervals"); return current; },
    handleSubmit: () => () => {}, register: () => ({}),
  };
  const array = {
    get fields() { return current.map((row, i) => ({ ...row, id: `row-${i}` })); },
    insert: (index, value) => current.splice(index, 0, value),
    remove: index => current.splice(index, 1),
    replace: values => { current.splice(0, current.length, ...values); },
  };
  const empty = () => null;
  const dependencies = {
    react: React, "react/jsx-runtime": jsx,
    "react-hook-form": { useForm: () => form, useFieldArray: () => array, useWatch: () => watched },
    "@hookform/resolvers/zod": { zodResolver: empty },
    "@/components/ui/button": { Button: ({ children, onClick, disabled, type, ...props }) => {
      handlers.set(props["aria-label"] ?? children, onClick);
      return React.createElement("button", { type, disabled }, children);
    } },
    "@/components/common/forms/InputWithLabel": { InputWithLabel: empty },
    "@/components/common/forms/SelectWithLabel": { SelectWithLabel: empty },
    "@/components/common/forms/TextAreaWithLabel": { TextAreaWithLabel: empty },
    "@/components/common/tables/TablePagination": { TablePagination: empty },
    "@/lib/table-pagination": { TABLE_PAGE_SIZE: 10 },
    "@/components/common/forms/FormFieldError": { FormFieldError: empty },
    "@/components/common/data-display/MetadataList": metadata,
    "@/modules/management/research/components/ReviewTimelineContext": timeline,
    "@/lib/toast": { appToast: {} }, "@/services/http": { ApiError: class extends Error {} },
    "@/services/research/annotations.service": { saveAnnotations: empty },
    "@/validations/research/annotations": schema,
    "@/modules/management/research/components/NativeSignalWindow": {
      NativeSignalWindow: ({ children }) => children([{ events: [] }], [0, 5000]),
    },
    "@/modules/management/research/components/SignalTimeline": { SignalTimeline: empty },
    "@/modules/management/research/components/SignalSelectionControls": { SignalSelectionControls: empty },
    "@/modules/management/research/lt-interval-suggestions": { suggestLtIntervals: () => ({ available: false }), LT_TIMING_VERSION: "lt-intervals-v1" },
    "@/modules/management/research/fss-interval-suggestions": { suggestFssIntervals: () => ({ available: false }), overlapsLabel: () => false, FSS_TIMING_VERSION: "fss-intervals-v1" },
    "@/modules/management/research/native-analysis": { nativeSignalPoints: () => [] },
    "@/modules/management/research/recording-analysis": { seconds: ms => `${ms / 1000}s`, humanize: value => value },
  };
  const { AnnotationForm } = load("./AnnotationForm.tsx", dependencies);
  const render = () => renderToStaticMarkup(React.createElement(AnnotationForm, {
    protocolCode, record: { id: "synthetic", duration_ms: 5000 }, origin: "0", saved: null, onSaved: empty, onReload: empty,
  }));
  return { render, handlers };
}

test("adding the first label renders before the watch subscription catches up", () => {
  const current = [];
  const view = harness(current, []);
  assert.match(view.render(), /No labeled intervals yet/);
  view.handlers.get("Label selected interval")();
  assert.equal(current.length, 1);
  assert.match(view.render(), /0s–5s/);
});

test("inserting a label between existing rows renders current times in order", () => {
  const first = interval(0, 1000), middle = interval(1000, 2000), last = interval(2000, 3000);
  const html = harness([first, middle, last], [first, last]).render();
  assert.ok(html.indexOf("0s–1s") < html.indexOf("1s–2s"));
  assert.ok(html.indexOf("1s–2s") < html.indexOf("2s–3s"));
});

test("removing a label does not display the old watched row under the surviving row", () => {
  const first = interval(0, 1000), last = interval(2000, 3000);
  const current = [first, last];
  const view = harness(current, [...current]);
  view.render();
  view.handlers.get("Remove interval 1 from draft")();
  const html = view.render();
  assert.doesNotMatch(html, /0s–1s/);
  assert.match(html, /2s–3s/);
});

test("sorting and clearing drafts render the current array despite stale watched values", () => {
  const first = interval(0, 1000), last = interval(2000, 3000);
  const current = [last, first];
  const view = harness(current, [...current]);
  view.render();
  view.handlers.get("Sort by time")();
  const sorted = view.render();
  assert.ok(sorted.indexOf("0s–1s") < sorted.indexOf("2s–3s"));
  current.splice(0);
  assert.match(view.render(), /No labeled intervals yet/);
  assert.doesNotMatch(view.render(), /2s–3s/);
});

test("resetting to saved intervals displays the new snapshot rather than the previous draft", () => {
  const html = harness([interval(3000, 4000, "braking")], [interval(0, 1000)]).render();
  assert.match(html, /3s–4s/);
  assert.match(html, /braking/);
  assert.doesNotMatch(html, /0s–1s/);
});


test("only FSS and LT expose timestamp suggestions; manual additions keep unknown judgments", () => {
  for (const code of ["FSS", "LT"]) assert.match(harness([], [], code).render(), /Suggest intervals/);
  for (const code of [undefined, "FR", "RSS", "HA", "HB", "RT", "SW"]) assert.doesNotMatch(harness([], [], code).render(), /Suggest intervals/);
  const current = [], view = harness(current, [], "FSS");
  view.render(); view.handlers.get("Label selected interval")();
  assert.equal(current[0].movement, "other");
  assert.equal(current[0].direction, "unknown");
  assert.equal(current[0].severity, "unknown");
  assert.equal(current[0].certainty, "uncertain");
  assert.equal(current[0].source, "signal_review");
});
