import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(file, dependencies = {}) {
  const exports = {};
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    // Imported modules share one Error constructor in the application runtime.
    { exports, Error, require: name => { if (name in dependencies) return dependencies[name]; throw Error(name); } });
  return exports;
}
const base = load("./recording-analysis.ts");
const native = load("./native-analysis.ts", { "./recording-analysis": base });
const { nativeSignalPoints, nativeIntervalStats } = native;
const stationary = load("./stationary-reference.ts", { "./native-analysis": native });
const { stationaryReferencePreview } = stationary;
const forward = load("./forward-reference.ts", { "./stationary-reference": stationary });
const { forwardReferencePreview } = forward;
const { suggestForwardIntervals } = load("./reference-suggestions.ts", { "./stationary-reference": stationary, "./forward-reference": forward });
const { vehicleAxisPreview, vehicleAxisIntervalStats } = load("./vehicle-axis-preview.ts", { "./stationary-reference": stationary, "./native-analysis": native });
const synchronized = load("./synchronization-preview.ts", { "./stationary-reference": stationary });
const { synchronizationPreview, synchronizationCounts } = synchronized;
const { butterworthCoefficients, lowPassPreview, filterComparison } = load("./filter-preview.ts", { "./synchronization-preview": synchronized });
const origin = "9007199254741001";
const event = (offset, values = [1, 2, 3]) => ({ sensor_timestamp_ns: String(BigInt(origin) + BigInt(offset)), values });

test("native display subtracts integer nanoseconds before converting relative time", () => {
  const points = nativeSignalPoints([event(1), event(20000001)], origin);
  assert.equal(points[0].time, 0.000001);
  assert.equal(points[1].time, 20.000001);
});
test("long gaps and backward/duplicate timestamps break lines without deleting originals", () => {
  const events = [event(0), event(20000000), event(600000000), event(600000000), event(590000000)];
  const points = nativeSignalPoints(events, origin);
  assert.equal(points.filter(p => p.x !== null).length, events.length);
  assert.equal(points.filter(p => p.x === null).length, 3);
});
test("stationary interval variation excludes missing points and retains gravity in means", () => {
  const points = nativeSignalPoints([event(0, [1, 0, 9.8]), event(20000000, [3, 0, 9.8]), event(600000000, [100, 0, 9.8])], origin);
  const stats = nativeIntervalStats(points, 0, 20);
  assert.equal(stats.count, 2);
  assert.equal(stats.mean[0], 2);
  assert.equal(stats.mean[2], 9.8);
  assert.equal(stats.std[0], 1);
  assert.equal(stats.std[2], 0);
  assert.equal(nativeIntervalStats(points, 100, 200), null);
});

const stream = (values, count = 251, offset = 0) => Array.from({ length: count }, (_, sequence) => Object.freeze({
  ...event(sequence * 20000000 + offset, values), sequence,
}));
const preview = (accel = stream([0, 0, 9.81]), gyro = stream([0.001, -0.002, 0.003]), start = 0, end = 5000) => stationaryReferencePreview(accel, gyro, origin, start, end);
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test("tilted stationary reference preserves magnitude, estimates up and residual gyro offset without modifying originals", () => {
  const accel = Object.freeze(stream([4.905, 0, 9.81 * Math.sqrt(3) / 2]));
  const gyro = Object.freeze(stream([0.001, -0.002, 0.003], 250, 10000000));
  const result = preview(accel, gyro);
  assert.equal(result.available, true);
  close(result.magnitude, 9.81);
  close(result.upUnit[0], 0.5);
  close(result.upUnit[2], Math.sqrt(3) / 2);
  close(result.gyroscope.mean[1], -0.002);
  close(result.acceleration.std[0], 0);
  close(result.directionChangeDegrees, 0, 0.00001);
  assert.equal(result.acceleration.count, 251);
  assert.equal(result.gyroscope.count, 250);
  assert.equal(result.gyroscope.leadingGapMs, 10);
  assert.equal(result.gyroscope.trailingGapMs, 10);
  assert.equal(accel[0].values[0], 4.905);
  assert.equal(result.forward, undefined);
});

test("reference uses only the selected original interval and reports unfilled gaps", () => {
  const accel = stream([0, 0, 9.81]);
  accel[0] = { ...accel[0], sensor_timestamp_ns: event(-1000000).sensor_timestamp_ns, values: [100, 100, 100] };
  // Consecutive callback sequences can still have a sensor-delivery time gap.
  for (let i = 125; i < accel.length; i++) accel[i] = { ...accel[i], sensor_timestamp_ns: event((i * 20 + 2000) * 1e6).sensor_timestamp_ns };
  const result = preview(accel, stream([0, 0, 0]), 0, 7000);
  assert.equal(result.available, true);
  close(result.acceleration.mean[2], 9.81);
  assert.equal(result.acceleration.count, 250);
  assert.equal(result.acceleration.largestGapMs, 2020);
  assert.equal(result.acceleration.leadingGapMs, 20);
  assert.equal(result.gyroscope.trailingGapMs, 2000);
});

