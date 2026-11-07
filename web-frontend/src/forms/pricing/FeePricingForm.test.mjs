import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { zodResolver } from "@hookform/resolvers/zod";
import { feePricingSchema } from "../../validations/pricing/schemas.ts";
import { ApiError } from "../../services/http/errors.ts";

// Exercise the actual form handlers using the repository's existing VM renderer pattern.
// Services are in-memory fakes; these checks never update real pricing.
function harness(options = {}) {
  let values = {}, defaults = {}, tree, cursor = 0, changed = true, effects = [], submission;
  const slots = [], calls = [], toasts = [];
  const late = { small_vehicle_hourly_rate: 200, large_vehicle_hourly_rate: 300 };
  const delivery = { minimum_fee: 150, included_km: 1, per_km_rate: 25, garage_address: "Configured garage", garage_latitude: 14, garage_longitude: 121 };
  const form = {
    control: {}, formState: { errors: {}, isSubmitting: false },
    reset(next) { values = { ...next }; defaults = { ...next }; form.formState.errors = {}; changed = true; },
    setValue(name, value) { values[name] = value; changed = true; },
    setError(name, error) { form.formState.errors[name] = error; changed = true; },
    clearErrors() { form.formState.errors = {}; changed = true; },
    setFocus() {},
    handleSubmit(onValid, onInvalid) {
      return event => {
        event?.preventDefault();
        submission = (async () => {
          form.formState.isSubmitting = true;
          changed = true;
          try {
            const result = await zodResolver(feePricingSchema)({ ...values }, {}, { fields: {}, shouldUseNativeValidation: false });
            form.formState.errors = result.errors;
            if (Object.keys(result.errors).length) onInvalid();
            else await onValid(result.values);
          } finally { form.formState.isSubmitting = false; changed = true; }
        })();
        return submission;
      };
    },
  };
  const hooks = {
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; changed = true; }];
    },
    useEffect(effect, dependencies) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        slots[index] = { dependencies };
        effects.push(effect);
      }
    },
  };
  const element = (type, props) => typeof type === "function" ? type(props) : { type, props };
  const dependencies = {
    react: hooks, "react/jsx-runtime": { jsx: element, jsxs: element },
    "react-hook-form": { useForm: () => form, Controller: ({ name, render }) => render({
      field: { name, value: values[name], onChange: value => form.setValue(name, value), onBlur() {}, ref() {} },
      fieldState: { error: form.formState.errors[name] },
    }) },
    "@hookform/resolvers/zod": { zodResolver }, "lucide-react": { Settings2: "icon" },
    "@/components/common/forms/InputWithLabel": { InputWithLabel: "input" },
    "@/components/ui/button": { Button: "button" },
    "@/components/ui/card": { Card: "card", CardAction: "action", CardContent: "content", CardHeader: "header", CardTitle: "title" },
    "@/lib/toast": { appToast: Object.fromEntries(["success", "error", "info"].map(kind => [kind, message => toasts.push({ kind, message })])) },
    "@/services/http": { ApiError },
    "@/validations/pricing/schemas": { feePricingSchema },
    "@/services/booking/late-return-pricing.service": {
      getLateReturnPricing: async () => { if (options.loadError) throw options.loadError; return late; },
      saveLateReturnPricing: async input => { calls.push({ kind: "late", input: { ...input } }); if (options.saveLate) return options.saveLate(input); for (const key of Object.keys(late)) late[key] = Number(input[key]); return { ...late }; },
    },
    "@/services/delivery/delivery.service": {
      getDeliveryPricing: async () => delivery,
      saveDeliveryPricing: async input => { calls.push({ kind: "delivery", input: { ...input } }); if (options.saveDelivery) return options.saveDelivery(input, delivery); for (const key of ["minimum_fee", "included_km", "per_km_rate"]) delivery[key] = Number(input[key]); return { ...delivery }; },
    },
  };
  const exports = {};
  const source = readFileSync(new URL("./FeePricingForm.tsx", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require(name) { assert.ok(name in dependencies, `Missing fake: ${name}`); return dependencies[name]; },
  });
  const flatten = node => !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(flatten)];
  const text = node => typeof node === "string" || typeof node === "number" ? String(node) : !node || typeof node !== "object" ? "" : [node.props?.children].flat(Infinity).map(text).join("");
  const find = predicate => flatten(tree).find(predicate);
  const render = async () => {
    for (let pass = 0; pass < 20; pass++) {
      if (changed) { changed = false; cursor = 0; tree = exports.FeePricingForm(); }
      const pendingEffects = effects; effects = [];
      pendingEffects.forEach(effect => effect());
      for (let i = 0; i < 8; i++) await Promise.resolve();
      if (!changed && !effects.length) return tree;
    }
    throw new Error("Form did not settle");
  };
  return {
    render, calls, toasts, options,
    get values() { return { ...values }; }, get defaults() { return { ...defaults }; }, get errors() { return form.formState.errors; },
    input: name => find(node => node.type === "input" && node.props.id === name),
    button: label => find(node => node.type === "button" && text(node) === label),
    cardCount: () => flatten(tree).filter(node => node.type === "card").length,
    async configure() { find(node => node.type === "button" && text(node) === "Configure").props.onClick(); await render(); },
    async edit(name, value) { find(node => node.type === "input" && node.props.id === name).props.onChange({ target: { value } }); await render(); },
    async submit() { submission = undefined; find(node => node.type === "form").props.onSubmit({ preventDefault() {} }); await submission; await render(); },
    async cancel() { find(node => node.type === "button" && text(node) === "Cancel").props.onClick(); await render(); },
    setRaw: (name, value) => form.setValue(name, value),
  };
}

