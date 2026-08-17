(() => {
  "use strict";

  const playlist = window.CBG_PLAYLIST || [];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const AUDIO_MIX_VERSION = 3;
  const DEFAULTS = Object.freeze({ musicVolume: 0.45, rainVolume: 0.22, ambienceVolume: 0.12 });
  const STORM_COOLDOWN = 5000;
  const PLAYBACK_VERIFY_DELAY = 2600;
  const PLAYBACK_STALL_LIMIT = 7000;
  const MAX_PLAYBACK_RECOVERIES = 2;

  const els = {
    experience: $("#experience"),
    entry: $("#entry"),
    enter: $("#enterButton"),
    entryTime: $("#entryTime"),
    entryChair: $("#entryChair"),
    entryChairNote: $("#entryChairNote"),
    entryChai: $("#entryChai"),
    entryChaiNote: $("#entryChaiNote"),
    entryLightning: $("#entryLightning"),
    canvas: $("#rainCanvas"),
    entryCanvas: $("#entryRainCanvas"),
    lightning: $("#lightningWash"),
    lightningButton: $("#lightningButton"),
    chai: $("#chaiHotspot"),
    headlights: $("#headlights"),
    weather: $("#weatherNote"),
    console: $("#radioConsole"),
    title: $("#trackTitle"),
    artist: $("#trackArtist"),
    mood: $("#trackMood"),
    play: $("#playButton"),
    previous: $("#previousButton"),
    next: $("#nextButton"),
    shuffle: $("#shuffleButton"),
    ambience: $("#ambienceButton"),
    rainVolume: $("#rainVolume"),
    musicVolume: $("#musicVolume"),
    progress: $("#progress"),
    progressFill: $("#progressFill"),
    elapsed: $("#elapsed"),
    duration: $("#duration"),
    tapToPlay: $("#tapToPlay"),
    playlistButton: $("#playlistButton"),
    playlistDrawer: $("#playlistDrawer"),
    closePlaylist: $("#closePlaylist"),
    playlist: $("#playlist"),
    moodFilters: $("#moodFilters"),
    share: $("#shareButton"),
    fullscreen: $("#fullscreenButton"),
    toast: $("#toast")
  };

  const saved = readPreferences();
  const state = {
    entered: false,
    entryStarted: false,
    playerReady: false,
    isPlaying: false,
    playIntent: false,
    currentTrackIndex: Math.min(saved.currentTrack || 0, Math.max(playlist.length - 1, 0)),
    selectedMood: saved.selectedMood || "all",
    rainMode: saved.rainMode || "heavy",
    rainVolume: saved.audioMixVersion === AUDIO_MIX_VERSION ? (saved.rainVolume ?? DEFAULTS.rainVolume) : DEFAULTS.rainVolume,
    musicVolume: saved.audioMixVersion === AUDIO_MIX_VERSION ? (saved.musicVolume ?? DEFAULTS.musicVolume) : DEFAULTS.musicVolume,
    ambienceOn: saved.ambienceOn ?? true,
    shuffleEnabled: false,
    shuffleQueue: [],
    shufflePosition: 0,
    shuffleBackStack: [],
    playRequestId: 0,
    confirmedPlayingRequestId: 0,
    lastTrackLoadAt: 0,
    lastRequestedVideoId: "",
    lastTrackOrigin: "initial",
    playbackRecoveryAttempts: 0,
    lastPlaybackPosition: 0,
    lastPlaybackProgressAt: 0,
    recentSkips: [],
    chaiClicks: 0,
    entryChaiClicks: 0,
    erroredTracks: new Set(),
    uiTimer: null,
    lightningTimer: null,
    ambientTimer: null,
    distantRumbleTimer: null,
    inactivityTimer: null,
    progressTimer: null,
    lastManualStorm: 0
  };

  let player = null;
  let toastTimer = null;
  let musicRampToken = 0;
  let musicDuckTimer = null;
  let musicDucked = false;
  let playbackWatchdogTimer = null;
  let landingLightningTimer = null;
  let entryChairTimer = null;
  let entryChaiTimer = null;

  class AudioAtmosphere {
    constructor() {
      this.context = null;
      this.masterGain = null;
      this.rainGain = null;
      this.ambienceGain = null;
      this.thunderGain = null;
      this.rainLayers = [];
      this.thunderLayers = [];
      this.burstLayer = null;
      this.windLayer = null;
      this.weatherDrift = 1;
      this.dynamicsTimer = null;
      this.lastThunderIndex = -1;
      this.thunderActiveUntil = 0;
      this.initialized = false;
    }

    async start() {
      if (!this.initialized) this.create();
      this.startRainRecordings();
      if (this.context?.state === "suspended") await this.context.resume();
      this.setRainMode(state.rainMode, 3.2);
      this.setRainVolume(state.rainVolume, 2.4);
      this.setAmbience(state.ambienceOn, 1.8);
      this.scheduleNaturalDynamics();
    }

    async unlock() {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.context = new AudioContext();
      }
      if (this.context.state === "suspended") await this.context.resume();
    }

    create() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!this.context) this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.82;
      this.masterGain.connect(this.context.destination);

      this.rainGain = this.context.createGain();
      this.ambienceGain = this.context.createGain();
      this.thunderGain = this.context.createGain();
      this.rainGain.gain.value = 0;
      this.ambienceGain.gain.value = 0;
      this.thunderGain.gain.value = 0.82;
      this.rainGain.connect(this.masterGain);
      this.ambienceGain.connect(this.masterGain);
      this.thunderGain.connect(this.masterGain);

      const rainFiles = [
        { name: "light", src: "assets/audio/rain/light-rain.mp3", cutoff: 6400, rate: 0.985 },
        { name: "medium", src: "assets/audio/rain/medium-rain.mp3", cutoff: 5200, rate: 1 },
        { name: "roof", src: "assets/audio/rain/roof-rain.mp3", cutoff: 4300, rate: 1.012 }
      ];
      this.rainLayers = rainFiles.map((config) => this.createMediaLayer(config, this.rainGain, true));
      this.burstLayer = this.createMediaLayer({ src: "assets/audio/rain/rain-burst.mp3", cutoff: 5400 }, this.rainGain, false);
      this.windLayer = this.createMediaLayer({ src: "assets/audio/wind/storm-wind.mp3", cutoff: 2900 }, this.ambienceGain, true);

      const thunderFiles = [
        { src: "assets/audio/thunder/thunder-01-big-rumble.mp3", trim: 0.44, cutoff: 1700, tail: 10, distance: "mid" },
        { src: "assets/audio/thunder/thunder-02-deep-rumble.mp3", trim: 0.40, cutoff: 950, tail: 11, distance: "distant" },
        { src: "assets/audio/thunder/thunder-03-close.mp3", trim: 0.50, cutoff: 3100, tail: 6.5, distance: "close" },
        { src: "assets/audio/thunder/thunder-04-distant.mp3", trim: 0.34, cutoff: 720, tail: 10, distance: "distant" }
      ];
      this.thunderLayers = thunderFiles.map((config) => ({ ...this.createMediaLayer(config, this.thunderGain, false), ...config }));
      this.initialized = true;
    }

    createMediaLayer(config, destination, loop) {
      const audio = new Audio(config.src);
      const source = this.context.createMediaElementSource(audio);
      const gain = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      audio.loop = loop;
      audio.preload = "auto";
      audio.playsInline = true;
      audio.playbackRate = config.rate || 1;
      filter.type = "lowpass";
      filter.frequency.value = config.cutoff || 6000;
      filter.Q.value = 0.3;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(destination);
      if (loop) {
        audio.addEventListener("loadedmetadata", () => {
          if (Number.isFinite(audio.duration) && audio.duration > 8 && audio.currentTime < 0.1) {
            audio.currentTime = Math.random() * Math.max(1, audio.duration - 5);
          }
        }, { once: true });
      }
      return { audio, source, filter, gain };
    }

    startRainRecordings() {
      [...this.rainLayers, this.windLayer].forEach((layer) => {
        if (!layer) return;
        layer.audio.play().catch(() => { /* A failed layer must not break the room. */ });
      });
    }

    ramp(gainNode, value, seconds = 0.5) {
      if (!gainNode || !this.context) return;
      const now = this.context.currentTime;
      gainNode.gain.cancelScheduledValues(now);
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(Math.max(0, value), now + Math.max(0.05, seconds));
    }

    setRainVolume(value, seconds = 0.4) {
      const modeBoost = { light: 0.68, medium: 0.92, heavy: 1.12, storm: 1.28 }[state.rainMode] || 1;
      this.ramp(this.rainGain, Math.min(0.48, value * modeBoost * this.weatherDrift), seconds);
    }

    setRainMode(mode, seconds = 3) {
      if (!this.initialized) return;
      const mix = {
        light: [0.74, 0.04, 0.025],
        medium: [0.62, 0.22, 0.07],
        heavy: [0.48, 0.35, 0.15],
        storm: [0.39, 0.43, 0.21]
      }[mode] || [0.48, 0.35, 0.15];
      this.rainLayers.forEach((layer, index) => this.ramp(layer.gain, mix[index], seconds));
      this.setRainVolume(state.rainVolume, seconds);
    }

    setAmbience(on, seconds = 0.6) {
      this.ramp(this.ambienceGain, on ? DEFAULTS.ambienceVolume : 0, seconds);
    }

    scheduleNaturalDynamics() {
      clearTimeout(this.dynamicsTimer);
      this.dynamicsTimer = setTimeout(() => {
        this.weatherDrift = 0.9 + Math.random() * 0.18;
        this.setRainVolume(state.rainVolume, 8 + Math.random() * 7);
        this.scheduleNaturalDynamics();
      }, 20000 + Math.random() * 40000);
    }

    burst(duration = 6) {
      if (!this.burstLayer || !this.context) return;
      const now = this.context.currentTime;
      const layer = this.burstLayer;
      layer.audio.pause();
      layer.audio.currentTime = 0;
      layer.audio.play().catch(() => {});
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setValueAtTime(0, now);
      const burstLevel = Math.min(0.32, 0.13 + state.rainVolume * 0.55);
      layer.gain.gain.linearRampToValueAtTime(burstLevel, now + 1.1);
      layer.gain.gain.setValueAtTime(burstLevel, now + Math.max(1.2, duration - 2.3));
      layer.gain.gain.linearRampToValueAtTime(0, now + duration);
    }

    setWind(active, seconds = 1.2) {
      if (!this.windLayer) return;
      if (active) this.windLayer.audio.play().catch(() => {});
      this.ramp(this.windLayer.gain, active ? 0.82 : 0, seconds);
    }

    thunder(distance = "any") {
      if (!this.context || Date.now() < this.thunderActiveUntil) return false;
      let candidates = this.thunderLayers.map((_, index) => index);
      if (distance === "distant") candidates = candidates.filter((index) => this.thunderLayers[index].distance === "distant");
      if (distance === "close") candidates = candidates.filter((index) => this.thunderLayers[index].distance !== "distant");
      const nonRepeating = candidates.filter((index) => index !== this.lastThunderIndex);
      if (nonRepeating.length) candidates = nonRepeating;
      const index = candidates[Math.floor(Math.random() * candidates.length)];
      const layer = this.thunderLayers[index];
      if (!layer) return false;
      this.lastThunderIndex = index;
      this.thunderActiveUntil = Date.now() + layer.tail * 1000;
      layer.audio.pause();
      layer.audio.currentTime = 0;
      layer.audio.play().catch(() => {});
      const now = this.context.currentTime;
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setValueAtTime(0, now);
      layer.gain.gain.linearRampToValueAtTime(layer.trim, now + (layer.distance === "close" ? 0.06 : 0.32));
      layer.gain.gain.setValueAtTime(layer.trim, now + Math.min(2.1, layer.tail * 0.32));
      layer.gain.gain.exponentialRampToValueAtTime(0.001, now + layer.tail);
      duckMusic(Math.min(6200, layer.tail * 620));
      return true;
    }
  }

  class RainCanvas {
    constructor(canvas, activeWhen = () => true) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d", { alpha: true });
      this.activeWhen = activeWhen;
      this.drops = [];
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.running = true;
      this.burstMultiplier = 1;
      this.lastTime = performance.now();
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      this.resize();
      requestAnimationFrame(this.draw);
    }

    count() {
      const area = (this.width * this.height) / 950000;
      const base = { light: 105, medium: 185, heavy: 290, storm: 410 }[state.rainMode] || 290;
      return Math.round(base * Math.max(0.7, Math.min(1.55, area)) * (reducedMotion ? 0.18 : 1));
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.7);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.reset();
    }

    reset() {
      this.drops = Array.from({ length: this.count() }, () => this.makeDrop(true));
    }

    makeDrop(randomY = false) {
      const depth = Math.random();
      return {
        x: Math.random() * (this.width + 240) - 120,
        y: randomY ? Math.random() * this.height : -50 - Math.random() * 180,
        depth,
        length: 7 + depth * 31 + Math.random() * 10,
        speed: 280 + depth * 820 + Math.random() * 250,
        drift: 45 + depth * 75 + Math.random() * 26,
        opacity: 0.08 + depth * 0.28 + Math.random() * 0.12,
        width: depth > 0.8 ? 1.35 : 0.55 + depth * 0.55
      };
    }

    setMode() {
      this.reset();
    }

    burst() {
      this.burstMultiplier = 1.7;
      setTimeout(() => { this.burstMultiplier = 1; }, 6000);
    }

    draw(now) {
      requestAnimationFrame(this.draw);
      if (!this.running || document.hidden || !this.activeWhen()) {
        this.lastTime = now;
        return;
      }
      const delta = Math.min(0.035, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const ctx = this.context;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.lineCap = "round";

      for (let i = 0; i < this.drops.length; i += 1) {
        const drop = this.drops[i];
        const speed = drop.speed * this.burstMultiplier;
        drop.y += speed * delta;
        drop.x += drop.drift * delta * this.burstMultiplier;
        if (drop.y > this.height + 70 || drop.x > this.width + 120) this.drops[i] = this.makeDrop(false);
        const fade = Math.min(1, drop.y / 120 + 0.3);
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - drop.drift * 0.026, drop.y - drop.length * this.burstMultiplier);
        ctx.lineWidth = drop.width;
        ctx.strokeStyle = `rgba(200, 226, 238, ${drop.opacity * fade})`;
        ctx.stroke();
      }
    }
  }

  const atmosphere = new AudioAtmosphere();
  const rain = new RainCanvas(els.canvas, () => state.entered);
  const entryRain = new RainCanvas(els.entryCanvas, () => !document.body.classList.contains("entry-settled"));

  function readPreferences() {
    try {
      return JSON.parse(localStorage.getItem("cbg-preferences")) || {};
    } catch {
      return {};
    }
  }

  function savePreferences() {
    try {
      localStorage.setItem("cbg-preferences", JSON.stringify({
        audioMixVersion: AUDIO_MIX_VERSION,
        currentTrack: state.currentTrackIndex,
        selectedMood: state.selectedMood,
        rainMode: state.rainMode,
        rainVolume: state.rainVolume,
        musicVolume: state.musicVolume,
        ambienceOn: state.ambienceOn
      }));
    } catch { /* Preferences are optional. */ }
  }

  function showToast(message, duration = 3000) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), duration);
  }

  function filteredIndices() {
    return playlist
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => state.selectedMood === "all" || track.mood === state.selectedMood)
      .map(({ index }) => index);
  }

  function currentTrack() {
    return playlist[state.currentTrackIndex] || playlist[0];
  }

  function updateTrackUI() {
    const track = currentTrack();
    if (!track) return;
    els.title.textContent = track.title;
    els.artist.textContent = `${track.artist} · ${track.film}`;
    els.mood.textContent = `${track.mood} pick · ${track.year}`;
    els.console.dataset.trackIndex = String(state.currentTrackIndex);
    els.console.dataset.youtubeId = track.youtubeId;
    els.progressFill.style.width = "0%";
    els.elapsed.textContent = "0:00";
    els.duration.textContent = "—:—";
    $$("li", els.playlist).forEach((item) => item.classList.toggle("current", Number(item.dataset.index) === state.currentTrackIndex));
  }

  function renderPlaylist() {
    const indices = filteredIndices();
    els.playlist.innerHTML = indices.map((index, listIndex) => {
      const track = playlist[index];
      return `<li data-index="${index}" class="${index === state.currentTrackIndex ? "current" : ""}">
        <button data-index="${index}" aria-label="Play ${escapeHtml(track.title)} by ${escapeHtml(track.artist)}">
          <span class="track-number">${String(listIndex + 1).padStart(2, "0")}</span>
          <span class="playlist-copy"><strong>${escapeHtml(track.title)}</strong><span>${escapeHtml(track.artist)} · ${escapeHtml(track.film)}</span></span>
          <span class="track-year">${track.year}</span>
        </button>
      </li>`;
    }).join("");
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function hasValidVideoId(track) {
    return Boolean(track && typeof track.youtubeId === "string" && /^[A-Za-z0-9_-]{11}$/.test(track.youtubeId));
  }

  function playableIndices({ includeErrored = false } = {}) {
    return playlist
      .map((track, index) => ({ track, index }))
      .filter(({ track, index }) => hasValidVideoId(track) && (includeErrored || !state.erroredTracks.has(index)))
      .map(({ index }) => index);
  }

  function sequentialIndex(direction = 1, fromIndex = state.currentTrackIndex) {
    if (!playlist.length) return null;
    const playable = new Set(playableIndices());
    if (!playable.size) return null;
    for (let step = 1; step <= playlist.length; step += 1) {
      const candidate = (fromIndex + direction * step + playlist.length * 2) % playlist.length;
      if (playable.has(candidate)) return candidate;
    }
    return playable.has(fromIndex) ? fromIndex : [...playable][0];
  }

  function shuffleArray(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function rebuildShuffleQueue(excludeIndex = state.currentTrackIndex) {
    const pool = playableIndices().filter((index) => index !== excludeIndex);
    state.shuffleQueue = shuffleArray(pool);
    state.shufflePosition = 0;
  }

  function nextShuffleIndex() {
    if (state.shufflePosition >= state.shuffleQueue.length) rebuildShuffleQueue();
    const candidate = state.shuffleQueue[state.shufflePosition];
    if (Number.isInteger(candidate)) {
      state.shufflePosition += 1;
      return candidate;
    }
    return playableIndices().includes(state.currentTrackIndex) ? state.currentTrackIndex : null;
  }

  function playTrack(index, { autoplay = true, origin = "unknown" } = {}) {
    if (!Number.isInteger(index) || index < 0 || index >= playlist.length) return false;
    const track = playlist[index];
    const preserveExactSelection = !state.shuffleEnabled && (origin === "next" || origin === "playlist");
    if (!hasValidVideoId(track) || (state.erroredTracks.has(index) && !preserveExactSelection)) {
      if (!hasValidVideoId(track)) console.warn("Skipping track with invalid YouTube ID", { index, title: track?.title });
      const fallback = sequentialIndex(1, index);
      if (fallback === null || fallback === index) return false;
      return playTrack(fallback, { autoplay, origin: "invalid-fallback" });
    }

    const requestId = ++state.playRequestId;
    state.currentTrackIndex = index;
    state.confirmedPlayingRequestId = 0;
    state.playIntent = autoplay;
    state.playbackRecoveryAttempts = 0;
    state.lastPlaybackPosition = 0;
    state.lastPlaybackProgressAt = performance.now();
    state.lastTrackLoadAt = performance.now();
    state.lastRequestedVideoId = track.youtubeId;
    state.lastTrackOrigin = origin;
    delete els.console.dataset.playerVideoId;

    if (state.shuffleEnabled && origin === "playlist") {
      rebuildShuffleQueue(index);
      state.shuffleBackStack = [];
    }

    updateTrackUI();
    savePreferences();

    if (player && state.playerReady) {
      try {
        const targetVideoId = playlist[state.currentTrackIndex].youtubeId;
        if (autoplay) player.loadVideoById(targetVideoId);
        else player.cueVideoById(targetVideoId);
        player.setVolume(Math.round(state.musicVolume * (musicDucked ? 72 : 100)));
        if (autoplay) schedulePlaybackWatchdog(PLAYBACK_VERIFY_DELAY, requestId);

        setTimeout(() => {
          if (requestId !== state.playRequestId || !player || !state.playerReady) return;
          const activeId = player.getVideoData?.()?.video_id;
          if (activeId && activeId !== targetVideoId) player.loadVideoById(targetVideoId);
          if (autoplay) player.playVideo();
        }, 420);
      } catch {
        handleTrackError({ target: player });
      }
    }
    return true;
  }

  function nextTrack({ autoplay = true, origin = "next", countSkip = true } = {}) {
    if (countSkip) recordSkip();
    let nextIndex;
    if (state.shuffleEnabled) {
      nextIndex = nextShuffleIndex();
      if (nextIndex !== null && nextIndex !== state.currentTrackIndex) state.shuffleBackStack.push(state.currentTrackIndex);
    } else {
      nextIndex = (state.currentTrackIndex + 1) % playlist.length;
    }
    if (nextIndex === null) return false;
    if (nextIndex === state.currentTrackIndex && playableIndices().length > 1) return false;
    return playTrack(nextIndex, { autoplay, origin });
  }

  function previousTrack() {
    recordSkip();
    let previousIndex = null;
    if (state.shuffleEnabled && state.shuffleBackStack.length) previousIndex = state.shuffleBackStack.pop();
    if (previousIndex === null) previousIndex = sequentialIndex(-1);
    if (previousIndex === null) return false;
    return playTrack(previousIndex, { autoplay: true, origin: "previous" });
  }

  function toggleShuffle() {
    state.shuffleEnabled = !state.shuffleEnabled;
    els.console.dataset.shuffle = String(state.shuffleEnabled);
    els.shuffle.classList.toggle("active", state.shuffleEnabled);
    els.shuffle.setAttribute("aria-pressed", String(state.shuffleEnabled));
    els.shuffle.title = state.shuffleEnabled ? "Monsoon shuffle on" : "Monsoon shuffle";
    state.shuffleBackStack = [];

    if (state.shuffleEnabled) {
      rebuildShuffleQueue();
      showToast("Monsoon shuffle on. Jo aaya, woh suno.");
      return nextTrack({ autoplay: true, origin: "shuffle-enable" });
    }

    state.shuffleQueue = [];
    state.shufflePosition = 0;
    showToast("Seedhi cassette wapas.");
    return true;
  }

  function recordSkip() {
    const now = Date.now();
    state.recentSkips = [...state.recentSkips.filter((time) => now - time < 12000), now];
    if (state.recentSkips.length === 4) showToast("Gaana sun bhi le.");
  }

  function getPlaybackSnapshot() {
    if (!player || !state.playerReady) return null;
    try {
      return {
        videoId: player.getVideoData?.()?.video_id || "",
        playerState: player.getPlayerState?.(),
        position: player.getCurrentTime?.() || 0
      };
    } catch {
      return null;
    }
  }

  function schedulePlaybackWatchdog(delay = PLAYBACK_VERIFY_DELAY, requestId = state.playRequestId) {
    clearTimeout(playbackWatchdogTimer);
    if (!state.playIntent) return;
    playbackWatchdogTimer = setTimeout(() => verifyPlayback(requestId), delay);
  }

  function startCurrentTrackPlayback({ forceReload = false } = {}) {
    if (!player || !state.playerReady || !currentTrack()) return false;
    const targetVideoId = currentTrack().youtubeId;
    const snapshot = getPlaybackSnapshot();
    const states = window.YT?.PlayerState || {};
    const inactiveState = [states.UNSTARTED ?? -1, states.ENDED ?? 0, states.CUED ?? 5].includes(snapshot?.playerState);
    const wrongVideo = Boolean(snapshot?.videoId && snapshot.videoId !== targetVideoId);
    const shouldReload = wrongVideo || inactiveState || (forceReload && state.playbackRecoveryAttempts > 0);

    state.playIntent = true;
    try {
      if (shouldReload) {
        const startSeconds = wrongVideo ? 0 : Math.max(0, (snapshot?.position || 0) - 0.75);
        player.loadVideoById({ videoId: targetVideoId, startSeconds });
        state.lastPlaybackPosition = startSeconds;
        state.lastPlaybackProgressAt = performance.now();
      }
      player.setVolume(Math.round(state.musicVolume * (musicDucked ? 72 : 100)));
      player.playVideo();
      schedulePlaybackWatchdog(PLAYBACK_VERIFY_DELAY);
      return true;
    } catch {
      recoverPlayback(state.playRequestId);
      return false;
    }
  }

  function verifyPlayback(requestId) {
    if (requestId !== state.playRequestId || !state.playIntent || !player || !state.playerReady) return;
    const snapshot = getPlaybackSnapshot();
    if (!snapshot) return recoverPlayback(requestId);
    const expectedId = currentTrack()?.youtubeId;
    if (snapshot.videoId && snapshot.videoId !== expectedId) return recoverPlayback(requestId);

    const now = performance.now();
    const progressed = snapshot.position > state.lastPlaybackPosition + 0.12;
    if (progressed) {
      state.lastPlaybackPosition = snapshot.position;
      state.lastPlaybackProgressAt = now;
      state.playbackRecoveryAttempts = 0;
      schedulePlaybackWatchdog(3200, requestId);
      return;
    }

    const states = window.YT?.PlayerState || {};
    const temporarilyLoading = snapshot.playerState === (states.BUFFERING ?? 3)
      && now - state.lastPlaybackProgressAt < PLAYBACK_STALL_LIMIT;
    const justStarted = snapshot.playerState === (states.PLAYING ?? 1)
      && now - state.lastPlaybackProgressAt < PLAYBACK_STALL_LIMIT;
    if (temporarilyLoading || justStarted) {
      schedulePlaybackWatchdog(1800, requestId);
      return;
    }
    recoverPlayback(requestId);
  }

  function recoverPlayback(requestId) {
    if (requestId !== state.playRequestId || !state.playIntent) return;
    state.playbackRecoveryAttempts += 1;
    setPlaying(false);

    if (state.playbackRecoveryAttempts <= MAX_PLAYBACK_RECOVERIES) {
      if (state.playbackRecoveryAttempts === 1) showToast("Gaana ruk gaya. Dobara jod rahe hain…", 2300);
      startCurrentTrackPlayback({ forceReload: true });
      return;
    }

    clearTimeout(playbackWatchdogTimer);
    const failedIndex = state.currentTrackIndex;
    state.erroredTracks.add(failedIndex);
    state.shuffleQueue = state.shuffleQueue.filter((index) => index !== failedIndex);
    showToast("Yeh gaana nahi chala. Agla gaana laga rahe hain…", 3200);
    nextTrack({ autoplay: true, origin: "playback-fallback", countSkip: false });
  }

  function togglePlay() {
    if (!state.playerReady || !player) {
      els.tapToPlay.hidden = false;
      return;
    }
    try {
      if (state.isPlaying) {
        state.playIntent = false;
        clearTimeout(playbackWatchdogTimer);
        player.pauseVideo();
      } else {
        state.playbackRecoveryAttempts = 0;
        startCurrentTrackPlayback({ forceReload: true });
      }
    } catch {
      els.tapToPlay.hidden = false;
    }
  }

  function rampMusicVolume(target, duration = 600) {
    if (!player || !state.playerReady) return;
    const token = ++musicRampToken;
    let start = 0;
    try { start = (player.getVolume?.() || 0) / 100; } catch { start = target; }
    const startedAt = performance.now();
    const step = (now) => {
      if (token !== musicRampToken || !player || !state.playerReady) return;
      const progress = Math.min(1, (now - startedAt) / Math.max(50, duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      try { player.setVolume(Math.round((start + (target - start) * eased) * 100)); } catch { return; }
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function duckMusic(duration = 4200) {
    if (!state.playerReady || !state.isPlaying) return;
    clearTimeout(musicDuckTimer);
    musicDucked = true;
    rampMusicVolume(state.musicVolume * 0.72, 220);
    musicDuckTimer = setTimeout(() => {
      musicDucked = false;
      rampMusicVolume(state.musicVolume, 900);
    }, duration);
  }

  function setPlaying(isPlaying) {
    state.isPlaying = isPlaying;
    if (isPlaying) state.playIntent = true;
    els.console.classList.toggle("is-playing", isPlaying);
    els.play.setAttribute("aria-label", isPlaying ? "Pause" : "Play");
    if (isPlaying) els.tapToPlay.hidden = true;
  }

  function handleTrackError(event) {
    const requestId = state.playRequestId;
    const failedIndex = state.currentTrackIndex;
    const expectedId = playlist[failedIndex]?.youtubeId;
    const reportedId = event?.target?.getVideoData?.()?.video_id;
    if (reportedId && reportedId !== expectedId) return;

    const elapsedSinceLoad = performance.now() - state.lastTrackLoadAt;
    const delay = reportedId ? 90 : Math.max(90, 950 - elapsedSinceLoad);

    setTimeout(() => {
      if (requestId !== state.playRequestId || failedIndex !== state.currentTrackIndex) return;
      if (!reportedId && state.confirmedPlayingRequestId === requestId) return;
      const currentPlayerId = player?.getVideoData?.()?.video_id;
      if (currentPlayerId && currentPlayerId !== expectedId) return;
      state.erroredTracks.add(failedIndex);
      state.shuffleQueue = state.shuffleQueue.filter((index) => index !== failedIndex);
      clearTimeout(playbackWatchdogTimer);
      showToast("Yeh gaana aaj nahi mila. Cassette aage badh rahi hai…");
      nextTrack({ autoplay: true, origin: "error", countSkip: false });
    }, delay);
  }

  function handleTrackEnded(event) {
    const endedId = event?.target?.getVideoData?.()?.video_id;
    if (endedId && endedId !== currentTrack()?.youtubeId) return;
    nextTrack({ autoplay: true, origin: "ended", countSkip: false });
  }

  function loadYouTube() {
    if (window.YT?.Player) return createPlayer();
    window.onYouTubeIframeAPIReady = createPlayer;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => showToast("Gaane connect nahi hue. Baarish phir bhi yahin hai.", 5000);
    document.head.appendChild(script);
  }

  function createPlayer() {
    if (player || !playlist.length) return;
    const vars = {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      playsinline: 1,
      rel: 0,
      modestbranding: 1
    };
    if (location.protocol.startsWith("http")) vars.origin = location.origin;

    player = new YT.Player("youtubePlayer", {
      width: "200",
      height: "200",
      videoId: currentTrack().youtubeId,
      playerVars: vars,
      events: {
        onReady(event) {
          state.playerReady = true;
          state.playIntent = true;
          state.playbackRecoveryAttempts = 0;
          state.lastPlaybackPosition = 0;
          state.lastPlaybackProgressAt = performance.now();
          event.target.setVolume(0);
          const targetVideoId = currentTrack().youtubeId;
          event.target.loadVideoById(targetVideoId);
          setTimeout(() => rampMusicVolume(state.musicVolume, 1200), 550);
          schedulePlaybackWatchdog(PLAYBACK_VERIFY_DELAY);
          setTimeout(() => {
            if (!state.isPlaying) els.tapToPlay.hidden = false;
          }, 1700);
        },
        onStateChange(event) {
          const eventVideoId = event.target.getVideoData?.()?.video_id;
          const isCurrentVideo = !eventVideoId || eventVideoId === currentTrack()?.youtubeId;
          if (!isCurrentVideo) return;
          if (eventVideoId) els.console.dataset.playerVideoId = eventVideoId;
          if (event.data === YT.PlayerState.PLAYING) {
            if (eventVideoId === currentTrack()?.youtubeId) state.confirmedPlayingRequestId = state.playRequestId;
            state.lastPlaybackPosition = event.target.getCurrentTime?.() || 0;
            state.lastPlaybackProgressAt = performance.now();
            setPlaying(true);
            schedulePlaybackWatchdog(3200);
          }
          if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.CUED) {
            setPlaying(false);
            if (state.playIntent) schedulePlaybackWatchdog(1200);
          }
          if (event.data === YT.PlayerState.BUFFERING) {
            setPlaying(false);
            if (state.playIntent) schedulePlaybackWatchdog(PLAYBACK_STALL_LIMIT);
          }
          if (event.data === YT.PlayerState.ENDED && eventVideoId === currentTrack()?.youtubeId) handleTrackEnded(event);
        },
        onError: handleTrackError
      }
    });
  }

  function updateProgress() {
    clearInterval(state.progressTimer);
    state.progressTimer = setInterval(() => {
      if (!player || !state.playerReady) return;
      try {
        const playerVideoId = player.getVideoData?.()?.video_id;
        if (playerVideoId && playerVideoId !== currentTrack()?.youtubeId) return;
        const current = player.getCurrentTime() || 0;
        const duration = player.getDuration() || 0;
        els.elapsed.textContent = formatTime(current);
        els.duration.textContent = duration ? formatTime(duration) : "—:—";
        els.progressFill.style.width = duration ? `${(current / duration) * 100}%` : "0%";
      } catch { /* Player may be between videos. */ }
    }, 1000);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function enterExperience() {
    if (state.entryStarted) return;
    state.entryStarted = true;
    clearTimeout(landingLightningTimer);
    document.body.classList.add("entering");
    els.enter.disabled = true;

    // Preserve the click's audio permission without building the full sound graph
    // before the browser has painted the first transition frame.
    atmosphere.unlock().catch(() => {});

    const revealExperience = () => {
      state.entered = true;
      document.body.classList.add("entry-transition-active", "entered");

      setTimeout(() => {
        atmosphere.start().catch(() => showToast("Sound nahi chala. Baarish dekhte hain."));
        scheduleLightning();
        scheduleAmbientEvent();
        scheduleDistantRumble();
        resetInactivityMessage();
      }, reducedMotion ? 0 : 90);

      // YouTube iframe creation is the expensive part; start it after the visual
      // crossfade is already in motion so it cannot freeze the entry UI.
      setTimeout(() => {
        loadYouTube();
        updateProgress();
      }, reducedMotion ? 0 : 460);

      setTimeout(() => {
        document.body.classList.add("entry-settled");
        document.body.classList.remove("entering", "entry-transition-active");
      }, reducedMotion ? 80 : 760);
      setTimeout(() => showToast("Aaj kaam rehne do."), reducedMotion ? 250 : 1050);
      setTimeout(resetUiTimer, reducedMotion ? 300 : 1200);
    };

    if (reducedMotion) {
      revealExperience();
      return;
    }

    requestAnimationFrame(() => requestAnimationFrame(revealExperience));
  }

  function scheduleLandingLightning() {
    clearTimeout(landingLightningTimer);
    if (state.entered || reducedMotion) return;
    landingLightningTimer = setTimeout(() => {
      if (state.entered) return;
      triggerLightning(Math.random() > 0.7 ? "soft" : "distant");
      scheduleLandingLightning();
    }, 9000 + Math.random() * 13000);
  }

  function setRainMode(mode, announce = true) {
    if (!Object.hasOwn({ light: 1, medium: 1, heavy: 1, storm: 1 }, mode)) return;
    state.rainMode = mode;
    document.body.dataset.rainMode = mode;
    $$("[data-rain]").forEach((button) => button.classList.toggle("active", button.dataset.rain === mode));
    rain.setMode();
    atmosphere.setRainMode(mode, 3.2);
    clearTimeout(state.lightningTimer);
    if (state.entered) scheduleLightning();
    savePreferences();
    if (announce) {
      const copy = { light: "Halki si baarish.", medium: "Theek-thaak monsoon.", heavy: "Baarish rukne wali nahi.", storm: "Chhatri se kuch nahi hoga." };
      showToast(copy[mode]);
    }
  }

  function triggerLightning(type) {
    if (reducedMotion) return;
    const types = ["soft", "double", "strong", "distant"];
    const flashType = type || (state.rainMode === "storm" && Math.random() > 0.45 ? "strong" : types[Math.floor(Math.random() * types.length)]);
    const className = `flash-${flashType}`;
    [els.lightning, els.entryLightning].filter(Boolean).forEach((target) => {
      target.className = target === els.lightning ? "lightning-wash" : "entry-lightning";
      void target.offsetWidth;
      target.classList.add(className);
    });
  }

  function automaticWeatherEvent() {
    const event = Math.random();
    if (event < 0.22) {
      triggerLightning("distant");
      return;
    }
    if (event < 0.49) {
      triggerLightning("soft");
      setTimeout(() => atmosphere.thunder("distant"), 700 + Math.random() * 1800);
      return;
    }
    if (event < 0.73) {
      triggerLightning("double");
      setTimeout(() => atmosphere.thunder("any"), 350 + Math.random() * 1300);
      return;
    }
    if (event < 0.91) {
      atmosphere.burst(6.5);
      rain.burst();
      setTimeout(() => triggerLightning("strong"), 650 + Math.random() * 500);
      setTimeout(() => atmosphere.thunder("close"), 1200 + Math.random() * 1200);
      return;
    }
    atmosphere.thunder("distant");
  }

  function manualStormEvent(message = "Storm aa gaya.") {
    const now = Date.now();
    if (now - state.lastManualStorm < STORM_COOLDOWN) {
      showToast("Bas bas, badal ko thoda waqt do.");
      return false;
    }
    state.lastManualStorm = now;
    clearTimeout(state.lightningTimer);
    document.body.classList.add("storm-event");
    atmosphere.setWind(true, 0.7);
    atmosphere.burst(7.2);
    rain.burst();
    setTimeout(() => triggerLightning("strong"), 260 + Math.random() * 260);
    setTimeout(() => atmosphere.thunder("close"), 520 + Math.random() * 520);
    setTimeout(() => {
      document.body.classList.remove("storm-event");
      atmosphere.setWind(false, 2.2);
      scheduleLightning();
    }, 7200);
    showToast(message);
    return true;
  }

  function scheduleLightning() {
    clearTimeout(state.lightningTimer);
    const ranges = { light: [24000, 38000], medium: [19000, 32000], heavy: [15000, 30000], storm: [11000, 22000] };
    const [min, max] = ranges[state.rainMode];
    state.lightningTimer = setTimeout(() => {
      automaticWeatherEvent();
      scheduleLightning();
    }, min + Math.random() * (max - min));
  }

  function scheduleAmbientEvent() {
    clearTimeout(state.ambientTimer);
    state.ambientTimer = setTimeout(() => {
      const pick = Math.random();
      if (pick < 0.34) {
        rain.burst();
        atmosphere.burst();
      } else if (pick < 0.62) {
        els.headlights.classList.remove("pass");
        void els.headlights.offsetWidth;
        els.headlights.classList.add("pass");
      } else if (pick < 0.82) {
        els.chai.classList.add("steam-boost");
        setTimeout(() => els.chai.classList.remove("steam-boost"), 5000);
      } else {
        rain.burst();
        atmosphere.burst(5.2);
      }
      scheduleAmbientEvent();
    }, 16000 + Math.random() * 24000);
  }

  function scheduleDistantRumble() {
    clearTimeout(state.distantRumbleTimer);
    state.distantRumbleTimer = setTimeout(() => {
      atmosphere.thunder("distant");
      scheduleDistantRumble();
    }, 150000 + Math.random() * 150000);
  }

  function resetUiTimer() {
    if (!state.entered) return;
    document.body.classList.remove("ui-idle");
    clearTimeout(state.uiTimer);
    state.uiTimer = setTimeout(() => {
      if (!document.body.classList.contains("playlist-open")) document.body.classList.add("ui-idle");
    }, 5200);
  }

  function resetInactivityMessage() {
    clearTimeout(state.inactivityTimer);
    state.inactivityTimer = setTimeout(() => showToast("Soya nahi?", 3500), 120000);
  }

  function openPlaylist() {
    document.body.classList.add("playlist-open");
    els.playlistDrawer.removeAttribute("inert");
    els.playlistDrawer.setAttribute("aria-hidden", "false");
    els.closePlaylist.focus();
  }

  function closePlaylist() {
    document.body.classList.remove("playlist-open");
    els.playlistDrawer.setAttribute("aria-hidden", "true");
    els.playlistDrawer.setAttribute("inert", "");
    els.playlistButton.focus();
    resetUiTimer();
  }

  async function shareBaarish() {
    const data = {
      title: "Chai Baarish Gaane",
      text: "Found a tiny corner of the internet for chai, baarish and purane gaane. 🌧️☕",
      url: location.href
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(location.href);
        showToast("Baarish ka link copy ho gaya.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Link copy nahi hua. Address bar se le lo, dost.");
    }
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await els.experience.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      showToast("Fullscreen ka mood browser ne kharab kar diya.");
    }
  }

  function updateClock() {
    const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date());
    els.weather.textContent = `VERANDA · ${time.toUpperCase()}`;
    if (els.entryTime) els.entryTime.textContent = time.toUpperCase();
  }

  function bindEvents() {
    els.enter.addEventListener("click", enterExperience);
    els.entryChair?.addEventListener("click", () => {
      els.entryChair.classList.add("invited");
      els.entryChairNote.classList.add("show");
      clearTimeout(entryChairTimer);
      entryChairTimer = setTimeout(() => {
        els.entryChair.classList.remove("invited");
        els.entryChairNote.classList.remove("show");
      }, 2400);
    });
    els.entryChai?.addEventListener("click", () => {
      state.entryChaiClicks += 1;
      const messages = ["Garam hai. Sambhal ke.", "Ek aur?", "Bas thodi der baitho."];
      els.entryChaiNote.textContent = messages[Math.min(state.entryChaiClicks - 1, messages.length - 1)];
      els.entryChaiNote.classList.add("show");
      els.entryChai.classList.add("warm");
      clearTimeout(entryChaiTimer);
      entryChaiTimer = setTimeout(() => {
        els.entryChaiNote.classList.remove("show");
        els.entryChai.classList.remove("warm");
      }, 2400);
    });
    els.play.addEventListener("click", togglePlay);
    els.tapToPlay.addEventListener("click", togglePlay);
    els.next.addEventListener("click", () => nextTrack());
    els.previous.addEventListener("click", previousTrack);
    els.shuffle.addEventListener("click", toggleShuffle);
    els.playlistButton.addEventListener("click", openPlaylist);
    els.closePlaylist.addEventListener("click", closePlaylist);
    els.share.addEventListener("click", shareBaarish);
    els.fullscreen.addEventListener("click", toggleFullscreen);
    els.lightningButton.addEventListener("click", () => {
      manualStormEvent("Bijli ka bill tumhara nahi hai.");
    });

    els.chai.addEventListener("click", () => {
      state.chaiClicks += 1;
      const messages = ["Garam hai. Sambhal ke.", "Ek aur bana du?", "Chai pehle. Kaam baad mein.", "Bhai, chai khatam ho gayi."];
      showToast(messages[Math.min(state.chaiClicks - 1, messages.length - 1)]);
      els.chai.classList.add("steam-boost");
      setTimeout(() => els.chai.classList.remove("steam-boost"), 3200);
    });

    els.ambience.addEventListener("click", () => {
      state.ambienceOn = !state.ambienceOn;
      atmosphere.setAmbience(state.ambienceOn);
      els.ambience.classList.toggle("active", state.ambienceOn);
      els.ambience.setAttribute("aria-label", `Turn ambience ${state.ambienceOn ? "off" : "on"}`);
      els.ambience.title = `Ambience ${state.ambienceOn ? "on" : "off"}`;
      showToast(state.ambienceOn ? "Ghar ki awaazein wapas." : "Sirf baarish aur gaana.");
      savePreferences();
    });

    els.rainVolume.addEventListener("input", (event) => {
      state.rainVolume = Number(event.target.value) / 100;
      event.target.style.setProperty("--range", `${event.target.value}%`);
      atmosphere.setRainVolume(state.rainVolume);
      savePreferences();
    });

    els.musicVolume.addEventListener("input", (event) => {
      state.musicVolume = Number(event.target.value) / 100;
      event.target.style.setProperty("--range", `${event.target.value}%`);
      if (player && state.playerReady) rampMusicVolume(state.musicVolume * (musicDucked ? 0.72 : 1), 180);
      savePreferences();
    });

    els.progress.addEventListener("click", (event) => {
      if (!player || !state.playerReady) return;
      const rect = els.progress.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      try { player.seekTo(player.getDuration() * ratio, true); } catch { /* Ignore seek race. */ }
    });

    els.playlist.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-index]");
      if (!button) return;
      playTrack(Number(button.dataset.index), { autoplay: true, origin: "playlist" });
      closePlaylist();
    });

    els.moodFilters.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-mood]");
      if (!button) return;
      state.selectedMood = button.dataset.mood;
      $$("button", els.moodFilters).forEach((item) => item.classList.toggle("active", item === button));
      renderPlaylist();
      savePreferences();
    });

    $$("[data-rain]").forEach((button) => button.addEventListener("click", () => {
      setRainMode(button.dataset.rain);
      if (button.dataset.rain === "storm") manualStormEvent("Oh ho. Storm aa gaya.");
    }));

    ["pointermove", "pointerdown", "touchstart", "keydown"].forEach((eventName) => {
      window.addEventListener(eventName, () => {
        resetUiTimer();
        resetInactivityMessage();
      }, { passive: true });
    });

    if (!reducedMotion && window.matchMedia("(pointer: fine)").matches) {
      const depthLayers = $$("[data-depth]", els.entry);
      els.entry.addEventListener("pointermove", (event) => {
        if (state.entered) return;
        const horizontal = event.clientX / window.innerWidth - 0.5;
        const vertical = event.clientY / window.innerHeight - 0.5;
        els.entry.style.setProperty("--cursor-x", `${event.clientX}px`);
        els.entry.style.setProperty("--cursor-y", `${event.clientY}px`);
        depthLayers.forEach((layer) => {
          const depth = Number(layer.dataset.depth || 1);
          layer.style.setProperty("--layer-x", `${horizontal * depth * -1.15}px`);
          layer.style.setProperty("--layer-y", `${vertical * depth * -0.8}px`);
        });
      }, { passive: true });
      els.entry.addEventListener("pointerleave", () => {
        depthLayers.forEach((layer) => {
          layer.style.setProperty("--layer-x", "0px");
          layer.style.setProperty("--layer-y", "0px");
        });
      }, { passive: true });
    }

    document.addEventListener("keydown", (event) => {
      if (!state.entered && (event.key === "Enter" || event.key === " ")) {
        if (["BUTTON", "INPUT", "A"].includes(document.activeElement?.tagName)) return;
        event.preventDefault();
        enterExperience();
        return;
      }
      if (!state.entered || ["INPUT", "BUTTON"].includes(document.activeElement?.tagName)) return;
      if (event.code === "Space") { event.preventDefault(); togglePlay(); }
      if (event.key === "ArrowRight") nextTrack();
      if (event.key === "ArrowLeft") previousTrack();
      if (event.key.toLowerCase() === "f") toggleFullscreen();
      if (event.key.toLowerCase() === "p") openPlaylist();
      if (event.key === "Escape" && document.body.classList.contains("playlist-open")) closePlaylist();
    });

    document.addEventListener("visibilitychange", () => { rain.running = !document.hidden; });
    document.addEventListener("fullscreenchange", () => {
      const active = Boolean(document.fullscreenElement);
      els.fullscreen.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
    });
  }

  function initialize() {
    if (!playlist.length) {
      els.title.textContent = "Baarish only tonight";
      els.artist.textContent = "Playlist could not be loaded";
    }
    if (!hasValidVideoId(currentTrack())) state.currentTrackIndex = playableIndices({ includeErrored: true })[0] ?? 0;
    els.rainVolume.value = Math.round(state.rainVolume * 100);
    els.musicVolume.value = Math.round(state.musicVolume * 100);
    els.rainVolume.style.setProperty("--range", `${els.rainVolume.value}%`);
    els.musicVolume.style.setProperty("--range", `${els.musicVolume.value}%`);
    els.ambience.classList.toggle("active", state.ambienceOn);
    els.ambience.setAttribute("aria-label", `Turn ambience ${state.ambienceOn ? "off" : "on"}`);
    els.console.dataset.shuffle = "false";
    document.body.dataset.rainMode = state.rainMode;
    $$("[data-rain]").forEach((button) => button.classList.toggle("active", button.dataset.rain === state.rainMode));
    $$("[data-mood]", els.moodFilters).forEach((button) => button.classList.toggle("active", button.dataset.mood === state.selectedMood));
    updateClock();
    setInterval(updateClock, 60000);
    renderPlaylist();
    updateTrackUI();
    bindEvents();
    scheduleLandingLightning();
  }

  initialize();
})();
