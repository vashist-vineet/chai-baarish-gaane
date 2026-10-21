import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");

// Extract the AudioAtmosphere class implementation from script.js
const atmosphereSource = source.slice(
  source.indexOf("  class AudioAtmosphere"),
  source.indexOf("  class RainCanvas")
);

class MockAudio {
  constructor() {
    this._src = "";
    this.preload = "none";
    this.loop = false;
    this.playsInline = false;
    this.playbackRate = 1;
    this.currentTime = 0;
    this.duration = 10;
    this.playCount = 0;
    this.pauseCount = 0;
    this.loadCount = 0;
    this.srcAssignmentCount = 0;
    this.shouldRejectPlay = false;
    this.listeners = new Map();
  }

  get src() {
    return this._src;
  }

  set src(value) {
    this._src = value;
    this.srcAssignmentCount += 1;
  }

  addEventListener(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
  }

  removeEventListener(event, callback) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter((fn) => fn !== callback));
  }

  load() {
    this.loadCount += 1;
  }

  async play() {
    if (this.shouldRejectPlay) {
      throw new Error("Playback failed: NotAllowedError or network failure");
    }
    this.playCount += 1;
  }

  pause() {
    this.pauseCount += 1;
  }
}

class MockAudioParam {
  constructor(initialValue = 1) {
    this.value = initialValue;
    this.scheduled = [];
  }

  cancelScheduledValues(time) {
    this.scheduled.push({ type: "cancel", time });
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.scheduled.push({ type: "set", value, time });
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.scheduled.push({ type: "linearRamp", value, time });
  }

  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.scheduled.push({ type: "exponentialRamp", value, time });
  }
}

class MockGainNode {
  constructor() {
    this.gain = new MockAudioParam(1);
  }

  connect(destination) {
    return destination;
  }
}

class MockBiquadFilter {
  constructor() {
    this.type = "lowpass";
    this.frequency = new MockAudioParam(1000);
    this.Q = new MockAudioParam(1);
  }

  connect(destination) {
    return destination;
  }
}

class MockBufferSource {
  constructor() {
    this.buffer = null;
    this.loop = false;
    this.started = false;
  }

  connect(destination) {
    return destination;
  }

  start() {
    this.started = true;
  }
}

class MockAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
  }

  createGain() {
    return new MockGainNode();
  }

  createBiquadFilter() {
    return new MockBiquadFilter();
  }

  createMediaElementSource(audio) {
    return {
      connect: (destination) => destination,
      audio
    };
  }

  createBuffer(channels, length, sampleRate) {
    return {
      getChannelData: () => new Float32Array(length)
    };
  }

  createBufferSource() {
    return new MockBufferSource();
  }

  async resume() {
    this.state = "running";
  }
}

function createAtmosphereHarness(initialState = {}) {
  const createdAudios = [];
  class TrackingMockAudio extends MockAudio {
    constructor() {
      super();
      createdAudios.push(this);
    }
  }

  const state = {
    entered: false,
    environment: "monsoon",
    rainMode: "medium",
    rainVolume: 0.65,
    ambienceOn: true,
    ...initialState
  };

  let timerId = 1;
  const timers = new Map();
  function mockSetTimeout(fn, ms = 0) {
    const id = timerId++;
    timers.set(id, { fn, ms });
    return id;
  }
  function mockClearTimeout(id) {
    timers.delete(id);
  }
  function runTimers() {
    const pending = [...timers.entries()];
    timers.clear();
    for (const [, { fn }] of pending) {
      fn();
    }
  }

  const context = {
    AudioContext: MockAudioContext,
    Audio: TrackingMockAudio,
    window: { AudioContext: MockAudioContext },
    state,
    DEFAULTS: { ambienceVolume: 0.28 },
    duckMusic() {},
    setTimeout: mockSetTimeout,
    clearTimeout: mockClearTimeout,
    Date
  };

  const { AudioAtmosphere } = vm.runInNewContext(
    `${atmosphereSource}; ({ AudioAtmosphere })`,
    context
  );

  const atmosphere = new AudioAtmosphere();

  function switchEnvironment(env, seconds = 0.1) {
    state.environment = env;
    atmosphere.setEnvironment(env, seconds);
    runTimers();
  }

  return {
    atmosphere,
    createdAudios,
    state,
    context,
    runTimers,
    switchEnvironment
  };
}

