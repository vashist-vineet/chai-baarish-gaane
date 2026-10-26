import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

function loadPlaylist() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(new URL("../playlist.js", import.meta.url), "utf8"), context);
  return Array.from(context.window.CBG_PLAYLIST);
}

function catalogHash(tracks) {
  return crypto.createHash("sha256").update(JSON.stringify(tracks)).digest("hex");
}

function bengaliCatalogHash(tracks) {
  return catalogHash(tracks.map(({ title, artist, film, year, youtubeId }) => ({
    title,
    artist,
    film,
    year,
    youtubeId
  })));
}

// Locks the accepted order, identity metadata, and audited playback IDs.
// Update only after an intentional Bengali catalog change has been reviewed.
const EXPECTED_BENGALI_CATALOG_HASH = "7776d543b7595a65b35c7474921778c81086ab6ed7b27c1a4dea0c18046ee853";

const validId = (id) => /^[A-Za-z0-9_-]{11}$/.test(id);
const identity = (track) => [track.title, track.artist, track.film].map((value) => value.toLowerCase()).join("|");
const schemaKeys = ["artist", "decade", "film", "language", "moods", "title", "year", "youtubeId"];

test("Bengali runtime catalog contains exactly the audited 75-track set", () => {
  const playlist = loadPlaylist();
  const bengali = playlist.filter((track) => track.language === "bengali");
  const allIds = playlist.filter((track) => validId(track.youtubeId)).map((track) => track.youtubeId);
  const allIdentities = playlist.map(identity);

  assert.equal(playlist.length, 1365);
  assert.equal(bengali.length, 75);
  assert.equal(bengaliCatalogHash(bengali), EXPECTED_BENGALI_CATALOG_HASH);
  assert.ok(bengali.every((track) => validId(track.youtubeId)));
  assert.ok(bengali.every((track) => Array.isArray(track.moods) && track.moods.length > 0));
  assert.ok(bengali.every((track) => Object.keys(track).sort().join("|") === schemaKeys.join("|")));
  assert.equal(new Set(bengali.map((track) => track.youtubeId)).size, 75);
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(new Set(allIdentities).size, allIdentities.length);

  const excludedTitles = [
    "Tomar Khola Hawa",
    "Tomar Jonno",
    "Prithibi Ta Naki Choto Hote Hote",
    "Abar Bochhor Kuri Pore"
  ];
  assert.ok(excludedTitles.every((title) => !bengali.some((track) => track.title === title)));
  assert.equal(bengali.filter((track) => track.title === "2441139 (Bela Bose)").length, 1);
  assert.equal(bengali.filter((track) => track.youtubeId === "U5TDBu_hsbQ").length, 1);
});

test("all five existing language catalogs are byte-for-byte unchanged", () => {
  const playlist = loadPlaylist();
  const expected = {
    hindi: [202, "eb308a06c5a550912a1d77cbe521ffa8069d7fa6d8d3d1f4dd54973baf2e5811"],
    kannada: [80, "6c36fb2babaafb11a7f901ae949f683cfb21531161c1326a2ef3a58126be824a"],
    malayalam: [71, "f2cffa0825d2f672e818d835275aabf83bdab2c273639ae68db40b34877cd3a8"],
    telugu: [71, "29b75f488bbc25d4c8d2f15478f9577ea7ca82827e5a44b69fe1113a7c22a5b8"],
    tamil: [90, "36e820609bf5b734cfb1c6ebb6e784df160707c0ced5a9d9e47c2eb6cb125368"]
  };

  for (const [language, [count, hash]] of Object.entries(expected)) {
    const tracks = playlist.filter((track) => track.language === language);
    assert.equal(tracks.length, count);
    assert.equal(catalogHash(tracks), hash);
  }
});

test("Bengali language and mood pools contain only eligible stable indices", () => {
  const tracks = loadPlaylist();
  const languages = ["all", "hindi", "kannada", "malayalam", "telugu", "tamil", "bengali", "marathi", "punjabi", "odia", "bhojpuri", "assamese", "gujarati", "rajasthani"];
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
      if (language === "bengali") assert.ok(indices.every((index) => tracks[index].language === "bengali"));
    }
  }
});

test("Bengali filter uses the existing persistence, queue, navigation, and recovery paths", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");

  assert.match(html, /data-language="bengali"/);
  assert.match(html, /playlist\.js\?v=hindi-catalog-20261016-5/);
  assert.match(html, /hindi-playback-eligibility\.js\?v=verified-hindi-20261016-1/);
  assert.match(html, /script\.js\?v=playlist-lazy-render-20261019-1/);
  assert.match(source, /new Set\(\["all", "hindi", "kannada", "malayalam", "telugu", "tamil", "bengali", "marathi", "punjabi", "odia", "bhojpuri", "assamese", "gujarati", "rajasthani"\]\)/);
  assert.match(source, /availableLanguages\.has\(saved\.selectedLanguage\) \? saved\.selectedLanguage : "all"/);
  assert.match(source, /function filteredIndices\(\) \{\s*return eligibleTrackIndices/);
  assert.match(source, /state\.shuffleBackStack = \[\];\s*rebuildShuffleQueue\(\)/);
  assert.match(source, /function sequentialFilteredIndex/);
  assert.match(source, /function skipFailedTrack\(requestId, failedIndex, message\)/);
  assert.match(source, /const waitingToStart = \[states\.UNSTARTED/);
});
