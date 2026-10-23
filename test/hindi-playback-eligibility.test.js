import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const HINDI_SOURCE_HASH = "eb308a06c5a550912a1d77cbe521ffa8069d7fa6d8d3d1f4dd54973baf2e5811";
const VERIFIED_ID_HASH = "1f59a91d3102895a750fa237c6d39a9f019f480dd6475b08499bd118649172f1";
const VERIFIED_IDENTITY_HASH = "4fb8dcabc45f4037c3b01f02b86c1c072390cefa8acf8a42e1d7dbc168ab7572";
const NON_HINDI_SOURCE_HASH = "47811a2aee08ec310ea7c010cc414f02fe3bf17529a6268542a07132f84d4e88";

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function loadRuntime() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(new URL("../playlist.js", import.meta.url), "utf8"), context);
  vm.runInContext(fs.readFileSync(new URL("../hindi-playback-eligibility.js", import.meta.url), "utf8"), context);
  return {
    playlist: Array.from(context.window.CBG_PLAYLIST),
    eligibility: context.window.CBG_PLAYBACK_ELIGIBILITY
  };
}

test("verified Hindi manifest locks the exact ordered 132 song identities and audited IDs", () => {
  const { playlist, eligibility } = loadRuntime();
  const hindi = playlist.filter((track) => track.language === "hindi");
  const ids = Array.from(eligibility.orderedHindiVideoIds);
  const manifestTracks = ids.map((youtubeId) => {
    const matches = hindi.filter((track) => track.youtubeId === youtubeId);
    assert.equal(matches.length, 1, `verified ID ${youtubeId} must identify exactly one Hindi source entry`);
    return matches[0];
  });
  const canonicalIdentities = manifestTracks.map(({ title, artist, film, year, youtubeId }) => ({
    title,
    artist,
    film,
    year,
    youtubeId
  }));
  const sourcePositions = manifestTracks.map((track) => hindi.indexOf(track));

  assert.equal(hindi.length, 202);
  assert.equal(hash(hindi), HINDI_SOURCE_HASH);
  assert.equal(ids.length, 132);
  assert.equal(new Set(ids).size, 132);
  assert.ok(ids.every((id) => /^[A-Za-z0-9_-]{11}$/.test(id)));
  assert.equal(hash(ids), VERIFIED_ID_HASH);
  assert.equal(hash(canonicalIdentities), VERIFIED_IDENTITY_HASH);
  assert.deepEqual(sourcePositions, [...sourcePositions].sort((a, b) => a - b), "verified order must preserve source order");
  assert.equal(eligibility.sourceHindiCatalogHash, HINDI_SOURCE_HASH);
  assert.equal(eligibility.orderedManifestIdsHash, VERIFIED_ID_HASH);
  assert.equal(eligibility.orderedManifestIdentityHash, VERIFIED_IDENTITY_HASH);
});

test("runtime eligibility excludes every non-manifest Hindi entry but leaves other languages unchanged", () => {
  const { playlist, eligibility } = loadRuntime();
  const hindi = playlist.filter((track) => track.language === "hindi");
  const nonHindi = playlist.filter((track) => track.language !== "hindi");
  const eligibleHindi = hindi.filter(eligibility.isTrackEligible);
  const excludedHindi = hindi.filter((track) => !eligibility.isTrackEligible(track));
  const validId = (track) => /^[A-Za-z0-9_-]{11}$/.test(track.youtubeId);

  assert.equal(eligibleHindi.length, 132);
  assert.equal(excludedHindi.length, 70);
  assert.equal(hash(nonHindi), NON_HINDI_SOURCE_HASH);
  assert.ok(nonHindi.every((track) => eligibility.isTrackEligible(track) === validId(track)));
  assert.equal(eligibility.isTrackEligible(hindi.find((track) => track.title === "Heeriye")), false);
  assert.equal(eligibility.isTrackEligible(hindi.find((track) => track.title === "Jaage Jaage")), false);
  assert.equal(eligibility.isTrackEligible(hindi.find((track) => track.title === "Woh Lamhe" && track.film === "Jal Pari")), false);
  assert.equal(eligibility.isTrackEligible(hindi.find((track) => track.title === "Tere Naina")), true);
});

