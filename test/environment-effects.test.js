import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");
const lifecycleSource = source.slice(
  source.indexOf("  class AnimationLoop"),
  source.indexOf("  class RainCanvas")
);

function createLifecycleHarness() {
  let nextFrameId = 1;
  const callbacks = new Map();
  const classes = new Set();
  const state = { entered: true, environment: "monsoon", environmentTransitioning: false };
  const document = {
    hidden: false,
    body: { classList: { contains: (name) => classes.has(name) } }
  };
  const context = {
    document,
    state,
    requestAnimationFrame(callback) {
      const frameId = nextFrameId++;
      callbacks.set(frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(frameId) {
      callbacks.delete(frameId);
    }
  };
  const { AnimationLoop, environmentEffectIsActive } = vm.runInNewContext(
    `${lifecycleSource}; ({ AnimationLoop, environmentEffectIsActive })`,
    context
  );
  return { AnimationLoop, callbacks, classes, context, environmentEffectIsActive, state };
}

test("inactive effect loops schedule no frames and stale callbacks cannot restart them", () => {
  const { AnimationLoop, callbacks } = createLifecycleHarness();
  let active = false;
  let renders = 0;
  const loop = new AnimationLoop(() => { renders += 1; }, () => active);

  loop.sync();
  assert.equal(callbacks.size, 0);

  active = true;
  loop.sync();
  loop.sync();
  assert.equal(callbacks.size, 1, "repeated activation must not create duplicate frames");

  const firstCallback = [...callbacks.values()][0];
  callbacks.clear();
  firstCallback(10);
  assert.equal(renders, 1);
  assert.equal(callbacks.size, 1, "an active render schedules one successor");

  const staleCallback = [...callbacks.values()][0];
  active = false;
  loop.sync();
  assert.equal(callbacks.size, 0, "deactivation cancels the pending frame");
  staleCallback(20);
  assert.equal(renders, 1, "a cancelled callback cannot render after deactivation");
  assert.equal(callbacks.size, 0, "a stale callback cannot restart the loop");
});

test("environment transitions activate only their outgoing and incoming effect loops", () => {
  const { classes, environmentEffectIsActive, state } = createLifecycleHarness();

  state.environmentTransitioning = true;
  classes.add("environment-from-monsoon");
  classes.add("environment-to-winter");
  assert.equal(environmentEffectIsActive("monsoon"), true);
  assert.equal(environmentEffectIsActive("winter"), true);
  assert.equal(environmentEffectIsActive("spring"), false);
  assert.equal(environmentEffectIsActive("autumn"), false);
  assert.equal(environmentEffectIsActive("desert"), false);

  state.environmentTransitioning = false;
  state.environment = "winter";
  assert.equal(environmentEffectIsActive("winter"), true);
  assert.equal(environmentEffectIsActive("monsoon"), false);
});

test("all effect systems use the shared lifecycle synchronizer", () => {
  assert.match(source, /const rain = new RainCanvas\(els\.canvas, \(\) => environmentEffectIsActive\("monsoon"\)\)/);
  for (const environment of ["winter", "spring", "autumn", "desert"]) {
    assert.match(source, new RegExp(`environmentEffectIsActive\\("${environment}"\\)`));
  }
  assert.match(source, /function syncEffectLoops\(\) \{[\s\S]*rain\.refresh\(\);[\s\S]*entryRain\.refresh\(\);[\s\S]*snow\.refresh\(\);[\s\S]*petals\.refresh\(\);[\s\S]*leaves\.refresh\(\);[\s\S]*dust\.refresh\(\);[\s\S]*butterflies\.refresh\(\);/);
  assert.match(source, /document\.addEventListener\("visibilitychange", \(\) => \{\s*syncEffectLoops\(\);/);
});
