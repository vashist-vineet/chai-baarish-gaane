import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { BHOJPURI_EXCLUDED_TRACKS } from "../audit/bhojpuri-unverified-tracks.js";

function loadPlaylist() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../playlist.js", import.meta.url), "utf8"), context);
  return Array.from(context.window.CBG_PLAYLIST);
}

function catalogHash(tracks) {
  return crypto.createHash("sha256").update(JSON.stringify(tracks)).digest("hex");
}

function bhojpuriCatalogHash(tracks) {
  return catalogHash(tracks.map(({ title, artist, film, year, youtubeId }) => ({
    title,
    artist,
    film,
    year,
    youtubeId
  })));
}

// Locks the accepted order, identity metadata, and audited playback IDs.
// Update only after an intentional Bhojpuri catalog change has been reviewed.
const EXPECTED_BHOJPURI_CATALOG_HASH = "72e68f7b3e06217a42d3e31f50ef567762f8eae08e28a8e165d0f29fde28d9c1";

const validId = (id) => /^[A-Za-z0-9_-]{11}$/.test(id);
const identity = (track) => [track.title, track.artist, track.film].map((value) => value.toLowerCase()).join("|");
const schemaKeys = ["artist", "decade", "film", "language", "moods", "title", "year", "youtubeId"];

test("Bhojpuri runtime catalog contains exactly the audited 100-track set", () => {
  const playlist = loadPlaylist();
  const bhojpuri = playlist.filter((track) => track.language === "bhojpuri");
  const allIds = playlist.filter((track) => validId(track.youtubeId)).map((track) => track.youtubeId);
  const allIdentities = playlist.map(identity);

  assert.equal(playlist.length, 1061);
  assert.equal(bhojpuri.length, 100);
  assert.equal(bhojpuriCatalogHash(bhojpuri), EXPECTED_BHOJPURI_CATALOG_HASH);
  assert.ok(bhojpuri.every((track) => validId(track.youtubeId)));
  assert.ok(bhojpuri.every((track) => Array.isArray(track.moods) && track.moods.length > 0));
  assert.ok(bhojpuri.every((track) => Object.keys(track).sort().join("|") === schemaKeys.join("|")));
  assert.equal(new Set(bhojpuri.map((track) => track.youtubeId)).size, 100);
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(new Set(allIdentities).size, allIdentities.length);

  assert.equal(BHOJPURI_EXCLUDED_TRACKS.length, 8);
  // Ensure excluded tracks are not present in the runtime catalog
  assert.ok(BHOJPURI_EXCLUDED_TRACKS.every((excluded) => !bhojpuri.some((track) => (
    track.title.toLowerCase() === excluded.title.toLowerCase()
  ))));
});

test("all nine existing language catalogs are byte-for-byte unchanged", () => {
  const playlist = loadPlaylist();
  const expected = {
    hindi: [202, "70076151346d7fa1a3ee3fc29deffb0b6c151024d68083d4fed9f88988a48d75"],
    kannada: [80, "6c36fb2babaafb11a7f901ae949f683cfb21531161c1326a2ef3a58126be824a"],
    malayalam: [71, "f2cffa0825d2f672e818d835275aabf83bdab2c273639ae68db40b34877cd3a8"],
    telugu: [71, "29b75f488bbc25d4c8d2f15478f9577ea7ca82827e5a44b69fe1113a7c22a5b8"],
    tamil: [90, "36e820609bf5b734cfb1c6ebb6e784df160707c0ced5a9d9e47c2eb6cb125368"],
    bengali: [75, "39be17484a0b9764a1c30b76c34a858564fb22c0707768e58f856bebb59c3a45"],
    marathi: [80, "0e087357d323bfa4adc9a0dd9c8e3fe098c1c86a4e77e92d1f546558257bc591"],
    punjabi: [121, "ce3e6471b890836aef972019f40fd3785654ab725d5008037b91a49818191421"],
    odia: [93, "5c59f03ee3797cb85c4b3aa809b05d734ffb42f9e8f797e370471050402dd691"]
  };

  for (const [language, [count, hash]] of Object.entries(expected)) {
    const tracks = playlist.filter((track) => track.language === language);
    assert.equal(tracks.length, count);
    assert.equal(catalogHash(tracks), hash);
  }
});

test("Bhojpuri language and mood pools contain only eligible stable indices", () => {
  const tracks = loadPlaylist();
  const languages = ["all", "hindi", "kannada", "malayalam", "telugu", "tamil", "bengali", "marathi", "punjabi", "odia", "bhojpuri", "assamese"];
  const moods = ["all", ...new Set(tracks.flatMap((track) => track.moods))];

  for (const language of languages) {
    for (const mood of moods) {
      const indices = tracks
        .map((track, index) => ({ track, index }))
        .filter(({ track }) => validId(track.youtubeId)
          && (language === "all" || track.language === language)
          && (mood === "all" || track.moods.includes(mood)))
        .map(({ index }) => index);
      assert.equal(new Set(indices).size, indices.length);
      assert.ok(indices.every((index) => validId(tracks[index].youtubeId)));
      if (language === "bhojpuri") assert.ok(indices.every((index) => tracks[index].language === "bhojpuri"));
    }
  }
});

test("Bhojpuri filter uses the existing persistence, queue, navigation, and recovery paths", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");

  assert.match(html, /data-language="bhojpuri"/);
  assert.match(source, /new Set\(\["all", "hindi", "kannada", "malayalam", "telugu", "tamil", "bengali", "marathi", "punjabi", "odia", "bhojpuri", "assamese"\]\)/);
  assert.match(source, /availableLanguages\.has\(saved\.selectedLanguage\) \? saved\.selectedLanguage : "all"/);
  assert.match(source, /hasValidVideoId\(track\) &&\s*trackMatchesLanguage/);
  assert.match(source, /state\.shuffleBackStack = \[\];\s*rebuildShuffleQueue\(\)/);
  assert.match(source, /function sequentialFilteredIndex/);
  assert.match(source, /function skipFailedTrack\(requestId, failedIndex, message\)/);
  assert.match(source, /const waitingToStart = \[states\.UNSTARTED/);
  assert.doesNotMatch(source, /bhojpuri-unverified-tracks/);
  assert.doesNotMatch(html, /bhojpuri-unverified-tracks/);
});