test("language and mood pools, counts, stale indices, and session exclusions share one eligibility policy", () => {
  const { playlist, eligibility } = loadRuntime();
  const hindiIndices = Array.from(eligibility.eligibleIndices(playlist, { language: "hindi", mood: "all" }));
  const romanticHindi = Array.from(eligibility.eligibleIndices(playlist, { language: "hindi", mood: "romantic" }));
  const allEligible = Array.from(eligibility.eligibleIndices(playlist));
  const heeriyeIndex = playlist.findIndex((track) => track.language === "hindi" && track.title === "Heeriye");
  const jaageIndex = playlist.findIndex((track) => track.language === "hindi" && track.title === "Jaage Jaage");
  const kannadaValid = playlist.filter((track) => track.language === "kannada" && /^[A-Za-z0-9_-]{11}$/.test(track.youtubeId)).length;

  assert.equal(hindiIndices.length, 132);
  assert.equal(allEligible.length, 1195);
  assert.ok(romanticHindi.length > 0);
  assert.ok(romanticHindi.every((index) => playlist[index].language === "hindi" && playlist[index].moods.includes("romantic")));
  assert.ok(!allEligible.includes(heeriyeIndex));
  assert.ok(!allEligible.includes(jaageIndex));
  assert.equal(eligibility.eligibleIndices(playlist, { language: "kannada" }).length, kannadaValid);

  const fallback = eligibility.resolveEligibleIndex(playlist, heeriyeIndex, { language: "hindi", mood: "romantic" });
  assert.ok(romanticHindi.includes(fallback), "an excluded saved selection must fall back inside active filters");
  assert.notEqual(fallback, heeriyeIndex);

  const excludedIndices = new Set([hindiIndices[0], hindiIndices[1]]);
  const sessionPool = Array.from(eligibility.eligibleIndices(playlist, {
    language: "hindi",
    mood: "all",
    excludedIndices
  }));
  assert.equal(sessionPool.length, 130);
  assert.ok(sessionPool.every((index) => !excludedIndices.has(index)));
});

test("shared links cannot restore an excluded Hindi song", () => {
  const { playlist, eligibility } = loadRuntime();
  const context = vm.createContext({ window: {}, URL, URLSearchParams });
  vm.runInContext(fs.readFileSync(new URL("../share-context.js", import.meta.url), "utf8"), context);
  const api = context.window.CBG_SHARE_CONTEXT;
  const heeriye = playlist.find((track) => track.language === "hindi" && track.title === "Heeriye");
  const resolved = api.resolveInitialState({
    rawContext: api.parseShareContext(`?share=1&env=monsoon&lang=hindi&mood=romantic&track=${heeriye.youtubeId}`),
    saved: {},
    environments: ["monsoon", "winter", "spring", "autumn", "desert", "coast"],
    languages: ["all", "hindi", "kannada"],
    moods: ["all", "romantic"],
    tracks: playlist,
    isTrackEligible: eligibility.isTrackEligible
  });

  assert.equal(resolved.trackMatched, false);
  assert.equal(resolved.language, "hindi");
  assert.equal(resolved.mood, "romantic");
  assert.notEqual(playlist[resolved.trackIndex].youtubeId, heeriye.youtubeId);
  assert.equal(eligibility.isTrackEligible(playlist[resolved.trackIndex]), true);
});

test("playlist rendering and every navigation path consume eligible pools", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");

  assert.match(html, /playlist\.js\?v=hindi-catalog-20261016-5/);
  assert.match(html, /hindi-playback-eligibility\.js\?v=verified-hindi-20261016-1/);
  assert.match(html, /share-context\.js\?v=verified-hindi-20261016-1/);
  assert.match(html, /script\.js\?v=playlist-lazy-render-20261019-1/);
  assert.ok(html.indexOf("playlist.js") < html.indexOf("hindi-playback-eligibility.js"));
  assert.ok(html.indexOf("hindi-playback-eligibility.js") < html.indexOf("share-context.js"));
  assert.match(source, /function filteredIndices\(\) \{\s*return eligibleTrackIndices/);
  assert.match(source, /function playableIndices[\s\S]*return eligibleTrackIndices/);
  assert.match(source, /function playableFilteredIndices[\s\S]*return eligibleTrackIndices/);
  assert.match(source, /function rebuildShuffleQueue[\s\S]*const pool = playableFilteredIndices/);
  assert.match(source, /function sequentialFilteredIndex[\s\S]*playableFilteredIndices/);
  assert.match(source, /function sequentialIndex[\s\S]*playableIndices/);
  assert.match(source, /if \(!isTrackEligibleForPlayback\(track\)/);
  assert.match(source, /trackId: isTrackEligibleForPlayback\(track\) \? track\.youtubeId : ""/);
  assert.match(source, /resolveEligibleIndex\(playlist, state\.currentTrackIndex/);
});