test("reference rejects short intervals, missing channels and unusable zero gravity", () => {
  assert.match(preview(undefined, undefined, 0, 4999).reason, /5 seconds/);
  assert.match(preview([], []).reason, /at least two/);
  assert.match(preview(stream([0, 0, 9.81]), []).reason, /Gyroscope/);
  assert.match(preview(stream([0, 0, 0])).reason, /no usable direction/);
  assert.equal(preview(undefined, undefined, NaN, 5000).available, false);
});

test("reference refuses timestamp anomalies, sequence loss and nonfinite readings instead of repairing them", () => {
  for (const replacement of [
    item => ({ ...item, sensor_timestamp_ns: event(0).sensor_timestamp_ns }),
    item => ({ ...item, sensor_timestamp_ns: event(1).sensor_timestamp_ns }),
    item => ({ ...item, sequence: 20 }),
    item => ({ ...item, values: [NaN, 0, 9.81] }),
    item => ({ ...item, values: [0, 9.81] }),
  ]) {
    const accel = stream([0, 0, 9.81]);
    accel[2] = replacement(accel[2]);
    assert.equal(preview(accel).available, false);
  }
  const malformed = stream([0, 0, 0]);
  malformed[1] = { ...malformed[1], sensor_timestamp_ns: "bad" };
  assert.match(preview(stream([0, 0, 9.81]), malformed).reason, /timestamps could not/);
});

test("first versus second half direction change exposes an orientation change without declaring stillness", () => {
  const accel = stream([0, 0, 9.81]);
  for (let i = 125; i < accel.length; i++) accel[i] = { ...accel[i], values: [9.81, 0, 0] };
  const result = preview(accel);
  assert.equal(result.available, true);
  close(result.directionChangeDegrees, 90);
  assert.equal(result.stationary, undefined);
});

const dot3 = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross3 = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const normalize3 = v => v.map(value => value / Math.hypot(...v));
const phaseRanges = { rest: [0, 2000], starting: [2100, 3100], stopping: [3200, 4200] };
function syntheticForward() {
  const up = normalize3([0.2, 0.1, 1]);
  const top = normalize3([0,1,0].map((v,i) => v-up[1]*up[i]));
  const baseRight = cross3(top,up);
  const theta = 25 * Math.PI / 180;
  const forward = top.map((v,i) => v*Math.cos(theta)+baseRight[i]*Math.sin(theta));
  const right = cross3(forward,up);
  const accel = Array.from({length:251},(_,sequence) => {
    const ms=sequence*20;
    const start = ms>=2100 && ms<=3100;
    const stop = ms>=3200 && ms<=4200;
    const force = start ? 1+0.4*Math.sin(2*Math.PI*(ms-2100)/1000) : stop ? -1-0.4*Math.sin(2*Math.PI*(ms-3200)/1000) : 0;
    return Object.freeze({...event(ms*1e6, up.map((v,i) => 9.81*v + force*forward[i] + (stop ? 0.15*right[i] : 0))), sequence});
  });
  const gyro=stream([0.001,0.002,0.003]);
  return {accel,gyro,up,forward,right};
}
const forwardScan = (accel, gyro, ranges=phaseRanges, bounds=[0,5000]) => forwardReferencePreview(accel,gyro,origin,ranges,bounds);

test("forward PCA recovers a tilted axis and right-handed RFU matrix while retaining original readings", () => {
  const {accel,gyro,up,forward,right}=syntheticForward();
  const result=forwardScan(Object.freeze(accel),Object.freeze(gyro));
  assert.equal(result.available,true);
  for(let i=0;i<3;i++) {
    close(result.up[i],up[i]); close(result.forward[i],forward[i]); close(result.right[i],right[i]);
  }
  close(result.angleFromPhoneTop,25,1e-7);
  close(dot3(result.rotationRfu[0],cross3(result.rotationRfu[1],result.rotationRfu[2])),1);
  close(result.phases[1].forwardMean,1);
  close(result.phases[2].forwardMean,-1);
  close(result.phases[2].rightMean,0.15);
  close(result.stopOppositionDegrees,Math.atan(0.15)*180/Math.PI,1e-7);
  close(result.varianceShare,1);
  close(result.phases[1].upRotationRms,0);
  assert.match(result.warnings.join(' '),/short pilot/);
  assert.equal(result.approved,undefined);
});

test("forward preview rejects overlapping/out-of-order/short/out-of-window references", () => {
  const {accel,gyro}=syntheticForward();
  for (const ranges of [
    {...phaseRanges,rest:[0,2200]}, {...phaseRanges,stopping:[2200,3000]},
    {...phaseRanges,starting:[2100,2200]}, {...phaseRanges,rest:[-1,2000]},
    {...phaseRanges,stopping:[3200,6000]}, {...phaseRanges,rest:[0,NaN]},
  ]) assert.equal(forwardScan(accel,gyro,ranges).available,false);
  assert.equal(forwardScan(accel,gyro,phaseRanges,[NaN,5000]).available,false);
  assert.equal(forwardScan(accel,gyro,phaseRanges,[0,40000]).available,false);
});

