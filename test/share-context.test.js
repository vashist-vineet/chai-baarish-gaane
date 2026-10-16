import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const ENVIRONMENTS = ["monsoon", "winter", "spring", "autumn", "desert", "coast"];
const LANGUAGES = ["all", "hindi", "kannada", "malayalam", "telugu", "tamil", "bengali", "marathi", "punjabi", "odia", "bhojpuri", "assamese", "gujarati", "rajasthani"];
const MOODS = ["all", "baarish", "romantic", "nostalgic", "sad", "safar", "shaam", "sukoon", "old-gold"];
const TRACKS = [
  { title: "Rain", language: "hindi", moods: ["baarish", "romantic"], youtubeId: "AAAAAAAAAAA" },
  { title: "Coast", language: "tamil", moods: ["romantic"], youtubeId: "BBBBBBBBBBB" },
  { title: "Quiet", language: "bengali", moods: ["sukoon"], youtubeId: "CCCCCCCCCCC" },
  { title: "Unverified", language: "hindi", moods: ["sad"], youtubeId: "" }
];

function loadShareContext() {
  const window = {};
  const context = vm.createContext({ window, URL, URLSearchParams });
  vm.runInContext(fs.readFileSync(new URL("../share-context.js", import.meta.url), "utf8"), context);
  return window.CBG_SHARE_CONTEXT;
}

function resolve(api, search, saved = {}) {
  return api.resolveInitialState({
    rawContext: api.parseShareContext(search),
    saved,
    environments: ENVIRONMENTS,
    languages: LANGUAGES,
    moods: MOODS,
    tracks: TRACKS
  });
}

test("share URLs are canonical, encoded, versioned, and omit all-valued filters", () => {
  const api = loadShareContext();
  const url = api.buildShareUrl("https://preview.example/path?utm_source=private#old", {
    environment: "coast",
    language: "all",
    mood: "all",
    trackId: "BBBBBBBBBBB"
  }, { environments: ENVIRONMENTS, languages: LANGUAGES, moods: MOODS });

  assert.equal(url, "https://preview.example/path?share=1&env=coast&track=BBBBBBBBBBB");
  assert.deepEqual(
    { ...api.parseShareContext("?share=1&env=coast&lang=tamil&mood=old-gold&track=BBBBBBBBBBB") },
    { isShared: true, environment: "coast", language: "tamil", mood: "old-gold", trackId: "BBBBBBBBBBB" }
  );
  assert.equal(api.parseShareContext("?share=2&env=coast").isShared, false);
});

test("all registered environments, languages, and moods round-trip through URLSearchParams", () => {
  const api = loadShareContext();
  for (const environment of ENVIRONMENTS) {
    const parsed = api.parseShareContext(new URL(api.buildShareUrl("https://example.test/", {
      environment,
      language: "tamil",
      mood: "romantic",
      trackId: "BBBBBBBBBBB"
    }, { environments: ENVIRONMENTS, languages: LANGUAGES, moods: MOODS })).search);
    assert.equal(parsed.environment, environment);
  }
  for (const language of LANGUAGES.filter((value) => value !== "all")) {
    const url = api.buildShareUrl("https://example.test/", {
      environment: "monsoon", language, mood: "all", trackId: "AAAAAAAAAAA"
    }, { environments: ENVIRONMENTS, languages: LANGUAGES, moods: MOODS });
    assert.equal(api.parseShareContext(new URL(url).search).language, language);
  }
  for (const mood of MOODS.filter((value) => value !== "all")) {
    const url = api.buildShareUrl("https://example.test/", {
      environment: "monsoon", language: "all", mood, trackId: "AAAAAAAAAAA"
    }, { environments: ENVIRONMENTS, languages: LANGUAGES, moods: MOODS });
    assert.equal(api.parseShareContext(new URL(url).search).mood, mood);
  }
});