test("initialization does not eagerly attach all MP3 sources or set preload=auto", () => {
  const { atmosphere, createdAudios } = createAtmosphereHarness();
  atmosphere.create();

  // 14 media layer elements should be created (3 rain, 1 burst, 6 wind, 4 thunder)
  assert.equal(createdAudios.length, 14);

  // Procedural coast layer should NOT have an HTMLAudioElement
  assert.equal(atmosphere.coastSurfLayer.source instanceof MockBufferSource, true);
  assert.equal(atmosphere.coastSurfLayer.audio, undefined);

  // Every single audio element should have preload="none", src="", and sourceAttached=false
  for (const audio of createdAudios) {
    assert.equal(audio.preload, "none", "Audio element must start with preload='none'");
    assert.equal(audio.src, "", "Audio element must not have src attached eagerly at creation");
    assert.equal(audio.srcAssignmentCount, 0, "No src assignment should happen at creation");
  }

  const allLayers = [
    ...atmosphere.rainLayers,
    atmosphere.burstLayer,
    atmosphere.windLayer,
    atmosphere.winterWindLayer,
    atmosphere.springBreezeLayer,
    atmosphere.autumnWindLayer,
    atmosphere.desertWindLayer,
    atmosphere.coastBreezeLayer,
    ...atmosphere.thunderLayers
  ];

  for (const layer of allLayers) {
    assert.equal(layer.sourceAttached, false, "Layer must be marked unattached initially");
    assert.ok(layer.src, "Layer config should store the intended MP3 path");
  }
});

test("initial environment sources load at start lifecycle trigger", async () => {
  const { atmosphere } = createAtmosphereHarness({
    entered: false,
    environment: "monsoon",
    ambienceOn: true
  });

  const started = await atmosphere.start();
  assert.equal(started, true);

  // Monsoon with ambienceOn=true activates 3 rain layers + 1 storm wind layer = 4 active layers
  const activeLayers = [...atmosphere.rainLayers, atmosphere.windLayer];
  for (const layer of activeLayers) {
    assert.equal(layer.sourceAttached, true);
    assert.ok(layer.audio.src.endsWith(".mp3"));
    assert.equal(layer.audio.preload, "auto");
    assert.equal(layer.audio.loadCount, 1);
    assert.equal(layer.audio.srcAssignmentCount, 1);
    assert.ok(layer.audio.playCount >= 1);
  }

  // All 10 other layers must remain unattached
  const inactiveLayers = [
    atmosphere.burstLayer,
    atmosphere.winterWindLayer,
    atmosphere.springBreezeLayer,
    atmosphere.autumnWindLayer,
    atmosphere.desertWindLayer,
    atmosphere.coastBreezeLayer,
    ...atmosphere.thunderLayers
  ];

  for (const layer of inactiveLayers) {
    assert.equal(layer.sourceAttached, false);
    assert.equal(layer.audio.src, "");
    assert.equal(layer.audio.preload, "none");
    assert.equal(layer.audio.playCount, 0);
  }
});

test("inactive environment sources remain unattached until their environment is activated", async () => {
  const { atmosphere, switchEnvironment } = createAtmosphereHarness({
    entered: true,
    environment: "monsoon",
    ambienceOn: false
  });

  await atmosphere.start();

  // With ambienceOn=false in monsoon, windLayer is not active
  assert.equal(atmosphere.windLayer.sourceAttached, false);
  assert.equal(atmosphere.winterWindLayer.sourceAttached, false);
  assert.equal(atmosphere.springBreezeLayer.sourceAttached, false);
  assert.equal(atmosphere.autumnWindLayer.sourceAttached, false);
  assert.equal(atmosphere.desertWindLayer.sourceAttached, false);
  assert.equal(atmosphere.coastBreezeLayer.sourceAttached, false);

  // Now transition to winter
  switchEnvironment("winter", 0.1);

  // Winter wind layer must now be attached and played
  assert.equal(atmosphere.winterWindLayer.sourceAttached, true);
  assert.equal(atmosphere.winterWindLayer.audio.src, "assets/audio/wind/storm-wind.mp3");
  assert.ok(atmosphere.winterWindLayer.audio.playCount >= 1);

  // Other non-winter wind layers must still be unattached
  assert.equal(atmosphere.springBreezeLayer.sourceAttached, false);
  assert.equal(atmosphere.autumnWindLayer.sourceAttached, false);
  assert.equal(atmosphere.desertWindLayer.sourceAttached, false);
  assert.equal(atmosphere.coastBreezeLayer.sourceAttached, false);
});