test("forward preview refuses missing channels, broken sequences and degenerate covariance", () => {
  const {accel,gyro}=syntheticForward();
  assert.equal(forwardScan(accel,[]).available,false);
  const gap=accel.map((value,i) => i===120 ? {...value,sequence:999} : value);
  assert.match(forwardScan(gap,gyro).reason,/sequence gap/);
  assert.match(forwardScan(stream([0,0,9.81]),gyro).reason,/no distinct horizontal axis/);
  assert.match(forwardScan(stream([0,0,0]),gyro).reason,/gravity direction/);
  assert.equal(forwardScan(stream([1e308,1e308,1e308]),gyro).available,false);
  const invalid=gyro.map((value,i) => i===130 ? {...value,values:[0,Infinity,0]} : value);
  assert.equal(forwardScan(accel,invalid).available,false);
  const isotropic=stream([0,0,9.81]);
  const cardinal=[[1,0],[-1,0],[0,1],[0,-1]];
  for(let i=105;i<153;i++) isotropic[i]={...isotropic[i],values:[cardinal[(i-105)%4][0],2+cardinal[(i-105)%4][1],9.81]};
  assert.match(forwardScan(isotropic,gyro,{...phaseRanges,starting:[2100,3040]}).reason,/no distinct horizontal axis/);
  const unsigned=stream([0,0,9.81]);
  for(let i=105;i<153;i++) unsigned[i]={...unsigned[i],values:[i%2 ? 1 : -1,0,9.81]};
  assert.match(forwardScan(unsigned,gyro,{...phaseRanges,starting:[2100,3040]}).reason,/cannot resolve the axis sign/);
});

test("forward sign comes from the observed start; reverse-facing and non-opposing stops stay warnings", () => {
  const {accel,gyro,up}=syntheticForward();
  const flipped=accel.map(e=>({...e,values:e.values.map((v,i)=>2*9.81*up[i]-v)}));
  const opposite=forwardScan(flipped,gyro);
  assert.equal(opposite.available,true);
  assert.match(opposite.warnings.join(' '),/opposes the phone top/);
  const sameStop=accel.map(e => Number(BigInt(e.sensor_timestamp_ns)-BigInt(origin))/1e6>=3200
    ? {...e,values:e.values.map((v,i)=>2*9.81*up[i]-v)} : e);
  const result=forwardScan(sameStop,gyro);
  assert.equal(result.available,true);
  assert.match(result.warnings.join(' '),/does not oppose/);
});

test("gyro rotation and delivery gaps are exposed without rejecting small corrections or filling missing time", () => {
  const {accel,gyro,up}=syntheticForward();
  const rotated=gyro.map(e=>e.sequence>=105 ? {...e,values:e.values.map((v,i)=>v+0.02*up[i])} : e);
  const result=forwardScan(accel,rotated);
  assert.equal(result.available,true);
  close(result.phases[1].upRotationRms,0.02);
  const gap=accel.map((e,i)=>i>=20 && i<70 ? {...e,sensor_timestamp_ns:event((i*20+400)*1e6).sensor_timestamp_ns} : e);
  // Choose a remaining monotonic prefix to demonstrate unfilled leading/trailing coverage.
  const sparse=gap.slice(20,70);
  const missing=forwardScan([...sparse,...accel.filter(e=>e.sequence>=105)],gyro);
  assert.equal(missing.available,true);
  assert.equal(missing.phases[0].acceleration.count,50);
  assert.equal(missing.phases[0].acceleration.leadingGapMs,800);
  assert.equal(missing.phases[0].acceleration.trailingGapMs,220);
});

const suggest = (accel, gyro, bounds = [0, 5000]) => suggestForwardIntervals(accel, gyro, origin, bounds);
test("automatic suggestions recover ordered rest/start/stop sections on a tilted mount without changing originals", () => {
  const { accel, gyro, forward: expected } = syntheticForward();
  const original = JSON.stringify([accel, gyro]);
  const result = suggest(Object.freeze(accel), Object.freeze(gyro));
  assert.equal(result.available, true, result.reason);
  assert.ok(result.ranges.rest[1] <= result.ranges.starting[0]);
  assert.ok(result.ranges.starting[1] <= result.ranges.stopping[0]);
  assert.ok(result.ranges.starting[0] >= 2000 && result.ranges.starting[1] <= 3250);
  assert.ok(result.ranges.stopping[0] >= 3000 && result.ranges.stopping[1] <= 4500);
  assert.ok(result.quietAfter[0] >= result.ranges.stopping[1]);
  const projection = forwardScan(accel, gyro, result.ranges);
  assert.equal(projection.available, true);
  assert.ok(dot3(projection.forward, expected) > 0.99);
  assert.equal(result.approved, undefined);
  assert.equal(JSON.stringify([accel, gyro]), original);
});

test("automatic sections do not fabricate a maneuver in stationary data or accept a missing opposite stop", () => {
  assert.equal(suggest(stream([0, 0, 9.81]), stream([0, 0, 0])).available, false);
  const { accel, gyro, up } = syntheticForward();
  const noStop = accel.map(item => item.sequence * 20 >= 3200 ? { ...item, values: up.map(v => v * 9.81) } : item);
  assert.match(suggest(noStop, gyro).reason, /stopping/);
});