test("valid shared values override conflicting preferences and preserve an out-of-filter song", () => {
  const api = loadShareContext();
  const restored = resolve(
    api,
    "?share=1&env=coast&lang=bengali&mood=sukoon&track=BBBBBBBBBBB",
    { environment: "winter", selectedLanguage: "hindi", selectedMood: "sad", currentTrack: 0 }
  );

  assert.deepEqual(
    { ...restored },
    { isShared: true, environment: "coast", language: "bengali", mood: "sukoon", trackIndex: 1, trackMatched: true }
  );
});

test("normal visits retain validated saved preferences", () => {
  const api = loadShareContext();
  const restored = resolve(api, "?env=coast&track=BBBBBBBBBBB", {
    environment: "winter",
    selectedLanguage: "tamil",
    selectedMood: "romantic",
    currentTrack: 1
  });

  assert.deepEqual(
    { ...restored },
    { isShared: false, environment: "winter", language: "tamil", mood: "romantic", trackIndex: 1, trackMatched: false }
  );
});

test("malformed context fields fall back independently without accepting blank or removed tracks", () => {
  const api = loadShareContext();
  const unknown = resolve(api, "?share=1&env=unknown&lang=tamil&mood=unknown&track=ZZZZZZZZZZZ");
  assert.deepEqual(
    { ...unknown },
    { isShared: true, environment: "monsoon", language: "tamil", mood: "all", trackIndex: 1, trackMatched: false }
  );

  const blank = resolve(api, "?share=1&env=winter&lang=hindi&mood=sad&track=");
  assert.equal(blank.trackMatched, false);
  assert.equal(blank.trackIndex, 0, "blank-ID entries must not be chosen as fallbacks");

  const missing = resolve(api, "?share=1&env=winter&lang=bengali&mood=old-gold");
  assert.equal(missing.trackMatched, false);
  assert.equal(missing.trackIndex, 0, "an empty filter pool must fall back to a safe global track");
  assert.equal(missing.language, "bengali");
  assert.equal(missing.mood, "old-gold");
});

test("a shared cue error advances once without autoplay, watchdog, or preference writes", () => {
  const api = loadShareContext();
  const saved = {
    environment: "winter",
    selectedLanguage: "hindi",
    selectedMood: "sad",
    currentTrack: 0,
    musicVolume: 0.41
  };
  const savedSnapshot = JSON.stringify(saved);
  let storedPreferences = savedSnapshot;
  let currentTrackIndex = resolve(
    api,
    "?share=1&env=coast&lang=tamil&mood=romantic&track=BBBBBBBBBBB",
    saved
  ).trackIndex;
  let failedRequestId = -1;
  let fallbackAdvances = 0;
  let watchdogStarts = 0;
  const playerCalls = [];
  const player = {
    cueVideoById(videoId) { playerCalls.push(["cue", videoId]); },
    loadVideoById(videoId) { playerCalls.push(["load", videoId]); },
    playVideo() { playerCalls.push(["play", TRACKS[currentTrackIndex].youtubeId]); }
  };

  function applyFallback(transition) {
    if (!transition.accepted) return false;
    failedRequestId = transition.failedRequestId;
    fallbackAdvances += 1;
    currentTrackIndex = 2;
    if (transition.persistSelection) {
      storedPreferences = JSON.stringify({ ...saved, currentTrack: currentTrackIndex });
    }
    if (transition.autoplay) {
      player.loadVideoById(TRACKS[currentTrackIndex].youtubeId);
      player.playVideo();
      watchdogStarts += 1;
    } else {
      player.cueVideoById(TRACKS[currentTrackIndex].youtubeId);
    }
    return true;
  }

  // Shared onReady behavior: cue only, without starting a watchdog.
  player.cueVideoById(TRACKS[currentTrackIndex].youtubeId);
  assert.deepEqual(playerCalls, [["cue", "BBBBBBBBBBB"]]);
  assert.equal(watchdogStarts, 0);

  const firstFailure = api.resolveFailedTrackTransition({
    requestId: 0,
    failedRequestId,
    isSharedContext: true,
    playIntent: false
  });
  assert.equal(applyFallback(firstFailure), true);

  const duplicateFailure = api.resolveFailedTrackTransition({
    requestId: 0,
    failedRequestId,
    isSharedContext: true,
    playIntent: false
  });
  assert.equal(applyFallback(duplicateFailure), false);
  assert.equal(fallbackAdvances, 1, "one failed cue must advance exactly once");
  assert.deepEqual(playerCalls, [["cue", "BBBBBBBBBBB"], ["cue", "CCCCCCCCCCC"]]);
  assert.equal(watchdogStarts, 0);
  assert.equal(storedPreferences, savedSnapshot, "pre-Play shared recovery must not touch saved preferences");

  // Explicit Play uses the selected fallback and starts normal monitoring.
  player.loadVideoById(TRACKS[currentTrackIndex].youtubeId);
  player.playVideo();
  watchdogStarts += 1;
  assert.deepEqual(playerCalls.slice(-2), [["load", "CCCCCCCCCCC"], ["play", "CCCCCCCCCCC"]]);
  assert.equal(watchdogStarts, 1);

  const normalFailure = api.resolveFailedTrackTransition({
    requestId: 1,
    failedRequestId: -1,
    isSharedContext: false,
    playIntent: true
  });
  assert.deepEqual(
    { ...normalFailure },
    { accepted: true, failedRequestId: 1, autoplay: true, persistSelection: true },
    "normal playback must retain autoplay and preference-persistence semantics"
  );
  assert.equal(applyFallback(normalFailure), true);
  assert.notEqual(storedPreferences, savedSnapshot, "normal recovery must still persist its selected track");
  assert.deepEqual(playerCalls.slice(-2), [["load", "CCCCCCCCCCC"], ["play", "CCCCCCCCCCC"]]);
  assert.equal(watchdogStarts, 2, "normal recovery must continue monitoring playback");
});

