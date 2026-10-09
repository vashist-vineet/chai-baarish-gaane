import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { KANNADA_UNVERIFIED_TRACKS } from "../audit/kannada-unverified-tracks.js";

function loadPlaylist() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../playlist.js", import.meta.url), "utf8"), context);
  return context.window.CBG_PLAYLIST;
}

test("Kannada catalog keeps only verified, unique, playable-looking IDs", () => {
  const playlist = loadPlaylist();
  const kannada = Array.from(playlist).filter((track) => track.language === "kannada");
  const populatedIds = kannada.map((track) => track.youtubeId);

  assert.equal(playlist.length, 424);
  assert.equal(kannada.length, 80);
  assert.equal(playlist.filter((track) => track.language === "hindi").length, 202);
  assert.equal(new Set(populatedIds).size, populatedIds.length);
  assert.ok(populatedIds.every((id) => /^[A-Za-z0-9_-]{11}$/.test(id)));
  assert.equal(KANNADA_UNVERIFIED_TRACKS.length, 21);
  assert.ok(KANNADA_UNVERIFIED_TRACKS.every((track) => track.language === "kannada" && track.lastKnownYoutubeId));
  assert.ok(KANNADA_UNVERIFIED_TRACKS.every((excluded) => !kannada.some((track) => (
    track.title === excluded.title && track.artist === excluded.artist && track.film === excluded.film
  ))));

  const expectedOpeningIds = ["ruWm5ymTqTc", "uxd99hWcCwk", "FD3UN6dELZg", "8M0VCvCEZt0", "fWEnOMqpm_k"];
  assert.deepEqual(Array.from(kannada.slice(0, 5), (track) => track.youtubeId), expectedOpeningIds);
});

test("language and mood pools keep stable playable indices", () => {
  const playlist = loadPlaylist();
  const tracks = Array.from(playlist);
  const languages = ["all", "hindi", "kannada", "malayalam", "telugu"];
  const moods = ["all", ...new Set(tracks.flatMap((track) => Array.from(track.moods || [])))];

  for (const language of languages) {
    for (const mood of moods) {
      const eligible = tracks
        .map((track, index) => ({ track, index }))
        .filter(({ track }) => (language === "all" || track.language === language)
          && (mood === "all" || track.moods.includes(mood))
          && /^[A-Za-z0-9_-]{11}$/.test(track.youtubeId));
      const indices = eligible.map(({ index }) => index);

      assert.equal(new Set(indices).size, indices.length);
      assert.ok(eligible.every(({ track }) => track.youtubeId));
    }
  }

  assert.equal(tracks.filter((track) => /^[A-Za-z0-9_-]{11}$/.test(track.youtubeId)).length, 420);
  assert.equal(tracks.filter((track) => track.language === "hindi" && /^[A-Za-z0-9_-]{11}$/.test(track.youtubeId)).length, 198);
  assert.equal(tracks.filter((track) => track.language === "kannada" && /^[A-Za-z0-9_-]{11}$/.test(track.youtubeId)).length, 80);
});

test("player failure handling has one request-scoped skip gate and startup grace", () => {
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");
  assert.match(source, /function skipFailedTrack\(requestId, failedIndex, message\)/);
  assert.match(source, /state\.failedPlaybackRequestId === requestId/);
  assert.match(source, /const waitingToStart = \[states\.UNSTARTED/);
  assert.match(source, /hasValidVideoId\(track\) &&\s*trackMatchesLanguage/);
  assert.match(source, /activePool\.has\(state\.currentTrackIndex\)/);
  assert.match(source, /if \(activePool\.has\(candidate\)\) previousIndex = candidate/);
  assert.equal((source.match(/skipFailedTrack\(requestId, failedIndex,/g) || []).length, 3);
});
