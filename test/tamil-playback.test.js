import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { TAMIL_EXCLUDED_TRACKS } from "../audit/tamil-unverified-tracks.js";

function loadPlaylist() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../playlist.js", import.meta.url), "utf8"), context);
  return Array.from(context.window.CBG_PLAYLIST);
}

function catalogHash(tracks) {
  return crypto.createHash("sha256").update(JSON.stringify(tracks)).digest("hex");
}

function tamilCatalogHash(tracks) {
  return catalogHash(tracks.map(({ title, artist, film, year, youtubeId }) => ({
    title,
    artist,
    film,
    year,
    youtubeId
  })));
}

// Locks the accepted order, identity metadata, and playback IDs for all 90 tracks.
// Update only after an intentional Tamil catalog change has been reviewed and verified.
const EXPECTED_TAMIL_CATALOG_HASH = "76f9dfb0910bbf18aa60962f30116d1a623e39a78eb1926f388a69fc2eccb793";

const validId = (id) => /^[A-Za-z0-9_-]{11}$/.test(id);
const identity = (track) => [track.title, track.artist, track.film].map((value) => value.toLowerCase()).join("|");
const schemaKeys = ["artist", "decade", "film", "language", "moods", "title", "year", "youtubeId"];

test("Tamil runtime catalog contains exactly the browser-verified set", () => {
  const playlist = loadPlaylist();
  const tamil = playlist.filter((track) => track.language === "tamil");
  const allIds = playlist.filter((track) => validId(track.youtubeId)).map((track) => track.youtubeId);
  const allIdentities = playlist.map(identity);

  assert.equal(tamil.length, 90);
  assert.equal(tamilCatalogHash(tamil), EXPECTED_TAMIL_CATALOG_HASH);
  assert.ok(tamil.every((track) => validId(track.youtubeId)));
  assert.ok(tamil.every((track) => Array.isArray(track.moods) && track.moods.length > 0));
  assert.ok(tamil.every((track) => Object.keys(track).sort().join("|") === schemaKeys.join("|")));
  assert.equal(new Set(tamil.map((track) => track.youtubeId)).size, 90);
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(new Set(allIdentities).size, allIdentities.length);
  assert.equal(TAMIL_EXCLUDED_TRACKS.length, 22);
  assert.ok(TAMIL_EXCLUDED_TRACKS.every((excluded) => !tamil.some((track) => (
    track.title === excluded.title && track.film === excluded.film
  ))));
  assert.ok(tamil.some((track) => track.title === "Munbe Vaa" && track.youtubeId === "rp3_FhRnIRw"));
  assert.ok(tamil.some((track) => track.title === "Hey Minnale" && track.youtubeId === "0Z3I8TSUwLI"));
});

test("Hindi, Kannada, Malayalam, and Telugu catalogs are byte-for-byte unchanged", () => {
  const playlist = loadPlaylist();
  const expected = {
    hindi: [202, "70076151346d7fa1a3ee3fc29deffb0b6c151024d68083d4fed9f88988a48d75"],
    kannada: [80, "6c36fb2babaafb11a7f901ae949f683cfb21531161c1326a2ef3a58126be824a"],
    malayalam: [71, "f2cffa0825d2f672e818d835275aabf83bdab2c273639ae68db40b34877cd3a8"],
    telugu: [71, "29b75f488bbc25d4c8d2f15478f9577ea7ca82827e5a44b69fe1113a7c22a5b8"]
  };

  for (const [language, [count, hash]] of Object.entries(expected)) {
    const tracks = playlist.filter((track) => track.language === language);
    assert.equal(tracks.length, count);
    assert.equal(catalogHash(tracks), hash);
  }
});

test("Tamil language and mood pools contain only eligible stable indices", () => {
  const tracks = loadPlaylist();
  const languages = ["all", "hindi", "kannada", "malayalam", "telugu", "tamil"];
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
      if (language === "tamil") assert.ok(indices.every((index) => tracks[index].language === "tamil"));
    }
  }
});

test("Tamil filter uses the existing queue, navigation, and recovery paths", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");

  assert.match(html, /data-language="tamil"/);
  assert.match(html, /playlist\.js\?v=tamil-playlist-20261009-1/);
  assert.match(html, /script\.js\?v=tamil-language-20261009-1/);
  assert.match(source, /new Set\(\["all", "hindi", "kannada", "malayalam", "telugu", "tamil"\]\)/);
  assert.match(source, /hasValidVideoId\(track\) &&\s*trackMatchesLanguage/);
  assert.match(source, /state\.shuffleBackStack = \[\];\s*rebuildShuffleQueue\(\)/);
  assert.match(source, /function skipFailedTrack\(requestId, failedIndex, message\)/);
  assert.match(source, /const waitingToStart = \[states\.UNSTARTED/);
  assert.doesNotMatch(source, /tamil-unverified-tracks/);
  assert.doesNotMatch(html, /tamil-unverified-tracks/);
});