test("shared startup cues without play intent while normal startup behavior remains", () => {
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");
  const playerBlock = source.slice(source.indexOf("function createPlayer()"), source.indexOf("function updateProgress()"));
  const sharedReadyBlock = playerBlock.slice(playerBlock.indexOf("if (state.isSharedContext)"), playerBlock.indexOf("} else {"));

  assert.match(playerBlock, /autoplay:\s*state\.isSharedContext\s*\?\s*0\s*:\s*1/);
  assert.match(sharedReadyBlock, /state\.playIntent = false/);
  assert.match(sharedReadyBlock, /cueVideoById\(targetVideoId\)/);
  assert.doesNotMatch(sharedReadyBlock, /loadVideoById|schedulePlaybackWatchdog/);
  assert.match(playerBlock, /state\.playIntent = true;[\s\S]*loadVideoById\(targetVideoId\);[\s\S]*schedulePlaybackWatchdog\(PLAYBACK_VERIFY_DELAY\)/);
});

test("Web Share and clipboard fallback use the same generated context URL", () => {
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");
  const shareBlock = source.slice(source.indexOf("async function shareBaarish()"), source.indexOf("async function toggleFullscreen()"));

  assert.match(shareBlock, /buildShareUrl\(location\.href/);
  assert.match(shareBlock, /url:\s*shareUrl/);
  assert.match(shareBlock, /navigator\.clipboard\.writeText\(shareUrl\)/);
  assert.doesNotMatch(shareBlock, /writeText\(location\.href\)/);
});

test("shared fallback keeps request-scoped failure suppression and filtered navigation invariants", () => {
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");
  assert.match(source, /failedPlaybackRequestId:\s*-1/);
  assert.match(source, /resolveFailedTrackTransition\(\{/);
  assert.match(source, /if \(!transition\.accepted\) return false/);
  assert.match(source, /persistSelection: transition\.persistSelection/);
  assert.match(source, /const globalFallback = sequentialIndex\(1, failedIndex\)/);
  assert.match(source, /activePool\.has\(state\.currentTrackIndex\)/);
});