test("one card starts locked; Configure enables fields and Cancel restores confirmed values", async () => {
  const view = harness(); await view.render();
  assert.equal(view.cardCount(), 1);
  for (const name of Object.keys(view.values)) assert.equal(view.input(name).props.disabled, true);
  assert.equal(view.button("Save"), undefined);
  await view.configure();
  assert.equal(view.input("minimum_fee").props.disabled, false);
  await view.edit("minimum_fee", "175.25");
  await view.cancel();
  assert.equal(view.values.minimum_fee, "150");
  assert.equal(view.calls.length, 0);
  assert.ok(view.button("Configure"));
});

test("numeric typing and paste reject letters, signs and exponent notation", async () => {
  const view = harness(); await view.render(); await view.configure();
  for (const value of ["abc", "1e3", "-50", "+50", "1,000"]) {
    await view.edit("minimum_fee", value);
    assert.equal(view.values.minimum_fee, "150");
  }
  await view.edit("minimum_fee", "175.25");
  assert.equal(view.values.minimum_fee, "175.25");
});

test("all five fields validate before either endpoint is called", async () => {
  const view = harness(); await view.render(); await view.configure();
  await view.edit("small_vehicle_hourly_rate", "250");
  await view.edit("included_km", "1.0001");
  await view.submit();
  assert.equal(view.calls.length, 0);
  assert.match(view.errors.included_km.message, /three|3/);
  assert.equal(view.toasts.filter(toast => toast.kind === "error").length, 1);
  assert.ok(view.button("Save"));
});

test("successful updates lock the card and submit no garage fields", async () => {
  const view = harness(); await view.render(); await view.configure();
  await view.edit("small_vehicle_hourly_rate", "250"); await view.edit("minimum_fee", "175.25");
  await view.submit();
  assert.deepEqual(view.calls, [
    { kind: "late", input: { small_vehicle_hourly_rate: "250", large_vehicle_hourly_rate: "300" } },
    { kind: "delivery", input: { minimum_fee: "175.25", included_km: "1", per_km_rate: "25" } },
  ]);
  assert.equal(view.toasts.filter(toast => toast.kind === "success").length, 1);
  assert.ok(view.button("Configure"));
  assert.equal(view.input("minimum_fee").props.disabled, true);
});

test("a partial 422 save retains edits, maps errors and retries only the failed group", async () => {
  const view = harness({ saveDelivery: async () => { throw new ApiError("Validation", 422, { minimum_fee: ["Review the minimum fee."] }); } });
  await view.render(); await view.configure();
  await view.edit("small_vehicle_hourly_rate", "250"); await view.edit("minimum_fee", "175");
  await view.submit();
  assert.equal(view.values.minimum_fee, "175");
  assert.equal(view.defaults.minimum_fee, "150");
  assert.equal(view.defaults.small_vehicle_hourly_rate, "250");
  assert.equal(view.errors.minimum_fee.message, "Review the minimum fee.");
  assert.match(view.errors.root.message, /Late return rates saved/);
  assert.equal(view.toasts.filter(toast => toast.kind === "success").length, 0);
  assert.ok(view.button("Save"));
  view.options.saveDelivery = undefined;
  await view.submit();
  assert.deepEqual(view.calls.map(call => call.kind), ["late", "delivery", "delivery"]);
  assert.ok(view.button("Configure"));
});

test("Cancel after a partial save keeps confirmed rates and discards only unsaved edits", async () => {
  const view = harness({ saveDelivery: async () => { throw new Error("Offline"); } });
  await view.render(); await view.configure();
  await view.edit("small_vehicle_hourly_rate", "250"); await view.edit("minimum_fee", "175");
  await view.submit(); await view.cancel();
  assert.equal(view.values.small_vehicle_hourly_rate, "250");
  assert.equal(view.values.minimum_fee, "150");
  assert.ok(view.button("Configure"));
});

test("load failures keep Configure disabled", async () => {
  const view = harness({ loadError: new ApiError("Forbidden", 403) }); await view.render();
  assert.equal(view.button("Configure").props.disabled, true);
  assert.equal(view.input("minimum_fee"), undefined);
  assert.ok(view.button("Try again"));
  assert.equal(view.calls.length, 0);
});

test("Cancel refreshes authoritative values when a save response was lost", async () => {
  const view = harness({ saveDelivery: async (input, server) => { server.minimum_fee = Number(input.minimum_fee); throw new Error("Response lost after commit"); } });
  await view.render(); await view.configure(); await view.edit("minimum_fee", "175");
  await view.submit();
  assert.equal(view.defaults.minimum_fee, "150");
  await view.cancel();
  assert.equal(view.values.minimum_fee, "175");
  assert.equal(view.input("minimum_fee").props.disabled, true);
  assert.equal(view.calls.length, 1);
});

test("a pending save disables actions and ignores duplicate submissions", async () => {
  let finish;
  const view = harness({ saveLate: () => new Promise(resolve => { finish = resolve; }) });
  await view.render(); await view.configure();
  await view.edit("small_vehicle_hourly_rate", "250");
  const first = view.submit();
  await view.render();
  assert.equal(view.button("Saving...").props.disabled, true);
  assert.equal(view.button("Cancel").props.disabled, true);
  await view.submit();
  assert.equal(view.calls.length, 1);
  finish({ small_vehicle_hourly_rate: 250, large_vehicle_hourly_rate: 300 });
  await first;
  assert.ok(view.button("Configure"));
});