test("short post-brake settling remains a visible uncertainty rather than a fabricated resting interval", () => {
  const { accel, gyro } = syntheticForward();
  const result = suggest(accel, gyro, [0, 4250]);
  assert.equal(result.available, true, result.reason);
  assert.equal(result.quietAfter, null);
  assert.match(result.notes.join(" "), /No continuous quiet section/);
});

test("a quiet constant-speed segment does not by itself imply several trials", () => {
  const { accel } = syntheticForward();
  const delayedStop = Array.from({ length: 351 }, (_, sequence) => {
    const source = sequence < 160 ? accel[sequence] : sequence < 210 ? accel[0] : accel[sequence - 100];
    return { ...source, ...event(sequence * 20000000, source.values), sequence };
  });
  const result = suggest(delayedStop, stream([0.001, 0.002, 0.003], 351), [0, 7000]);
  assert.equal(result.available, true, result.reason);
  assert.ok(result.ranges.stopping[0] >= 5000);
});

test("separate start/stop trials fall back to manual selection instead of spanning both", () => {
  const { accel } = syntheticForward();
  const repeated = Array.from({ length: 501 }, (_, sequence) => {
    const source = accel[sequence % 250];
    return { ...source, ...event(sequence * 20000000, source.values), sequence };
  });
  assert.match(suggest(repeated, stream([0.001, 0.002, 0.003], 501), [0, 10000]).reason, /Several start\/stop/);
});

test("suggestions refuse sparse, malformed, reordered and missing source streams without filling holes", () => {
  const { accel, gyro } = syntheticForward();
  assert.equal(suggest(accel, []).available, false);
  for (const replacement of [
    item => ({ ...item, sensor_timestamp_ns: event(0).sensor_timestamp_ns }),
    item => ({ ...item, sensor_timestamp_ns: "bad" }),
    item => ({ ...item, sequence: 999 }),
    item => ({ ...item, values: [NaN, 0, 9.81] }),
  ]) {
    const broken = accel.map((item, index) => index === 100 ? replacement(item) : item);
    assert.equal(suggest(broken, gyro).available, false);
  }
  const sparse = accel.filter((_, index) => index < 30 || index > 50).map((item, sequence) => ({ ...item, sequence }));
  assert.match(suggest(sparse, gyro).reason, /Timing gaps/);
  for (const bounds of [[0, 1000], [0, 31000], [-1, 5000], [0, NaN]]) assert.equal(suggest(accel, gyro, bounds).available, false);
});

test("suggested times remain relative to the recording for offset windows and large integer origins", () => {
  const { accel, gyro } = syntheticForward();
  const shift = values => values.map(item => ({ ...item, sensor_timestamp_ns: String(BigInt(item.sensor_timestamp_ns) + 12340000000n) }));
  const result = suggest(shift(accel), shift(gyro), [12340, 17340]);
  assert.equal(result.available, true, result.reason);
  assert.ok(result.ranges.rest[0] >= 12340);
  assert.ok(result.ranges.starting[0] >= 14340 && result.ranges.stopping[1] <= 16840);
});

test("noisy independent sensor clocks retain a usable provisional axis without synchronizing originals", () => {
  const { accel, gyro, forward: expected } = syntheticForward();
  const noisy = accel.map((item, index) => ({ ...item,
    sensor_timestamp_ns: String(BigInt(item.sensor_timestamp_ns) + BigInt(Math.round(1500000 * Math.sin(index)))),
    values: item.values.map((value, axis) => value + 0.015 * Math.sin(index * 2 + axis)),
  }));
  const independent = gyro.map((item, index) => ({ ...item,
    sensor_timestamp_ns: String(BigInt(item.sensor_timestamp_ns) + 3000000n),
    values: item.values.map((value, axis) => value + 0.0002 * Math.cos(index * 3 + axis)),
  }));
  const original = JSON.stringify([noisy, independent]);
  const result = suggest(noisy, independent);
  assert.equal(result.available, true, result.reason);
  const projection = forwardScan(noisy, independent, result.ranges);
  assert.equal(projection.available, true);
  assert.ok(dot3(projection.forward, expected) > 0.99);
  assert.equal(JSON.stringify([noisy, independent]), original);
});

test("whole-window projection recovers vehicle components and preserves original gravity, timing and vectors", () => {
  const { accel, gyro, forward: forwardAxis, right, up } = syntheticForward();
  const candidate = forwardScan(accel, gyro);
  assert.equal(candidate.available, true);
  const original = JSON.stringify([accel, gyro, candidate]);
  const result = vehicleAxisPreview(Object.freeze(accel), Object.freeze(gyro), origin, [0, 5000], candidate);
  assert.equal(result.available, true, result.reason);
  assert.equal(result.includingGravity.length, accel.length);
  assert.equal(result.relativeToRest.length, accel.length);
  assert.equal(result.rotation.length, gyro.length);
  for (let i = 0; i < accel.length; i++) {
    const point = result.includingGravity[i];
    close(point.time, i * 20);
    // Independently reconstruct the original phone vector from display F/R/U.
    for (let axis = 0; axis < 3; axis++) close(point.x * forwardAxis[axis] + point.y * right[axis] + point.z * up[axis], accel[i].values[axis]);
    close(Math.hypot(point.x, point.y, point.z), Math.hypot(...accel[i].values));
    close(result.relativeToRest[i].z, 0);
    close(result.rotation[i].z, 0);
  }
  close(result.includingGravity[0].z, 9.81);
  close(result.relativeToRest[0].x, 0);
  close(result.relativeToRest[0].y, 0);
  const start = vehicleAxisIntervalStats(result.relativeToRest, result.rotation, phaseRanges.starting);
  const stop = vehicleAxisIntervalStats(result.relativeToRest, result.rotation, phaseRanges.stopping);
  close(start.acceleration.mean[0], 1);
  close(stop.acceleration.mean[0], -1);
  close(stop.acceleration.mean[1], 0.15);
  assert.equal(JSON.stringify([accel, gyro, candidate]), original);
});

