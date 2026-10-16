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

function rajasthaniCatalogHash(tracks) {
  return catalogHash(tracks.map(({ title, artist, film, year, youtubeId }) => ({
    title,
    artist,
    film,
    year,
    youtubeId
  })));
}

// Locks the approved order, identities, credits, release metadata, and audited IDs.
// This protects catalog integrity, not current YouTube availability; update only after review.
const EXPECTED_RAJASTHANI_CORE_HASH = "c0180962115b85661a856f80bcf3d571137ca0fa7f9d5dac198169fc68763f01";
const EXPECTED_RAJASTHANI_FULL_HASH = "f7cf140919fb868655420ab134bb9cb83c751659b760d643cd86cc384d6e4e21";

const validId = (id) => /^[A-Za-z0-9_-]{11}$/.test(id);
const identity = (track) => [track.title, track.artist, track.film].map((value) => value.toLowerCase()).join("|");
const schemaKeys = ["artist", "decade", "film", "language", "moods", "title", "year", "youtubeId"];

test("Rajasthani runtime catalog contains exactly the approved ordered 33-track manifest", () => {
  const playlist = loadPlaylist();
  const rajasthani = playlist.filter((track) => track.language === "rajasthani");
  const otherTracks = playlist.filter((track) => track.language !== "rajasthani");
  const otherIds = new Set(otherTracks.map((track) => track.youtubeId).filter(validId));
  const allIds = playlist.filter((track) => validId(track.youtubeId)).map((track) => track.youtubeId);
  const allIdentities = playlist.map(identity);

  assert.equal(playlist.length, 1165);
  assert.equal(rajasthani.length, 33);
  assert.equal(rajasthaniCatalogHash(rajasthani), EXPECTED_RAJASTHANI_CORE_HASH);
  assert.equal(catalogHash(rajasthani), EXPECTED_RAJASTHANI_FULL_HASH);
  assert.ok(rajasthani.every((track) => validId(track.youtubeId)));
  assert.ok(rajasthani.every((track) => Array.isArray(track.moods) && track.moods.length > 0));
  assert.ok(rajasthani.every((track) => Object.keys(track).sort().join("|") === schemaKeys.join("|")));
  assert.equal(new Set(rajasthani.map((track) => track.youtubeId)).size, 33);
  assert.ok(rajasthani.every((track) => !otherIds.has(track.youtubeId)));
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(new Set(allIdentities).size, allIdentities.length);
  assert.equal(allIds.length, 1163);
  assert.deepEqual(
    playlist.filter((track) => !validId(track.youtubeId)).map((track) => track.title),
    ["Jaage Jaage", "Woh Lamhe"]
  );
});

test("all twelve pre-Rajasthani language catalogs are byte-for-byte unchanged", () => {
  const playlist = loadPlaylist();
  const expected = {
    hindi: [202, "eb308a06c5a550912a1d77cbe521ffa8069d7fa6d8d3d1f4dd54973baf2e5811"],
    kannada: [80, "6c36fb2babaafb11a7f901ae949f683cfb21531161c1326a2ef3a58126be824a"],
    malayalam: [71, "f2cffa0825d2f672e818d835275aabf83bdab2c273639ae68db40b34877cd3a8"],
    telugu: [71, "29b75f488bbc25d4c8d2f15478f9577ea7ca82827e5a44b69fe1113a7c22a5b8"],
    tamil: [90, "36e820609bf5b734cfb1c6ebb6e784df160707c0ced5a9d9e47c2eb6cb125368"],
    bengali: [75, "39be17484a0b9764a1c30b76c34a858564fb22c0707768e58f856bebb59c3a45"],
    marathi: [80, "0e087357d323bfa4adc9a0dd9c8e3fe098c1c86a4e77e92d1f546558257bc591"],
    punjabi: [121, "ce3e6471b890836aef972019f40fd3785654ab725d5008037b91a49818191421"],
    odia: [93, "5c59f03ee3797cb85c4b3aa809b05d734ffb42f9e8f797e370471050402dd691"],
    bhojpuri: [100, "79ae1f86d4099bc45684d301939eeef08398c66117a91b7d9386b9c38eac7a4a"],
    assamese: [78, "22bb703af49fc20054e63550f8aabc40b2ba4a7bc5842c724d401e515f6c1577"],
    gujarati: [71, "433502b614d6899f60e95767ecbb5a42439e731959336f178b73518b9304e702"]
  };

  for (const [language, [count, hash]] of Object.entries(expected)) {
    const tracks = playlist.filter((track) => track.language === language);
    assert.equal(tracks.length, count);
    assert.equal(catalogHash(tracks), hash);
  }
});

test("Rajasthani language and mood pools contain only eligible stable indices", () => {
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
      if (language === "rajasthani") assert.ok(indices.every((index) => tracks[index].language === "rajasthani"));
    }
  }
});

test("Rajasthani selector uses the existing persistence, queue, navigation, and recovery paths", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const source = fs.readFileSync(new URL("../script.js", import.meta.url), "utf8");

  assert.match(html, /data-language="rajasthani"/);
  assert.match(html, /<select id="languageFilters"/);
  assert.match(html, /<select id="moodFilters"/);
  assert.match(html, /playlist\.js\?v=hindi-catalog-20261016-5/);
  assert.match(html, /hindi-playback-eligibility\.js\?v=verified-hindi-20261016-1/);
  assert.match(html, /script\.js\?v=verified-hindi-20261016-1/);
  assert.match(source, /new Set\(\["all", "hindi", "kannada", "malayalam", "telugu", "tamil", "bengali", "marathi", "punjabi", "odia", "bhojpuri", "assamese", "gujarati", "rajasthani"\]\)/);
  assert.match(source, /availableLanguages\.has\(saved\.selectedLanguage\) \? saved\.selectedLanguage : "all"/);
  assert.match(source, /function filteredIndices\(\) \{\s*return eligibleTrackIndices/);
  assert.match(source, /state\.shuffleBackStack = \[\];\s*rebuildShuffleQueue\(\)/);
  assert.match(source, /languageFilters\.addEventListener\("change"/);
  assert.match(source, /moodFilters\.addEventListener\("change"/);
  assert.match(source, /function updateFilterOptionCounts\(\)/);
  assert.match(source, /countEligibleTracks\(option\.value, state\.selectedMood\)/);
  assert.match(source, /countEligibleTracks\(state\.selectedLanguage, option\.value\)/);
  assert.match(source, /function sequentialFilteredIndex/);
  assert.match(source, /function skipFailedTrack\(requestId, failedIndex, message\)/);
  assert.match(source, /const waitingToStart = \[states\.UNSTARTED/);
});
