import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");
const renderSource = source.slice(
  source.indexOf("  function playlistFilterKey"),
  source.indexOf("  function hasValidVideoId")
);

function createHarness({ open = false, indices = [0, 1] } = {}) {
  let playlistOpen = open;
  const writes = [];
  const list = {
    set innerHTML(value) { writes.push(value); },
    querySelector() { return null; }
  };
  const context = {
    document: { body: { classList: { contains: (name) => name === "playlist-open" && playlistOpen } } },
    state: {
      selectedLanguage: "all",
      selectedMood: "all",
      currentTrackIndex: 0,
      environment: "monsoon",
      playlistRendered: false,
      playlistRenderKey: ""
    },
    playlist: [
      { title: "First", artist: "Artist One", film: "Film One", year: "2001" },
      { title: "Second", artist: "Artist Two", film: "Film Two", year: "2002" }
    ],
    els: { playlist: list, drawerKicker: { textContent: "" } },
    ENVIRONMENTS: { monsoon: { drawerKicker: "ONE LONG BAARISH", pickLabel: "baarish" } },
    filteredIndices: () => indices,
    updateFilterOptionCounts() {}
  };
  const api = vm.runInNewContext(
    `${renderSource}; ({ renderPlaylist, updateTrackUI, playlistFilterKey })`,
    context
  );
  return {
    ...api,
    context,
    writes,
    setOpen(value) { playlistOpen = value; }
  };
}

test("playlist rows are deferred until the drawer opens and reused for unchanged filters", () => {
  const harness = createHarness();

  harness.renderPlaylist();
  assert.equal(harness.writes.length, 0, "startup summary work must not create playlist rows");
  assert.equal(harness.context.state.playlistRendered, false);
  assert.equal(harness.context.els.drawerKicker.textContent, "2 GAANE · ONE LONG BAARISH");

  harness.setOpen(true);
  harness.renderPlaylist();
  assert.equal(harness.writes.length, 1, "the first drawer opening renders the active eligible pool");
  assert.match(harness.writes[0], /data-index="0"/);
  assert.match(harness.writes[0], /data-index="1"/);

  harness.renderPlaylist();
  assert.equal(harness.writes.length, 1, "reopening with unchanged filters must reuse existing rows");
});

test("filter changes while closed stay deferred and render the new pool on the next opening", () => {
  const harness = createHarness({ open: true, indices: [0, 1] });
  harness.renderPlaylist();
  assert.equal(harness.writes.length, 1);

  harness.setOpen(false);
  harness.context.state.selectedMood = "romantic";
  harness.context.filteredIndices = () => [1];
  harness.renderPlaylist();
  assert.equal(harness.writes.length, 1, "closed drawers must not rebuild rows for a filter change");
  assert.equal(harness.context.state.playlistRendered, false);

  harness.setOpen(true);
  harness.renderPlaylist();
  assert.equal(harness.writes.length, 2);
  assert.match(harness.writes[1], /data-index="1"/);
  assert.doesNotMatch(harness.writes[1], /data-index="0"/);
});

test("track updates target the previous and current rows without a full row scan", () => {
  const previous = {
    dataset: { index: "0" },
    classList: { removeCalls: 0, remove() { this.removeCalls += 1; } }
  };
  const current = {
    dataset: { index: "1" },
    classList: { addCalls: 0, add() { this.addCalls += 1; } }
  };
  const harness = createHarness();
  harness.context.state.currentTrackIndex = 1;
  harness.context.playlist[1].moods = ["romantic"];
  harness.context.els = {
    ...harness.context.els,
    title: { textContent: "" }, artist: { textContent: "" }, mood: { textContent: "" },
    console: { dataset: {} }, progressFill: { style: {} }, elapsed: { textContent: "" }, duration: { textContent: "" },
    playlist: {
      querySelector(selector) {
        if (selector === "li.current") return previous;
        if (selector === 'li[data-index="1"]') return current;
        return null;
      }
    }
  };

  harness.updateTrackUI();
  assert.equal(previous.classList.removeCalls, 1);
  assert.equal(current.classList.addCalls, 1);
});

test("production initialization and drawer opening use the lazy rendering lifecycle", () => {
  assert.match(source, /function initialize\(\)[\s\S]*updatePlaylistSummary\(\);\s*updateTrackUI\(\);\s*bindEvents\(\);/);
  assert.match(source, /function openPlaylist\(\)[\s\S]*aria-hidden", "false"\);\s*renderPlaylist\(\);\s*els\.closePlaylist\.focus/);
  assert.doesNotMatch(source, /\$\$\("li", els\.playlist\)/, "active-row updates must not scan every rendered row");
});

test("filter option counts are deferred while closed and cached until filters change", () => {
  let playlistOpen = false;
  let countCalls = 0;
  const countEligibleTracks = () => {
    countCalls += 1;
    return 10;
  };
  const langOption = { value: "hindi", textContent: "Hindi", dataset: {} };
  const moodOption = { value: "romantic", textContent: "Romantic", dataset: {} };
  const context = {
    document: { body: { classList: { contains: (name) => name === "playlist-open" && playlistOpen } } },
    state: {
      selectedLanguage: "all",
      selectedMood: "all",
      filterCountsRenderKey: ""
    },
    els: {
      languageFilters: { options: [langOption] },
      moodFilters: { options: [moodOption] }
    },
    countEligibleTracks
  };
  const countsSource = source.slice(
    source.indexOf("  function updateFilterOptionCounts"),
    source.indexOf("  function updatePlaylistSummary")
  );
  const { updateFilterOptionCounts } = vm.runInNewContext(
    `${countsSource}; ({ updateFilterOptionCounts })`,
    context
  );

  updateFilterOptionCounts();
  assert.equal(countCalls, 0, "must not calculate filter counts while drawer is closed");
  assert.equal(langOption.textContent, "Hindi");

  playlistOpen = true;
  updateFilterOptionCounts();
  assert.equal(countCalls, 2, "calculates language and mood counts on first open");
  assert.equal(langOption.textContent, "Hindi (10)");
  assert.equal(moodOption.textContent, "Romantic (10)");
  assert.equal(context.state.filterCountsRenderKey, "all\u0000all");

  updateFilterOptionCounts();
  assert.equal(countCalls, 2, "reopening without filter changes reuses cached counts");

  context.state.selectedLanguage = "hindi";
  updateFilterOptionCounts();
  assert.equal(countCalls, 4, "filter changes recalculate option counts");
  assert.equal(context.state.filterCountsRenderKey, "hindi\u0000all");
});