test("vehicle plots retain asynchronous channel counts and large-origin precision without interpolation", () => {
  const { accel, gyro, up } = syntheticForward();
  const candidate = forwardScan(accel, gyro);
  const independent = stream([0.001, 0.002, 0.003], 250, 10000000).map(item => ({ ...item, values: item.values.map((value, i) => value + 0.02 * up[i]) }));
  const result = vehicleAxisPreview(accel, independent, origin, [0, 5000], candidate);
  assert.equal(result.available, true, result.reason);
  assert.equal(result.accelerationTiming.count, 251);
  assert.equal(result.gyroscopeTiming.count, 250);
  assert.equal(result.rotation[0].time, 10);
  assert.equal(result.rotation.at(-1).time, 4990);
  const selected = vehicleAxisIntervalStats(result.relativeToRest, result.rotation, [2100, 3100]);
  assert.equal(selected.acceleration.count, 51);
  assert.equal(selected.rotation.count, 50);
  close(selected.upRotationRms, 0.02);
  const empty = vehicleAxisIntervalStats(result.relativeToRest, result.rotation, [6000, 7000]);
  assert.equal(empty.acceleration, null);
  assert.equal(empty.rotation, null);
  assert.equal(empty.upRotationRms, null);
});

test("long sensor gaps remain breaks in each vehicle acceleration view and are never filled", () => {
  const { accel, gyro } = syntheticForward();
  const candidate = forwardScan(accel, gyro);
  const gap = accel.map((item, i) => i >= 120 ? { ...item, sensor_timestamp_ns: String(BigInt(item.sensor_timestamp_ns) + 1000000000n) } : item);
  const result = vehicleAxisPreview(gap, stream([0.001, 0.002, 0.003], 301), origin, [0, 6000], candidate);
  assert.equal(result.available, true, result.reason);
  for (const points of [result.relativeToRest, result.includingGravity]) {
    assert.equal(points.filter(p => p.x === null && p.y === null && p.z === null).length, 1);
    assert.equal(points.filter(p => p.x !== null).length, accel.length);
  }
  assert.equal(result.accelerationTiming.largestGapMs, 1020);
  assert.equal(result.rotation.filter(p => p.x === null).length, 0);
});

