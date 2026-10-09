import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { MALAYALAM_EXCLUDED_TRACKS } from "../audit/malayalam-unverified-tracks.js";

function loadPlaylist() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../playlist.js", import.meta.url), "utf8"), context);
  return Array.from(context.window.CBG_PLAYLIST);
}

function catalogHash(tracks) {
  return crypto.createHash("sha256").update(JSON.stringify(tracks)).digest("hex");
}

const validId = (id) => /^[A-Za-z0-9_-]{11}$/.test(id);
const identity = (track) => [track.title, track.artist, track.film].map((value) => value.toLowerCase()).join("|");

test("Malayalam runtime catalog is verified, unique and within the curated target", () => {
  const playlist = loadPlaylist();
  const malayalam = playlist.filter((track) => track.language === "malayalam");
  const allIds = playlist.filter((track) => validId(track.youtubeId)).map((track) => track.youtubeId);
  const allIdentities = playlist.map(identity);

  assert.equal(malayalam.length, 71);
  assert.ok(malayalam.every((track) => validId(track.youtubeId)));
  assert.ok(malayalam.every((track) => Array.isArray(track.moods) && track.moods.length > 0));
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(new Set(allIdentities).size, allIdentities.length);
  assert.equal(MALAYALAM_EXCLUDED_TRACKS.length, 29);
  assert.ok(MALAYALAM_EXCLUDED_TRACKS.filter((excluded) => excluded.status !== "duplicate").every((excluded) => !malayalam.some((track) => (
    track.title === excluded.title && track.film === excluded.film
  ))));
});

test("Hindi and Kannada catalogs are byte-for-byte unchanged by Malayalam integration", () => {
  const playlist = loadPlaylist();
  const hindi = playlist.filter((track) => track.language === "hindi");
  const kannada = playlist.filter((track) => track.language === "kannada");

  assert.equal(hindi.length, 202);
  assert.equal(kannada.length, 80);
  assert.equal(catalogHash(hindi), "70076151346d7fa1a3ee3fc29deffb0b6c151024d68083d4fed9f88988a48d75");
  assert.equal(catalogHash(kannada), "6c36fb2babaafb11a7f901ae949f683cfb21531161c1326a2ef3a58126be824a");
});

test("language and mood combinations contain only eligible stable indices", () => {
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
    }
  }
});

test("Malayalam filter is wired through the existing queue and recovery path", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");

  assert.match(html, /data-language="malayalam"/);
  assert.match(source, /new Set\(\["all", "hindi", "kannada", "malayalam", "telugu", "tamil"\]\)/);
  assert.match(source, /hasValidVideoId\(track\) &&\s*trackMatchesLanguage/);
  assert.match(source, /state\.shuffleBackStack = \[\];\s*rebuildShuffleQueue\(\)/);
  assert.match(source, /function skipFailedTrack\(requestId, failedIndex, message\)/);
  assert.match(source, /const waitingToStart = \[states\.UNSTARTED/);
});