test("thunder and burst sources are attached on demand on first use", async () => {
  const { atmosphere } = createAtmosphereHarness({
    entered: true,
    environment: "monsoon"
  });

  await atmosphere.start();

  // Burst layer unattached initially
  assert.equal(atmosphere.burstLayer.sourceAttached, false);
  assert.equal(atmosphere.burstLayer.audio.src, "");

  // Call burst()
  atmosphere.burst(5);
  assert.equal(atmosphere.burstLayer.sourceAttached, true);
  assert.equal(atmosphere.burstLayer.audio.src, "assets/audio/rain/rain-burst.mp3");
  assert.equal(atmosphere.burstLayer.audio.preload, "auto");
  assert.equal(atmosphere.burstLayer.audio.playCount, 1);

  // Thunder layers all unattached initially
  for (const layer of atmosphere.thunderLayers) {
    assert.equal(layer.sourceAttached, false);
    assert.equal(layer.audio.src, "");
  }

  // Trigger one thunder cue
  const triggered = atmosphere.thunder("close");
  assert.equal(triggered, true);

  // Exactly one thunder layer should now be attached
  const attachedThunder = atmosphere.thunderLayers.filter((layer) => layer.sourceAttached);
  const unattachedThunder = atmosphere.thunderLayers.filter((layer) => !layer.sourceAttached);

  assert.equal(attachedThunder.length, 1);
  assert.equal(unattachedThunder.length, 3);
  assert.ok(attachedThunder[0].audio.src.includes("thunder"));
  assert.equal(attachedThunder[0].audio.playCount, 1);
});

test("returning to an environment reuses existing audio elements and sources", async () => {
  const { atmosphere, createdAudios, switchEnvironment } = createAtmosphereHarness({
    entered: true,
    environment: "monsoon",
    ambienceOn: true
  });

  await atmosphere.start();
  const initialRainElements = atmosphere.rainLayers.map((l) => l.audio);

  // Switch to winter
  switchEnvironment("winter", 0.05);
  assert.equal(atmosphere.winterWindLayer.sourceAttached, true);

  // Switch back to monsoon
  switchEnvironment("monsoon", 0.05);

  // Audio elements must be the exact same instances
  atmosphere.rainLayers.forEach((layer, index) => {
    assert.equal(layer.audio, initialRainElements[index], "Audio element reference must be preserved");
    assert.equal(layer.audio.srcAssignmentCount, 1, "src must not be reassigned on return");
  });

  // Total audio elements in system must still be 14
  assert.equal(createdAudios.length, 14, "No duplicate audio elements created across environment transitions");
});

test("repeated environment switching does not duplicate audio elements or keep outgoing layers active", async () => {
  const { atmosphere, createdAudios, switchEnvironment } = createAtmosphereHarness({
    entered: true,
    environment: "monsoon",
    ambienceOn: true
  });

  await atmosphere.start();

  const environments = ["winter", "spring", "autumn", "desert", "coast", "monsoon", "winter"];
  for (const env of environments) {
    switchEnvironment(env, 0.01);
  }

  // Audio element count never grows
  assert.equal(createdAudios.length, 14);

  // The active environment is winter: winterWindLayer should be playing, rainLayers should be paused
  assert.ok(atmosphere.rainLayers.every((l) => l.audio.pauseCount >= 1));
});

test("playback rejection and source-loading failure are handled safely without false reporting", async () => {
  const { atmosphere } = createAtmosphereHarness({
    entered: true,
    environment: "monsoon"
  });

  atmosphere.create();

  // Force play to reject on all audio elements (e.g. autoplay restriction)
  for (const layer of atmosphere.rainLayers) {
    layer.audio.shouldRejectPlay = true;
  }
  if (atmosphere.windLayer) atmosphere.windLayer.audio.shouldRejectPlay = true;

  const rainStarted = await atmosphere.start();
  // Must return false because no layer successfully played
  assert.equal(rainStarted, false);
});

test("existing ambience-toggle semantics remain correct", async () => {
  const { atmosphere } = createAtmosphereHarness({
    entered: true,
    environment: "monsoon",
    ambienceOn: false
  });

  await atmosphere.start();

  // In monsoon with ambience off, windLayer should not be attached
  assert.equal(atmosphere.windLayer.sourceAttached, false);

  // Turn ambience ON
  atmosphere.setAmbience(true, 0.2);

  // Wind layer must now be attached and playing
  assert.equal(atmosphere.windLayer.sourceAttached, true);
  assert.equal(atmosphere.windLayer.audio.src, "assets/audio/wind/storm-wind.mp3");
  assert.ok(atmosphere.windLayer.audio.playCount >= 1);
});

test("production script does not eagerly start atmosphere on initial load", () => {
  // initialize() must not call atmosphere.start()
  const initMatch = source.match(/function initialize\(\)[\s\S]*?\n  \}/);
  assert.ok(initMatch, "initialize() function must be present");
  assert.doesNotMatch(
    initMatch[0],
    /atmosphere\.start\(\)/,
    "initialize() must not call atmosphere.start() eagerly"
  );

  // AUDIO_UNLOCK_EVENTS and enterExperience must wire audio start to user interaction
  assert.match(source, /const AUDIO_UNLOCK_EVENTS = \["pointerdown", "touchstart", "keydown"\]/);
  assert.match(source, /async function unlockAudio\(\) \{[\s\S]*?atmosphere\.start\(\)/);
  assert.match(source, /function enterExperience\(\) \{[\s\S]*?atmosphere\.start\(\)/);
});