test("vehicle preview rejects bad data elsewhere in the window even if the reference intervals were valid", () => {
  const { accel, gyro } = syntheticForward();
  const candidate = forwardScan(accel, gyro);
  for (const replacement of [
    item => ({ ...item, sequence: 999 }),
    item => ({ ...item, sensor_timestamp_ns: accel[229].sensor_timestamp_ns }),
    item => ({ ...item, values: [0, NaN, 9.81] }),
    item => ({ ...item, values: [1e308, 1e308, 1e308] }),
  ]) {
    const broken = accel.map((item, i) => i === 230 ? replacement(item) : item);
    assert.equal(vehicleAxisPreview(broken, gyro, origin, [0, 5000], candidate).available, false);
  }
  assert.equal(vehicleAxisPreview(accel, [], origin, [0, 5000], candidate).available, false);
  assert.equal(vehicleAxisPreview(accel, gyro, origin, [0, 31000], candidate).available, false);
  assert.equal(vehicleAxisPreview(accel, gyro, origin, [-1, 5000], candidate).available, false);
  for (const matrix of [
    [[1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[2, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[1, 0, 0], [0, 1, 0], [0, NaN, 1]],
  ]) assert.equal(vehicleAxisPreview(accel, gyro, origin, [0, 5000], { ...candidate, rotationRfu: matrix }).available, false);
});

test("fixed resting subtraction deliberately exposes changing gravity rather than claiming dynamic tilt correction", () => {
  const { accel, gyro, up } = syntheticForward();
  const candidate = forwardScan(accel, gyro);
  // A later, gravity-only pose with a changed direction must remain visible.
  const tiltedUp = normalize3(up.map((value, axis) => value + (axis === 0 ? 0.1 : 0)));
  const changed = accel.map((item, i) => i >= 225 ? { ...item, values: tiltedUp.map(value => 9.81 * value) } : item);
  const result = vehicleAxisPreview(changed, gyro, origin, [0, 5000], candidate);
  assert.equal(result.available, true, result.reason);
  assert.ok(Math.hypot(result.relativeToRest[230].x, result.relativeToRest[230].y, result.relativeToRest[230].z) > 0.49);
});

const timedStream = (times, fn = time => [time / 100, -time / 200, 9.81]) => times.map((time, sequence) => ({ ...event(Math.round(time * 1e6), fn(time)), sequence }));
const sync = (accel, gyro, bounds = [0, 100]) => synchronizationPreview(accel, gyro, origin, bounds);

test("synchronization exactly recovers linear signals on independent clocks while retaining gravity and originals", () => {
  const accel = timedStream([0, 19, 41, 61, 79, 100]);
  const gyro = timedStream([10, 30, 50, 70, 90], time => [time / 1000, 0.002, -time / 2000]);
  const original = JSON.stringify([accel, gyro]);
  const result = sync(Object.freeze(accel), Object.freeze(gyro));
  assert.equal(result.available, true, result.reason);
  assert.deepEqual(Array.from(result.rows, row => row.time), [0, 20, 40, 60, 80, 100]);
  assert.equal(result.sourceCounts.acceleration, 6);
  assert.equal(result.sourceCounts.gyroscope, 5);
  assert.equal(result.counts.paired, 4);
  assert.equal(result.counts.acceleration.original, 2);
  assert.equal(result.counts.acceleration.interpolated, 4);
  assert.equal(result.counts.gyroscope.outside, 2);
  for (const row of result.rows) {
    close(row.acceleration.values[0], row.time / 100);
    close(row.acceleration.values[1], -row.time / 200);
    close(row.acceleration.values[2], 9.81);
    if (row.gyroscope.values) close(row.gyroscope.values[0], row.time / 1000);
    assert.equal(row.sensorTimestampNs, String(BigInt(origin) + BigInt(row.time) * 1000000n));
  }
  assert.equal(result.rows[0].gyroscope.values, null);
  assert.equal(result.gyroscope[0].x, null);
  assert.equal(JSON.stringify([accel, gyro]), original);
});

test("the synchronization grid is anchored to the recording clock across arbitrary window boundaries", () => {
  const times = [25, 45, 65, 85, 105, 125];
  const result = sync(timedStream(times), timedStream(times), [25, 125]);
  assert.equal(result.available, true, result.reason);
  assert.deepEqual(Array.from(result.rows, row => row.time), [40, 60, 80, 100, 120]);
  assert.equal(result.rows[0].sensorTimestampNs, String(BigInt(origin) + 40000000n));
  close(result.rows[2].acceleration.values[0], 0.8);
  // A different window still uses the same underlying grid, without phase reset.
  const adjacent = sync(timedStream(times), timedStream(times), [45, 105]);
  assert.deepEqual(Array.from(adjacent.rows, row => row.time), [60, 80, 100]);
});

test("short-gap limit is inclusive and never bridges longer holes even when exact endpoints exist", () => {
  const supported = sync(timedStream([0, 60, 100]), timedStream([0, 20, 40, 60, 80, 100]));
  assert.equal(supported.available, true, supported.reason);
  assert.equal(supported.rows[1].acceleration.state, "interpolated");
  assert.equal(supported.rows[1].acceleration.bracketMs, 60);
  const unsupported = sync(timedStream([0, 60.000001, 100]), timedStream([0, 20, 40, 60, 80, 100]));
  assert.equal(unsupported.available, true, unsupported.reason);
  for (const row of unsupported.rows.slice(1, 4)) {
    assert.equal(row.acceleration.state, "gap");
    assert.equal(row.acceleration.values, null);
    assert.equal(row.gyroscope.state, "original");
  }
  assert.equal(unsupported.rows[0].acceleration.state, "original");
  assert.equal(unsupported.rows[4].acceleration.state, "interpolated");
  assert.equal(unsupported.counts.acceleration.gap, 3);
  assert.equal(unsupported.acceleration[2].y, null);
});

test("window edges remain missing rather than extrapolating or borrowing out-of-window samples", () => {
  const source = timedStream([0, 20, 40, 60, 80, 100]);
  const result = sync(source, source, [5, 95]);
  assert.equal(result.available, true, result.reason);
  assert.deepEqual(Array.from(result.rows, row => row.time), [20, 40, 60, 80]);
  const edge = sync(timedStream([19, 39, 59, 79]), timedStream([21, 41, 61, 81]), [0, 100]);
  assert.equal(edge.available, true, edge.reason);
  assert.equal(edge.rows[1].acceleration.state, "interpolated");
  assert.equal(edge.rows[1].gyroscope.state, "outside");
  assert.equal(edge.rows.at(-1).acceleration.state, "outside");
  assert.equal(edge.rows.at(-1).gyroscope.state, "outside");
});

test("large integer clocks and one-nanosecond differences never become false exact matches", () => {
  const source = timedStream([0.000001, 20.000001, 40.000001, 60.000001, 80.000001, 100]);
  const result = sync(source, source);
  assert.equal(result.available, true, result.reason);
  assert.equal(result.rows[0].acceleration.state, "outside");
  assert.equal(result.rows[1].acceleration.state, "interpolated");
  assert.equal(result.rows[1].acceleration.sourceTimesNs[0], String(BigInt(origin) + 1n));
  assert.equal(result.rows[1].acceleration.sourceTimesNs[1], String(BigInt(origin) + 20000001n));
  close(result.rows[1].acceleration.values[0], 0.2);
  assert.equal(result.rows.at(-1).acceleration.state, "original");
});

test("invalid, duplicate, backward and discontinuous source records refuse synchronization rather than being repaired", () => {
  const source = timedStream([0, 20, 40, 60, 80, 100]);
  for (const replacement of [
    item => ({ ...item, values: [0, Infinity, 0] }), item => ({ ...item, values: [0, 0] }),
    item => ({ ...item, sensor_timestamp_ns: "bad" }), item => ({ ...item, sensor_timestamp_ns: source[1].sensor_timestamp_ns }),
    item => ({ ...item, sensor_timestamp_ns: source[0].sensor_timestamp_ns }),
    item => ({ ...item, sequence: 99 }), item => ({ ...item, sequence: 2.5 }),
  ]) assert.equal(sync(source.map((item, index) => index === 2 ? replacement(item) : item), source).available, false);
  assert.equal(sync([], source).available, false);
  assert.equal(sync(source, [source[0]]).available, false);
  for (const bounds of [[NaN, 100], [-1, 100], [100, 0], [0, 30001]]) assert.equal(sync(source, source, bounds).available, false);
  assert.equal(synchronizationPreview(source, source, "bad", [0, 100]).available, false);
});

test("a valid sparse window can have no paired rows and its missing counts never imply new measurements", () => {
  const result = sync(timedStream([0, 100]), timedStream([10, 90]));
  assert.equal(result.available, true, result.reason);
  assert.equal(result.counts.paired, 0);
  assert.equal(result.counts.rows, 6);
  assert.equal(result.counts.acceleration.original, 2);
  assert.equal(result.counts.acceleration.gap, 4);
  assert.equal(result.counts.gyroscope.gap, 4);
  assert.equal(result.counts.gyroscope.outside, 2);
  const selection = synchronizationCounts(result.rows.filter(row => row.time >= 20 && row.time <= 60));
  assert.equal(selection.rows, 3);
  assert.equal(selection.acceleration.gap, 3);
  assert.equal(selection.paired, 0);
});

test("bounded synchronization keeps the recording-wide grid and at most 1501 rows", () => {
  const times = Array.from({ length: 1501 }, (_, i) => i * 20);
  const source = timedStream(times);
  const result = sync(source, source, [0, 30000]);
  assert.equal(result.available, true, result.reason);
  assert.equal(result.rows.length, 1501);
  assert.equal(result.counts.paired, 1501);
  assert.equal(result.counts.acceleration.original, 1501);
  assert.equal(result.counts.acceleration.interpolated, 0);
  assert.equal(result.rows.at(-1).time, 30000);
});

test("linear interpolation preserves exact recorded peaks but never claims to recover unobserved shape", () => {
  const source = timedStream([0, 20, 40, 60, 80, 100], time => [time === 40 ? 10 : 0, 0, 9.81]);
  const result = sync(source, source);
  assert.equal(result.available, true, result.reason);
  assert.equal(result.rows[2].acceleration.state, "original");
  assert.equal(result.rows[2].acceleration.values[0], 10);
  const coarse = sync(timedStream([0, 40, 80, 100], time => [time === 40 ? 10 : 0, 0, 9.81]), source);
  assert.equal(coarse.rows[1].acceleration.state, "interpolated");
  assert.equal(coarse.rows[1].acceleration.values[0], 5);
});

const uniformPoints = (count, fn = () => [0, 0, 9.81]) => Array.from({ length: count }, (_, index) => {
  const [x, y, z] = fn(index * 20, index);
  return Object.freeze({ time: index * 20, x, y, z });
});
test("5 Hz / 50 Hz filter agrees with reference second-order Butterworth coefficients", () => {
  const coefficients = butterworthCoefficients(5);
  const expectedB = [0.0674552738890719, 0.1349105477781438, 0.0674552738890719];
  const expectedA = [1, -1.1429805025399011, 0.4128015980961887];
  for (let i = 0; i < 3; i++) { close(coefficients.b[i], expectedB[i]); close(coefficients.a[i], expectedA[i]); }
});

test("constant resting gravity and gyro offsets survive filtering without zero-start artifacts or source changes", () => {
  const acceleration = Object.freeze(uniformPoints(101, () => [0.3, -0.1, 9.81]));
  const gyro = Object.freeze(uniformPoints(101, () => [0.001, 0.002, -0.003]));
  const original = JSON.stringify([acceleration, gyro]);
  for (const cutoff of [3, 5, 8]) {
    const result = lowPassPreview(acceleration, gyro, cutoff);
    assert.equal(result.available, true, result.reason);
    assert.equal(result.acceleration.after.length, acceleration.length);
    assert.equal(result.acceleration.warmup.filter(Boolean).length, 25);
    for (let i = 25; i < acceleration.length; i++) {
      close(result.acceleration.after[i].z, 9.81);
      close(result.acceleration.after[i].x, 0.3);
      close(result.gyroscope.after[i].z, -0.003);
    }
    const comparison = filterComparison(result.acceleration, [0, 2000]);
    assert.equal(comparison.total, 101); assert.equal(comparison.paired, 76); assert.equal(comparison.warmup, 25); assert.equal(comparison.missing, 0);
  }
  assert.equal(JSON.stringify([acceleration, gyro]), original);
});

test("frequency response preserves slow movement, meets the cutoff gain and attenuates fast vibration", () => {
  for (const cutoff of [3, 5, 8]) for (const frequency of [1, cutoff, 15]) {
    const input = uniformPoints(1101, time => [Math.sin(2 * Math.PI * frequency * time / 1000), 0, 9.81]);
    const result = lowPassPreview(input, input, cutoff);
    assert.equal(result.available, true, result.reason);
    const comparison = filterComparison(result.acceleration, [2000, 21980]);
    const gain = comparison.axes[0].after.std / comparison.axes[0].before.std;
    // Bilinear-transform Butterworth response; independent of the recurrence under test.
    const expected = 1 / Math.sqrt(1 + (Math.tan(Math.PI * frequency / 50) / Math.tan(Math.PI * cutoff / 50)) ** 4);
    close(gain, expected, 1e-8);
    if (frequency === cutoff) close(gain, 1 / Math.sqrt(2), 1e-8);
    if (frequency === 1) assert.ok(gain > 0.99);
    // The 8 Hz candidate intentionally retains more 15 Hz energy (gain about 0.157).
    if (frequency === 15) assert.ok(gain < 0.2);
  }
});

test("missing rows stay null and restart each channel independently with a fresh warm-up", () => {
  const input = uniformPoints(151);
  const gapped = input.map((point, index) => index >= 60 && index < 65 ? { ...point, x: null, y: null, z: null }
    : index >= 65 ? { ...point, x: 0, y: 0, z: -9.81 } : point);
  const result = lowPassPreview(gapped, input, 5);
  assert.equal(result.available, true, result.reason);
  assert.equal(result.acceleration.segments, 2);
  assert.equal(result.gyroscope.segments, 1);
  for (let i = 60; i < 90; i++) assert.equal(result.acceleration.after[i].z, null);
  close(result.acceleration.after[90].z, -9.81);
  close(result.gyroscope.after[65].z, 9.81);
  const comparison = filterComparison(result.acceleration, [0, 3000]);
  assert.equal(comparison.missing, 5);
  assert.equal(comparison.warmup, 50);
  assert.equal(comparison.paired, 96);
  const warmupOnly = filterComparison(result.acceleration, [1300, 1700]);
  assert.equal(warmupOnly.paired, 0);
  assert.equal(warmupOnly.axes[0].before, null);
});

test("the causal filter never changes earlier output when later samples change", () => {
  const input = uniformPoints(301, time => [Math.sin(time / 200), 0, 9.81]);
  const changed = input.map((point, index) => index >= 200 ? { ...point, x: 100 } : point);
  const first = lowPassPreview(input, input, 5);
  const second = lowPassPreview(changed, input, 5);
  assert.equal(first.available, true); assert.equal(second.available, true);
  assert.equal(JSON.stringify(first.acceleration.after.slice(0, 200)), JSON.stringify(second.acceleration.after.slice(0, 200)));
  assert.notEqual(first.acceleration.after[250].x, second.acceleration.after[250].x);
});

test("comparison reports signed peak-time differences on identical post-warm-up samples without claiming event latency", () => {
  const input = uniformPoints(151, (_time, index) => [index === 75 ? -10 : 0, 0, 9.81]);
  const result = lowPassPreview(input, input, 5);
  assert.equal(result.available, true, result.reason);
  const comparison = filterComparison(result.acceleration, [1000, 2500]);
  const x = comparison.axes[0];
  assert.equal(x.before.peak, 10); assert.equal(x.before.peakTime, 1500);
  assert.ok(x.after.peak < x.before.peak);
  assert.ok(x.peakTimeDifferenceMs > 0);
  assert.equal(x.peakTimeDifferenceMs, x.after.peakTime - x.before.peakTime);
  assert.equal(comparison.axes[1].peakTimeDifferenceMs, null);
  const empty = filterComparison(result.acceleration, [6000, 7000]);
  assert.equal(empty.paired, 0); assert.equal(empty.total, 0);
});

test("filtering refuses malformed, irregular or unmatched grids and unsupported settings", () => {
  const input = uniformPoints(51);
  assert.equal(lowPassPreview([], [], 5).available, false);
  assert.equal(lowPassPreview(uniformPoints(1502), uniformPoints(1502), 5).available, false);
  for (const cutoff of [0, 1, 25, NaN, Infinity]) assert.equal(lowPassPreview(input, input, cutoff).available, false);
  for (const replacement of [
    point => ({ ...point, x: NaN }), point => ({ ...point, z: Infinity }), point => ({ ...point, x: null }),
    point => ({ ...point, time: point.time + 1 }), point => ({ ...point, time: 0 }),
    point => ({ ...point, time: -20 }),
  ]) {
    const broken = input.map((point, index) => index === 20 ? replacement(point) : point);
    assert.equal(lowPassPreview(broken, input, 5).available, false);
    assert.equal(lowPassPreview(broken, broken, 5).available, false);
  }
  const missing = uniformPoints(51, () => [null, null, null]);
  const result = lowPassPreview(missing, input, 5);
  assert.equal(result.available, true, result.reason);
  assert.equal(result.acceleration.segments, 0);
  assert.equal(filterComparison(result.acceleration, [0, 1000]).missing, 51);
});
