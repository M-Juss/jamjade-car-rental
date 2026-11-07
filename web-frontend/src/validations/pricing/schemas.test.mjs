import assert from "node:assert/strict";
import test from "node:test";
import { feePricingSchema } from "./schemas.ts";

const valid = { small_vehicle_hourly_rate: "200", large_vehicle_hourly_rate: "300", minimum_fee: "150", included_km: "1", per_km_rate: "25" };

test("all pricing fields are required decimal numbers", () => {
  assert.equal(feePricingSchema.safeParse(valid).success, true);
  for (const key of Object.keys(valid)) for (const value of ["", " ", "abc", "1e2", "0x10", "1,000", "NaN", "Infinity", "-1", "."]) {
    assert.equal(feePricingSchema.safeParse({ ...valid, [key]: value }).success, false, `${key}: ${value}`);
  }
});

test("fee and distance precision follows the Laravel requests", () => {
  for (const key of Object.keys(valid)) {
    const places = key === "included_km" ? 3 : 2;
    assert.equal(feePricingSchema.safeParse({ ...valid, [key]: `1.${"1".repeat(places)}` }).success, true);
    assert.equal(feePricingSchema.safeParse({ ...valid, [key]: `1.${"1".repeat(places + 1)}` }).success, false);
    assert.equal(feePricingSchema.safeParse({ ...valid, [key]: "1000000" }).success, true);
    assert.equal(feePricingSchema.safeParse({ ...valid, [key]: "1000000.01" }).success, false);
  }
});

test("late rates stay positive while delivery values may be zero", () => {
  for (const key of ["small_vehicle_hourly_rate", "large_vehicle_hourly_rate"]) {
    assert.equal(feePricingSchema.safeParse({ ...valid, [key]: "0" }).success, false);
    assert.equal(feePricingSchema.safeParse({ ...valid, [key]: "0.01" }).success, true);
  }
  assert.equal(feePricingSchema.safeParse({ ...valid, minimum_fee: "0", included_km: "0", per_km_rate: "0" }).success, true);
  assert.equal(feePricingSchema.safeParse({ ...valid, minimum_fee: ".5", included_km: "1.", per_km_rate: " 25 " }).success, true);
});
