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
  const DEFAULT_ENVIRONMENT_TRANSITION_MS = reducedMotion ? 900 : 3000;
  const SPRING_ENVIRONMENT_TRANSITION_MS = reducedMotion ? 1100 : 4200;
  const ENVIRONMENT_ATTENTION_DELAY = 6200;
  const ENVIRONMENT_ATTENTION_DURATION = reducedMotion ? 1800 : 3600;
  const COAST_PLAYBACK_RATES = Object.freeze({ light: 0.17, medium: 0.23, heavy: 0.30, storm: 0.38 });
  const ENVIRONMENTS = Object.freeze({
    monsoon: Object.freeze({
      weather: "rain",
      volumeIcon: "🌧",
      volumeLabel: "RAIN",
      volumeAria: "Rain volume",
      modesAria: "Rain intensity",
      modeLabels: Object.freeze({ light: "light", medium: "medium", heavy: "heavy", storm: "storm" }),
      hint: "baarish se bore ho gaye?",
      button: "mausam badlo",
      buttonAria: "Change weather to winter",
      actionAria: "Call lightning",
      next: "winter",
      pickLabel: "baarish",
      shuffleLabel: "Monsoon shuffle",
      shareLabel: "share this baarish ☕",
      placeLabel: "VERANDA",
      toast: "Phir se baarish.",
      modeToasts: Object.freeze({ light: "Halki si baarish.", medium: "Theek-thaak monsoon.", heavy: "Baarish rukne wali nahi.", storm: "Chhatri se kuch nahi hoga." }),
      drawerKicker: "36 GAANE · ONE LONG BAARISH",
      drawerTitle: "Shaam ki cassette"
    }),
    winter: Object.freeze({
      weather: "snow",
      volumeIcon: "❄",
      volumeLabel: "SNOW",
      volumeAria: "Winter ambience volume",
      modesAria: "Snow intensity",
      modeLabels: Object.freeze({ light: "soft", medium: "steady", heavy: "heavy", storm: "blizzard" }),
      hint: "thand se mann bhar gaya?",
      button: "mausam badlo",
      buttonAria: "Change weather to spring",
      actionAria: "Call a snow gust",
      next: "spring",
      pickLabel: "sardi",
      shuffleLabel: "Sardi shuffle",
      shareLabel: "share this sardi ☕",
      placeLabel: "SARDI / PAHAAD",
      toast: "Sweater le aana chahiye tha.",
      modeToasts: Object.freeze({ light: "Bas halki si baraf.", medium: "Baraf tikne lagi.", heavy: "Raat bhar giregi.", storm: "Hawa tez ho gayi." }),
      drawerKicker: "36 GAANE · ONE COLD EVENING",
      drawerTitle: "Sardiyon ki cassette"
    }),
    spring: Object.freeze({
      weather: "petals",
      volumeIcon: "✦",
      volumeLabel: "BREEZE",
      volumeAria: "Spring ambience volume",
      modesAria: "Spring breeze intensity",
      modeLabels: Object.freeze({ light: "calm", medium: "soft", heavy: "breezy", storm: "gusty" }),
      hint: "patjhad ki yaad aa gayi?",
      button: "mausam badlo",
      buttonAria: "Change weather to autumn",
      actionAria: "Call a spring breeze",
      next: "autumn",
      pickLabel: "bahar",
      shuffleLabel: "Bahar shuffle",
      shareLabel: "share this bahar ☕",
      placeLabel: "BAHAR / PAHAAD",
      toast: "Bahar aa gayi.",
      modeToasts: Object.freeze({ light: "Hawa bilkul halki.", medium: "Naram si hawa.", heavy: "Phool hilne lage.", storm: "Hawa mein kuch toh hai." }),
      drawerKicker: "36 GAANE · ONE FRESH EVENING",
      drawerTitle: "Bahar ki cassette"
    }),
    autumn: Object.freeze({
      weather: "wind",
      volumeIcon: "🍂",
      volumeLabel: "WIND",
      volumeAria: "Autumn wind volume",
      modesAria: "Autumn wind intensity",
      modeLabels: Object.freeze({ light: "still", medium: "light", heavy: "breeze", storm: "gust" }),
      hint: "pahaadon se door chalein?",
      button: "mausam badlo",
      buttonAria: "Change weather to desert",
      actionAria: "Call an autumn breeze",
      next: "desert",
      pickLabel: "patjhad",
      shuffleLabel: "Patjhad shuffle",
      shareLabel: "share this patjhad ☕",
      placeLabel: "PATJHAD / PAHAAD",
      toast: "Patjhad aa gaya.",
      modeToasts: Object.freeze({ light: "Hawa ruk gayi.", medium: "Pattey hilne lage.", heavy: "Hawa chal padi.", storm: "Aaj tez hawa hai." }),
      drawerKicker: "36 GAANE · ONE GOLDEN EVENING",
      drawerTitle: "Patjhad ki cassette"
    }),
    desert: Object.freeze({
      weather: "sand",
      volumeIcon: "〰",
      volumeLabel: "WIND",
      volumeAria: "Desert wind volume",
      modesAria: "Desert wind intensity",
      modeLabels: Object.freeze({ light: "still", medium: "light", heavy: "breeze", storm: "gust" }),
      hint: "ret se door chalein?",
      button: "mausam badlo",
      buttonAria: "Change weather to the coast",
      actionAria: "Call a desert breeze",
      next: "coast",
      pickLabel: "registan",
      shuffleLabel: "Registan shuffle",
      shareLabel: "share this registan ☕",
      placeLabel: "REGISTAN / RAJASTHAN",
      toast: "Registan aa gaya.",
      modeToasts: Object.freeze({ light: "Hawa tham gayi.", medium: "Halki si sookhi hawa.", heavy: "Ret sarakne lagi.", storm: "Ret udne lagi." }),
      drawerKicker: "36 GAANE · ONE DUSTY EVENING",
      drawerTitle: "Registan ki cassette"
    }),
    coast: Object.freeze({
      weather: "waves",
      volumeIcon: "≈",
      volumeLabel: "WAVES",
      volumeAria: "Ocean ambience volume",
      modesAria: "Sea breeze intensity",
      modeLabels: Object.freeze({ light: "calm", medium: "soft", heavy: "breeze", storm: "strong" }),
      hint: "baarish yaad aa rahi hai?",
      button: "mausam badlo",
      buttonAria: "Change weather to monsoon",
      actionAria: "Call a sea breeze",
      next: "monsoon",
      pickLabel: "samundar",
      shuffleLabel: "Samundar shuffle",
      shareLabel: "share this samundar ☕",
      placeLabel: "SAMUNDAR / KINARA",
      toast: "Samundar aa gaya.",
      modeToasts: Object.freeze({ light: "Samundar bilkul shaant.", medium: "Lehrein dheere chal rahi hain.", heavy: "Hawa samundar se aa rahi hai.", storm: "Lehrein tez ho gayi." }),
      drawerKicker: "36 GAANE · ONE COASTAL EVENING",
      drawerTitle: "Samundar ki cassette"
    })
  });

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
    snowCanvas: $("#snowCanvas"),
    petalCanvas: $("#petalCanvas"),
    butterfliesContainer: $("#butterfliesContainer"),
    leafCanvas: $("#leafCanvas"),
    sandCanvas: $("#sandCanvas"),
    coastVideo: $("#coastVideo"),
    environmentButton: $("#environmentButton"),
    environmentSwitch: $("#environmentSwitch"),
    environmentButtonText: $("#environmentButtonText"),
    environmentHint: $("#environmentHint"),
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
    weatherVolumeIcon: $("#weatherVolumeIcon"),
    weatherVolumeLabel: $("#weatherVolumeLabel"),
    weatherModes: $("#weatherModes"),
    musicVolume: $("#musicVolume"),
    progress: $("#progress"),
    progressFill: $("#progressFill"),
    elapsed: $("#elapsed"),
    duration: $("#duration"),
    tapToPlay: $("#tapToPlay"),
    playlistButton: $("#playlistButton"),
    playlistDrawer: $("#playlistDrawer"),
    drawerKicker: $("#drawerKicker"),
    drawerTitle: $("#drawerTitle"),
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
    environment: Object.hasOwn(ENVIRONMENTS, saved.environment) ? saved.environment : "monsoon",
    environmentTransitioning: false,
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
  let environmentTransitionTimer = null;
  let weatherActionTimer = null;
  let environmentAttentionTimer = null;
  let environmentAttentionEndTimer = null;
  let environmentSwitchInteracted = false;
  let environmentAttentionDue = false;
  let audioUnlocked = false;
  let audioUnlockPromise = null;

  const AUDIO_UNLOCK_EVENTS = ["pointerdown", "touchstart", "keydown"];

  class AudioAtmosphere {
    constructor() {
      this.context = null;
      this.masterGain = null;
      this.rainGain = null;
      this.ambienceGain = null;
      this.thunderGain = null;
      this.winterGain = null;
      this.springGain = null;
      this.autumnGain = null;
      this.desertGain = null;
      this.coastGain = null;
      this.rainLayers = [];
      this.thunderLayers = [];
      this.burstLayer = null;
      this.windLayer = null;
      this.winterWindLayer = null;
      this.springBreezeLayer = null;
      this.desertWindLayer = null;
      this.coastBreezeLayer = null;
      this.coastSurfLayer = null;
      this.weatherDrift = 1;
      this.dynamicsTimer = null;
      this.environmentToken = 0;
      this.lastThunderIndex = -1;
      this.thunderActiveUntil = 0;
      this.initialized = false;
    }

    async start() {
      if (!this.initialized) this.create();
      if (!this.context) return false;

      if (this.context.state === "suspended") {
        try {
          await this.context.resume();
        } catch { /* A user gesture may still be required. */ }
      }

      const rainStarted = await this.startRainRecordings();
      this.setRainMode(state.rainMode, 3.2);
      this.setRainVolume(state.rainVolume, 2.4);
      this.setAmbience(state.ambienceOn, 1.8);
      this.setEnvironment(state.entered ? state.environment : "monsoon", 2.4);
      this.scheduleNaturalDynamics();
      return rainStarted;
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
      this.winterGain = this.context.createGain();
      this.springGain = this.context.createGain();
      this.autumnGain = this.context.createGain();
      this.desertGain = this.context.createGain();
      this.coastGain = this.context.createGain();
      this.rainGain.gain.value = 0;
      this.ambienceGain.gain.value = 0;
      this.thunderGain.gain.value = 0.82;
      this.winterGain.gain.value = 0;
      this.springGain.gain.value = 0;
      this.autumnGain.gain.value = 0;
      this.desertGain.gain.value = 0;
      this.coastGain.gain.value = 0;
      this.rainGain.connect(this.masterGain);
      this.ambienceGain.connect(this.masterGain);
      this.thunderGain.connect(this.masterGain);
      this.winterGain.connect(this.masterGain);
      this.springGain.connect(this.masterGain);
      this.autumnGain.connect(this.masterGain);
      this.desertGain.connect(this.masterGain);
      this.coastGain.connect(this.masterGain);

      const rainFiles = [
        { name: "light", src: "assets/audio/rain/light-rain.mp3", cutoff: 6400, rate: 0.985 },
        { name: "medium", src: "assets/audio/rain/medium-rain.mp3", cutoff: 5200, rate: 1 },
        { name: "roof", src: "assets/audio/rain/roof-rain.mp3", cutoff: 4300, rate: 1.012 }
      ];
      this.rainLayers = rainFiles.map((config) => this.createMediaLayer(config, this.rainGain, true));
      this.burstLayer = this.createMediaLayer({ src: "assets/audio/rain/rain-burst.mp3", cutoff: 5400 }, this.rainGain, false);
      this.windLayer = this.createMediaLayer({ src: "assets/audio/wind/storm-wind.mp3", cutoff: 2900 }, this.ambienceGain, true);
      this.winterWindLayer = this.createMediaLayer({ src: "assets/audio/wind/storm-wind.mp3", cutoff: 1450, rate: 0.84 }, this.winterGain, true);
      this.springBreezeLayer = this.createMediaLayer({ src: "assets/audio/wind/storm-wind.mp3", cutoff: 2600, rate: 0.74 }, this.springGain, true);
      this.autumnWindLayer = this.createMediaLayer({ src: "assets/audio/wind/storm-wind.mp3", cutoff: 1800, rate: 0.68 }, this.autumnGain, true);
      this.desertWindLayer = this.createMediaLayer({ src: "assets/audio/wind/storm-wind.mp3", cutoff: 2100, rate: 0.76 }, this.desertGain, true);
      this.coastBreezeLayer = this.createMediaLayer({ src: "assets/audio/wind/storm-wind.mp3", cutoff: 1750, rate: 0.70 }, this.coastGain, true);
      this.coastSurfLayer = this.createProceduralCoastLayer(this.coastGain);

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

    createProceduralCoastLayer(destination) {
      const duration = 12;
      const sampleRate = this.context.sampleRate;
      const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
      const data = buffer.getChannelData(0);
      let brown = 0;
      for (let index = 0; index < data.length; index += 1) {
        const time = index / sampleRate;
        const white = Math.random() * 2 - 1;
        brown = brown * 0.985 + white * 0.015;
        const swell = 0.46
          + Math.sin(time * Math.PI * 2 / 5.7) * 0.22
          + Math.sin(time * Math.PI * 2 / 3.15 + 1.4) * 0.12;
        data[index] = (brown * 2.8 + white * 0.055) * Math.max(0.12, swell);
      }

      const source = this.context.createBufferSource();
      const highpass = this.context.createBiquadFilter();
      const lowpass = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.loop = true;
      highpass.type = "highpass";
      highpass.frequency.value = 90;
      lowpass.type = "lowpass";
      lowpass.frequency.value = 1050;
      lowpass.Q.value = 0.45;
      gain.gain.value = 0.82;
      source.connect(highpass).connect(lowpass).connect(gain).connect(destination);
      source.start(0, Math.random() * duration);
      return { source, highpass, lowpass, gain };
    }

    async startRainRecordings() {
      const layers = [
        ...this.rainLayers,
        this.windLayer,
        this.winterWindLayer,
        this.autumnWindLayer,
        this.desertWindLayer,
        this.coastBreezeLayer
      ].filter(Boolean);
      const results = await Promise.allSettled(layers.map((layer) => layer.audio.play()));
      return results.some((result) => result.status === "fulfilled");
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
      const environment = state.entered ? state.environment : "monsoon";
      const rainTarget = environment === "monsoon" ? Math.min(0.48, value * modeBoost * this.weatherDrift) : 0;
      const winterAmbience = state.ambienceOn ? 1 : 0.72;
      const winterTarget = environment === "winter" ? Math.min(0.18, value * modeBoost * 0.48 * this.weatherDrift * winterAmbience) : 0;
      const springAmbience = state.ambienceOn ? 1 : 0.58;
      const springTarget = environment === "spring" ? Math.min(0.115, value * modeBoost * 0.31 * this.weatherDrift * springAmbience) : 0;
      const autumnAmbience = state.ambienceOn ? 1 : 0.62;
      const autumnTarget = environment === "autumn" ? Math.min(0.10, value * modeBoost * 0.26 * this.weatherDrift * autumnAmbience) : 0;
      const desertAmbience = state.ambienceOn ? 1 : 0.58;
      const desertTarget = environment === "desert" ? Math.min(0.09, value * modeBoost * 0.24 * this.weatherDrift * desertAmbience) : 0;
      const coastAmbience = state.ambienceOn ? 1 : 0.64;
      const coastTarget = environment === "coast" ? Math.min(0.12, value * modeBoost * 0.34 * this.weatherDrift * coastAmbience) : 0;
      this.ramp(this.rainGain, rainTarget, seconds);
      this.ramp(this.winterGain, winterTarget, seconds);
      this.ramp(this.springGain, springTarget, seconds);
      this.ramp(this.autumnGain, autumnTarget, seconds);
      this.ramp(this.desertGain, desertTarget, seconds);
      this.ramp(this.coastGain, coastTarget, seconds);
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
      if (this.coastSurfLayer && this.context) {
        const coastTone = {
          light: { level: 0.58, cutoff: 690 },
          medium: { level: 0.72, cutoff: 820 },
          heavy: { level: 0.86, cutoff: 950 },
          storm: { level: 1, cutoff: 1080 }
        }[mode] || { level: 0.72, cutoff: 820 };
        const now = this.context.currentTime;
        this.coastSurfLayer.gain.gain.cancelScheduledValues(now);
        this.coastSurfLayer.gain.gain.setValueAtTime(this.coastSurfLayer.gain.gain.value, now);
        this.coastSurfLayer.gain.gain.linearRampToValueAtTime(coastTone.level, now + Math.max(0.05, seconds));
        this.coastSurfLayer.lowpass.frequency.cancelScheduledValues(now);
        this.coastSurfLayer.lowpass.frequency.setValueAtTime(this.coastSurfLayer.lowpass.frequency.value, now);
        this.coastSurfLayer.lowpass.frequency.linearRampToValueAtTime(coastTone.cutoff, now + Math.max(0.05, seconds));
      }
      this.setRainVolume(state.rainVolume, seconds);
    }

    setAmbience(on, seconds = 0.6) {
      const active = (state.entered ? state.environment : "monsoon") === "monsoon";
      this.ramp(this.ambienceGain, active && on ? DEFAULTS.ambienceVolume : 0, seconds);
      if (!active) this.setRainVolume(state.rainVolume, seconds);
    }

    setEnvironment(environment, seconds = 3) {
      if (!this.initialized) return;
      const token = ++this.environmentToken;
      const winter = environment === "winter";
      const spring = environment === "spring";
      const autumn = environment === "autumn";
      const desert = environment === "desert";
      const coast = environment === "coast";
      const monsoonLayers = [...this.rainLayers, this.windLayer].filter(Boolean);
      const winterLayers = [this.winterWindLayer].filter(Boolean);
      const springLayers = [this.springBreezeLayer].filter(Boolean);
      const autumnLayers = [this.autumnWindLayer].filter(Boolean);
      const desertLayers = [this.desertWindLayer].filter(Boolean);
      const coastLayers = [this.coastBreezeLayer].filter(Boolean);
      const activeLayers = winter ? winterLayers : spring ? springLayers : autumn ? autumnLayers : desert ? desertLayers : coast ? coastLayers : monsoonLayers;
      const inactiveLayers = [...monsoonLayers, ...winterLayers, ...springLayers, ...autumnLayers, ...desertLayers, ...coastLayers].filter((layer) => !activeLayers.includes(layer));

      activeLayers.forEach((layer) => layer.audio.play().catch(() => {}));

      this.ramp(this.thunderGain, environment === "monsoon" ? 0.82 : 0, seconds);
      this.ramp(this.ambienceGain, environment === "monsoon" && state.ambienceOn ? DEFAULTS.ambienceVolume : 0, seconds);
      this.ramp(this.windLayer?.gain, 0, seconds);
      this.ramp(this.winterWindLayer?.gain, winter ? 0.72 : 0, seconds);
      this.ramp(this.springBreezeLayer?.gain, spring ? 0.72 : 0, seconds);
      this.ramp(this.autumnWindLayer?.gain, autumn ? 0.64 : 0, seconds);
      this.ramp(this.desertWindLayer?.gain, desert ? 0.60 : 0, seconds);
      this.ramp(this.coastBreezeLayer?.gain, coast ? 0.34 : 0, seconds);
      this.setRainVolume(state.rainVolume, seconds);

      setTimeout(() => {
        const activeEnvironment = state.entered ? state.environment : "monsoon";
        if (token !== this.environmentToken || activeEnvironment !== environment) return;
        inactiveLayers.filter(Boolean).forEach((layer) => layer.audio.pause());
      }, Math.max(250, seconds * 1000 + 120));
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
      if (state.environment !== "monsoon" || !this.burstLayer || !this.context) return;
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
      if (state.environment !== "monsoon" || !this.windLayer) return;
      if (active) this.windLayer.audio.play().catch(() => {});
      this.ramp(this.windLayer.gain, active ? 0.82 : 0, seconds);
    }

    thunder(distance = "any") {
      if ((state.entered && state.environment !== "monsoon") || !this.context || Date.now() < this.thunderActiveUntil) return false;
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

    winterGust(duration = 6) {
      if (state.environment !== "winter" || !this.winterGain) return;
      const modeBoost = { light: 0.72, medium: 0.94, heavy: 1.14, storm: 1.32 }[state.rainMode] || 1;
      const winterAmbience = state.ambienceOn ? 1 : 0.72;
      const resting = Math.min(0.18, state.rainVolume * modeBoost * 0.48 * this.weatherDrift * winterAmbience);
      this.winterWindLayer?.audio.play().catch(() => {});
      this.ramp(this.winterGain, Math.min(0.26, resting + Math.min(0.075, state.rainVolume * 0.34)), 0.8);
      setTimeout(() => {
        if (state.environment === "winter") this.ramp(this.winterGain, resting, 2.4);
      }, Math.max(1800, duration * 1000 - 2400));
    }

    springGust(duration = 6) {
      if (state.environment !== "spring" || !this.springGain) return;
      const modeBoost = { light: 0.7, medium: 0.9, heavy: 1.12, storm: 1.3 }[state.rainMode] || 1;
      const springAmbience = state.ambienceOn ? 1 : 0.58;
      const resting = Math.min(0.115, state.rainVolume * modeBoost * 0.31 * this.weatherDrift * springAmbience);
      this.springBreezeLayer?.audio.play().catch(() => {});
      this.ramp(this.springGain, Math.min(0.17, resting + Math.min(0.05, state.rainVolume * 0.22)), 0.9);
      setTimeout(() => {
        if (state.environment === "spring") this.ramp(this.springGain, resting, 2.6);
      }, Math.max(1800, duration * 1000 - 2600));
    }

    autumnGust(duration = 6) {
      if (state.environment !== "autumn" || !this.autumnGain) return;
      const modeBoost = { light: 0.68, medium: 0.9, heavy: 1.1, storm: 1.28 }[state.rainMode] || 1;
      const autumnAmbience = state.ambienceOn ? 1 : 0.62;
      const resting = Math.min(0.10, state.rainVolume * modeBoost * 0.26 * this.weatherDrift * autumnAmbience);
      this.autumnWindLayer?.audio.play().catch(() => {});
      this.ramp(this.autumnGain, Math.min(0.22, resting + Math.min(0.06, state.rainVolume * 0.28)), 0.9);
      setTimeout(() => {
        if (state.environment === "autumn") this.ramp(this.autumnGain, resting, 2.8);
      }, Math.max(1800, duration * 1000 - 2800));
    }

    desertGust(duration = 6) {
      if (state.environment !== "desert" || !this.desertGain) return;
      const modeBoost = { light: 0.66, medium: 0.88, heavy: 1.08, storm: 1.26 }[state.rainMode] || 1;
      const desertAmbience = state.ambienceOn ? 1 : 0.58;
      const resting = Math.min(0.09, state.rainVolume * modeBoost * 0.24 * this.weatherDrift * desertAmbience);
      this.desertWindLayer?.audio.play().catch(() => {});
      this.ramp(this.desertGain, Math.min(0.18, resting + Math.min(0.055, state.rainVolume * 0.25)), 0.9);
      setTimeout(() => {
        if (state.environment === "desert") this.ramp(this.desertGain, resting, 2.8);
      }, Math.max(1800, duration * 1000 - 2800));
    }

    coastGust(duration = 6) {
      if (state.environment !== "coast" || !this.coastGain) return;
      const modeBoost = { light: 0.66, medium: 0.88, heavy: 1.08, storm: 1.26 }[state.rainMode] || 1;
      const coastAmbience = state.ambienceOn ? 1 : 0.64;
      const resting = Math.min(0.12, state.rainVolume * modeBoost * 0.34 * this.weatherDrift * coastAmbience);
      this.coastBreezeLayer?.audio.play().catch(() => {});
      this.ramp(this.coastGain, Math.min(0.18, resting + Math.min(0.045, state.rainVolume * 0.20)), 0.9);
      setTimeout(() => {
        if (state.environment === "coast") this.ramp(this.coastGain, resting, 2.8);
      }, Math.max(1800, duration * 1000 - 2800));
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

  class SnowCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d", { alpha: true });
      this.flakes = [];
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.running = true;
      this.gustStrength = 0;
      this.gustTimer = null;
      this.lastTime = performance.now();
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      this.resize();
      requestAnimationFrame(this.draw);
    }

    count() {
      const area = (this.width * this.height) / 950000;
      const base = { light: 70, medium: 115, heavy: 185, storm: 265 }[state.rainMode] || 115;
      return Math.round(base * Math.max(0.68, Math.min(1.42, area)) * (reducedMotion ? 0.2 : 1));
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.6);
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
      this.flakes = Array.from({ length: this.count() }, () => this.makeFlake(true));
    }

    makeFlake(randomY = false) {
      const depth = Math.pow(Math.random(), 0.72);
      return {
        x: Math.random() * (this.width + 180) - 90,
        y: randomY ? Math.random() * this.height : -20 - Math.random() * 100,
        depth,
        radius: 0.55 + depth * 3.35 + Math.random() * 1.1,
        speed: 13 + depth * 55 + Math.random() * 18,
        drift: -4 + Math.random() * 13,
        opacity: 0.16 + depth * 0.5 + Math.random() * 0.16,
        sway: 8 + Math.random() * 23,
        phase: Math.random() * Math.PI * 2,
        wobble: 0.45 + Math.random() * 1.05
      };
    }

    setMode() {
      this.reset();
    }

    gust(duration = 6) {
      clearTimeout(this.gustTimer);
      this.gustStrength = 1;
      this.gustTimer = setTimeout(() => { this.gustStrength = 0; }, duration * 1000);
    }

    settle() {
      clearTimeout(this.gustTimer);
      this.gustStrength = 0;
    }

    draw(now) {
      requestAnimationFrame(this.draw);
      const active = state.entered && (state.environment === "winter" || state.environmentTransitioning);
      if (!this.running || document.hidden || !active) {
        this.lastTime = now;
        return;
      }

      const delta = Math.min(0.04, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const ctx = this.context;
      const gust = reducedMotion ? this.gustStrength * 0.24 : this.gustStrength;
      ctx.clearRect(0, 0, this.width, this.height);

      for (let i = 0; i < this.flakes.length; i += 1) {
        const flake = this.flakes[i];
        flake.phase += delta * flake.wobble;
        flake.y += flake.speed * delta * (1 + gust * 0.48);
        flake.x += (flake.drift + Math.sin(flake.phase) * flake.sway + gust * (68 + flake.depth * 82)) * delta;
        if (flake.y > this.height + 24 || flake.x > this.width + 90 || flake.x < -100) {
          this.flakes[i] = this.makeFlake(false);
          continue;
        }

        const near = flake.depth > 0.82;
        ctx.beginPath();
        ctx.ellipse(flake.x, flake.y, flake.radius * (near ? 1.08 : 0.9), flake.radius, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(235, 246, 249, ${flake.opacity})`;
        ctx.fill();
      }
    }
  }

  class PetalCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d", { alpha: true });
      this.petals = [];
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.running = true;
      this.gustStrength = 0;
      this.gustTimer = null;
      this.lastTime = performance.now();
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      this.resize();
      requestAnimationFrame(this.draw);
    }

    count() {
      const area = (this.width * this.height) / 950000;
      const base = { light: 10, medium: 14, heavy: 19, storm: 25 }[state.rainMode] || 14;
      return Math.max(reducedMotion ? 3 : 8, Math.round(base * Math.max(0.72, Math.min(1.3, area)) * (reducedMotion ? 0.24 : 1)));
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.55);
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
      this.petals = Array.from({ length: this.count() }, () => this.makePetal(true));
    }

    makePetal(randomX = false, temporary = false) {
      const depth = Math.pow(Math.random(), 0.78);
      const colors = ["244,190,202", "250,221,154", "238,234,220", "204,188,224"];
      return {
        x: randomX ? Math.random() * this.width : -30 - Math.random() * 100,
        y: Math.random() * (this.height * 0.78),
        depth,
        size: 2.2 + depth * 5.2 + Math.random() * 1.8,
        speedX: 9 + depth * 19 + Math.random() * 12,
        speedY: 4 + depth * 10 + Math.random() * 6,
        opacity: 0.2 + depth * 0.34 + Math.random() * 0.1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (-0.8 + Math.random() * 1.6) * (0.35 + depth),
        phase: Math.random() * Math.PI * 2,
        wobble: 0.55 + Math.random() * 1.15,
        color: colors[Math.floor(Math.random() * colors.length)],
        temporary
      };
    }

    setMode() {
      this.reset();
    }

    baselineStrength() {
      return { light: 0, medium: 0.16, heavy: 0.38, storm: 0.68 }[state.rainMode] ?? 0.16;
    }

    gust(duration = 6.5) {
      clearTimeout(this.gustTimer);
      this.gustStrength = 1;
      if (!reducedMotion) {
        const extras = Math.max(6, Math.round(this.count() * 0.7));
        this.petals.push(...Array.from({ length: extras }, () => this.makePetal(true, true)));
      }
      this.gustTimer = setTimeout(() => { this.gustStrength = 0; }, duration * 1000);
    }

    settle() {
      clearTimeout(this.gustTimer);
      this.gustStrength = 0;
      this.petals = this.petals.filter((petal) => !petal.temporary);
    }

    draw(now) {
      requestAnimationFrame(this.draw);
      const active = state.entered && (state.environment === "spring" || state.environmentTransitioning);
      if (!this.running || document.hidden || !active) {
        this.lastTime = now;
        return;
      }

      const delta = Math.min(0.04, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const ctx = this.context;
      const baseline = this.baselineStrength();
      const eventBoost = this.gustStrength * (1 - baseline * 0.45);
      const gust = reducedMotion ? (baseline + eventBoost) * 0.18 : baseline + eventBoost;
      ctx.clearRect(0, 0, this.width, this.height);

      for (let i = 0; i < this.petals.length; i += 1) {
        const petal = this.petals[i];
        petal.phase += delta * petal.wobble;
        petal.rotation += delta * petal.rotationSpeed * (1 + gust * 1.8);
        petal.x += (petal.speedX + Math.sin(petal.phase) * 9 + gust * (58 + petal.depth * 75)) * delta;
        petal.y += (petal.speedY + Math.cos(petal.phase * 0.72) * 4 + gust * 5) * delta;
        if (petal.x > this.width + 40 || petal.y > this.height + 30) {
          if (petal.temporary && !this.gustStrength) {
            this.petals.splice(i, 1);
            i -= 1;
            continue;
          }
          this.petals[i] = this.makePetal(false, petal.temporary && Boolean(this.gustStrength));
          continue;
        }

        ctx.save();
        ctx.translate(petal.x, petal.y);
        ctx.rotate(petal.rotation);
        ctx.beginPath();
        ctx.moveTo(-petal.size * 0.82, 0);
        ctx.quadraticCurveTo(0, -petal.size * 0.62, petal.size * 0.9, 0);
        ctx.quadraticCurveTo(0, petal.size * 0.48, -petal.size * 0.82, 0);
        ctx.fillStyle = `rgba(${petal.color}, ${petal.opacity})`;
        ctx.fill();
        ctx.restore();
      }
    }
  }


  /* ─── LeafCanvas ──────────────────────────────────────────────────────────
     Falling autumn leaves for the Patjhad environment. Canvas-based leaf
     particles with warm autumn colours, rotation, sway, and depth variation.
     Calm by default (6–22 leaves), with a gust mode for breeze interactions.
  ──────────────────────────────────────────────────────────────────────────── */
  class LeafCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d", { alpha: true });
      this.leaves = [];
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.running = true;
      this.gustStrength = 0;
      this.gustTimer = null;
      this.lastTime = performance.now();
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      this.resize();
      requestAnimationFrame(this.draw);
    }

    count() {
      const area = (this.width * this.height) / 950000;
      const base = { light: 6, medium: 10, heavy: 16, storm: 22 }[state.rainMode] || 10;
      return Math.max(reducedMotion ? 3 : 6, Math.round(base * Math.max(0.7, Math.min(1.4, area)) * (reducedMotion ? 0.3 : 1)));
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.6);
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
      this.leaves = Array.from({ length: this.count() }, () => this.makeLeaf(true));
    }

    makeLeaf(randomY = false, temporary = false) {
      const depth = Math.pow(Math.random(), 0.65);
      const LEAF_COLORS = [
        [194, 128, 48],  // amber
        [175, 100, 38],  // burnt orange
        [144, 82, 42],   // rust brown
        [210, 155, 60],  // golden yellow
        [164, 110, 52],  // ochre
        [130, 90, 60],   // dark brown
        [188, 140, 70],  // warm gold
        [118, 88, 55],   // deep rust
        [220, 175, 90],  // light amber
        [155, 95, 48]    // medium rust
      ];
      const [r, g, b] = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];
      const opacity = 0.30 + depth * 0.48 + Math.random() * 0.12;
      return {
        x: Math.random() * (this.width + 200) - 100,
        y: randomY ? Math.random() * this.height : -30 - Math.random() * 120,
        depth,
        size: 3.5 + depth * 8.5 + Math.random() * 3,
        speedY: 18 + depth * 38 + Math.random() * 14,
        speedX: -5 + Math.random() * 14,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (-0.6 + Math.random() * 1.2) * (0.3 + depth * 0.7),
        phase: Math.random() * Math.PI * 2,
        wobble: 0.3 + Math.random() * 0.8,
        swayAmp: 12 + Math.random() * 28,
        riseChance: Math.random() > 0.82,
        risePhase: Math.random() * Math.PI * 2,
        r, g, b, opacity,
        temporary
      };
    }

    setMode() { this.reset(); }

    baselineStrength() {
      return { light: 0, medium: 0.15, heavy: 0.36, storm: 0.66 }[state.rainMode] ?? 0.15;
    }

    gust(duration = 6) {
      clearTimeout(this.gustTimer);
      this.gustStrength = 1;
      if (!reducedMotion) {
        const extras = Math.max(4, Math.round(this.count() * 0.65));
        this.leaves.push(...Array.from({ length: extras }, () => this.makeLeaf(true, true)));
      }
      this.gustTimer = setTimeout(() => { this.gustStrength = 0; }, duration * 1000);
    }

    settle() {
      clearTimeout(this.gustTimer);
      this.gustStrength = 0;
      this.leaves = this.leaves.filter((l) => !l.temporary);
    }

    draw(now) {
      requestAnimationFrame(this.draw);
      const active = state.entered && (state.environment === "autumn" || state.environmentTransitioning);
      if (!this.running || document.hidden || !active) {
        this.lastTime = now;
        return;
      }

      const delta = Math.min(0.04, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const ctx = this.context;
      const baseline = this.baselineStrength();
      const eventBoost = this.gustStrength * (1 - baseline * 0.45);
      const gust = reducedMotion ? (baseline + eventBoost) * 0.2 : baseline + eventBoost;
      ctx.clearRect(0, 0, this.width, this.height);

      for (let i = 0; i < this.leaves.length; i += 1) {
        const leaf = this.leaves[i];
        leaf.phase += delta * leaf.wobble;
        leaf.rotation += delta * leaf.rotationSpeed * (1 + gust * 1.4);

        const sway = Math.sin(leaf.phase) * leaf.swayAmp;
        const riseEffect = leaf.riseChance ? Math.sin(leaf.risePhase + now * 0.0004) * 6 : 0;
        leaf.risePhase += delta * 0.5;

        leaf.x += (leaf.speedX + sway + gust * (52 + leaf.depth * 65)) * delta;
        leaf.y += (leaf.speedY - riseEffect + gust * 5) * delta;

        if (leaf.y > this.height + 35 || leaf.x > this.width + 80 || leaf.x < -100) {
          if (leaf.temporary && !this.gustStrength) {
            this.leaves.splice(i, 1);
            i -= 1;
            continue;
          }
          this.leaves[i] = this.makeLeaf(false, leaf.temporary && Boolean(this.gustStrength));
          continue;
        }

        ctx.save();
        ctx.translate(leaf.x, leaf.y);
        ctx.rotate(leaf.rotation);
        const s = leaf.size;
        // Organic broad 3-lobed maple leaf shape
        ctx.beginPath();
        // Top central lobe tip
        ctx.moveTo(0, -s);
        // Right side of central lobe curving down to the only right indentation
        ctx.quadraticCurveTo(s * 0.2, -s * 0.6, s * 0.35, -s * 0.35);
        // Right lobe tip
        ctx.quadraticCurveTo(s * 0.7, -s * 0.45, s * 0.85, -s * 0.1);
        // Bottom of right lobe curving into a broad lower shoulder (not a lobe)
        ctx.quadraticCurveTo(s * 0.8, s * 0.4, s * 0.4, s * 0.6);
        // Curve down towards stem
        ctx.quadraticCurveTo(s * 0.15, s * 0.75, 0.05 * s, s * 0.85);
        // Stem
        ctx.lineTo(0.02 * s, s * 1.05);
        ctx.lineTo(-0.02 * s, s * 1.05);
        ctx.lineTo(-0.05 * s, s * 0.85);
        // Curve up from stem to left broad shoulder
        ctx.quadraticCurveTo(-s * 0.15, s * 0.75, -s * 0.4, s * 0.6);
        // Top of lower left shoulder curving into left lobe tip
        ctx.quadraticCurveTo(-s * 0.8, s * 0.4, -s * 0.85, -s * 0.1);
        // Top of left lobe curving down to the only left indentation
        ctx.quadraticCurveTo(-s * 0.7, -s * 0.45, -s * 0.35, -s * 0.35);
        // Left side of central lobe curving up to tip
        ctx.quadraticCurveTo(-s * 0.2, -s * 0.6, 0, -s);
        
        ctx.closePath();
        ctx.fillStyle = `rgba(${leaf.r},${leaf.g},${leaf.b},${leaf.opacity})`;
        ctx.fill();

        // Subtle veins for larger leaves
        if (s > 5) {
          ctx.beginPath();
          // Main middle vein
          ctx.moveTo(0, s * 0.85);
          ctx.quadraticCurveTo(s * 0.05, 0, 0, -s * 0.9);
          // Right vein
          ctx.moveTo(0, s * 0.4);
          ctx.quadraticCurveTo(s * 0.3, s * 0.1, s * 0.75, -s * 0.1);
          // Left vein
          ctx.moveTo(0, s * 0.4);
          ctx.quadraticCurveTo(-s * 0.3, s * 0.1, -s * 0.75, -s * 0.1);
          
          ctx.strokeStyle = `rgba(${leaf.r * 0.6},${leaf.g * 0.6},${leaf.b * 0.6},${leaf.opacity * 0.7})`;
          ctx.lineWidth = Math.max(0.3, s * 0.04);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  /* Fine, wind-driven desert dust. Particles stay small, translucent and
     concentrated below the horizon so the artwork remains the focus. */
  class SandCanvas {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d", { alpha: true });
      this.grains = [];
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.running = true;
      this.gustStrength = 0;
      this.gustTimer = null;
      this.lastTime = performance.now();
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      this.resize();
      requestAnimationFrame(this.draw);
    }

    count() {
      const area = (this.width * this.height) / 950000;
      const base = { light: 12, medium: 20, heavy: 30, storm: 42 }[state.rainMode] || 20;
      const motionFactor = reducedMotion ? 0.28 : 1;
      return Math.max(reducedMotion ? 4 : 10, Math.round(base * Math.max(0.65, Math.min(1.35, area)) * motionFactor));
    }

    resize() {
      this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
      this.grains = Array.from({ length: this.count() }, () => this.makeGrain(true));
    }

    makeGrain(randomX = false, temporary = false) {
      const depth = Math.pow(Math.random(), 0.72);
      const lifted = Math.random() < 0.09;
      const terrainBias = 1 - Math.pow(Math.random(), 1.85);
      const colors = [
        [222, 190, 143],
        [205, 169, 113],
        [235, 207, 163],
        [190, 151, 100]
      ];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const clusterCount = Math.random() < 0.18 ? 1 + Math.floor(Math.random() * 3) : 0;
      return {
        x: randomX ? Math.random() * this.width : -20 - Math.random() * 120,
        y: this.height * (lifted ? 0.39 + Math.random() * 0.25 : 0.50 + terrainBias * 0.46),
        depth,
        size: 0.38 + depth * 1.18 + Math.random() * 0.34,
        speedX: 10 + depth * 42 + Math.random() * 26,
        lift: -2.4 + Math.random() * 4.8,
        phase: Math.random() * Math.PI * 2,
        wobble: 0.45 + Math.random() * 1.05,
        turbulence: 1.2 + Math.random() * 3.4,
        opacity: 0.07 + depth * 0.13 + Math.random() * 0.055,
        color,
        satellites: Array.from({ length: clusterCount }, () => ({
          x: -3 + Math.random() * 6,
          y: -2.5 + Math.random() * 5,
          scale: 0.28 + Math.random() * 0.42,
          opacity: 0.3 + Math.random() * 0.35
        })),
        temporary
      };
    }

    setMode() { this.reset(); }

    baselineStrength() {
      return { light: 0, medium: 0.16, heavy: 0.40, storm: 0.70 }[state.rainMode] ?? 0.16;
    }

    gust(duration = 6) {
      clearTimeout(this.gustTimer);
      this.gustStrength = 1;
      if (!reducedMotion) {
        const extras = Math.max(10, Math.round(this.count() * 0.75));
        this.grains.push(...Array.from({ length: extras }, () => this.makeGrain(true, true)));
      }
      this.gustTimer = setTimeout(() => { this.gustStrength = 0; }, duration * 1000);
    }

    settle() {
      clearTimeout(this.gustTimer);
      this.gustStrength = 0;
      this.grains = this.grains.filter((grain) => !grain.temporary);
    }

    draw(now) {
      requestAnimationFrame(this.draw);
      const active = state.entered && (state.environment === "desert" || state.environmentTransitioning);
      if (!this.running || document.hidden || !active) {
        this.lastTime = now;
        return;
      }

      const delta = Math.min(0.04, (now - this.lastTime) / 1000);
      this.lastTime = now;
      const ctx = this.context;
      const baseline = this.baselineStrength();
      const eventBoost = this.gustStrength * (1 - baseline * 0.45);
      const gust = reducedMotion ? (baseline + eventBoost) * 0.18 : baseline + eventBoost;
      ctx.clearRect(0, 0, this.width, this.height);

      for (let i = 0; i < this.grains.length; i += 1) {
        const grain = this.grains[i];
        grain.phase += delta * grain.wobble;
        grain.x += (grain.speedX + gust * (95 + grain.depth * 120)) * delta;
        grain.y += (
          grain.lift
          + Math.sin(grain.phase) * grain.turbulence
          + Math.cos(grain.phase * 0.63) * (0.8 + grain.depth * 1.6)
          - gust * grain.depth * 3
        ) * delta;

        if (grain.x > this.width + 40 || grain.y < this.height * 0.34 || grain.y > this.height + 20) {
          if (grain.temporary && !this.gustStrength) {
            this.grains.splice(i, 1);
            i -= 1;
            continue;
          }
          this.grains[i] = this.makeGrain(false, grain.temporary && Boolean(this.gustStrength));
          continue;
        }

        const [r, g, b] = grain.color;
        const opacity = Math.min(0.42, grain.opacity * (1 + gust * 0.36));
        const radiusX = grain.size * (grain.depth > 0.86 ? 1.16 : 1);
        const radiusY = grain.size * (0.82 + grain.depth * 0.12);
        ctx.beginPath();
        ctx.ellipse(grain.x, grain.y, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
        ctx.fill();

        grain.satellites.forEach((satellite) => {
          ctx.beginPath();
          ctx.arc(
            grain.x + satellite.x * (0.7 + grain.depth * 0.3),
            grain.y + satellite.y,
            Math.max(0.22, grain.size * satellite.scale),
            0,
            Math.PI * 2
          );
          ctx.fillStyle = `rgba(${r},${g},${b},${opacity * satellite.opacity})`;
          ctx.fill();
        });
      }
    }
  }

  class ButterflySystem {
    constructor(container) {
      this.container = container;
      this.butterflies = [];
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.running = true;
      this.lastTime = performance.now();
      
      this.nextSpawnIn = 8000 + Math.random() * 8000;
      this.timeSinceLastSpawn = 0;
      this.breezeActive = false;
      this.nextZone = "center";
      
      this.resize = this.resize.bind(this);
      this.update = this.update.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      requestAnimationFrame(this.update);
    }

    maxCount() {
      return reducedMotion ? 1 : 2;
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
    }

    makeButterfly() {
      const zone = this.nextZone || "center";
      this.nextZone = (zone === "center") ? "plant" : "center";

      const plantX = this.width * 0.60;
      const plantY = this.height * 0.65;
      
      const depth = 0.5 + Math.random() * 0.5; 
      const sizePx = reducedMotion ? 12 : (16 + depth * 14 + Math.random() * 8);
      
      const el = document.createElement("div");
      el.className = "butterfly-wrapper";
      
      const palettes = [
        { p: "#c0e0ff", s: "#e8f0f8" },
        { p: "#e09040", s: "#ffc080" },
        { p: "#50a0a0", s: "#80c0c0" },
        { p: "#d0a0c0", s: "#f0d0e0" },
        { p: "#b0d0ff", s: "#ffffff" }
      ];
      const palette = palettes[Math.floor(Math.random() * palettes.length)];
      
      el.innerHTML = `
        <svg viewBox="0 0 100 100" class="butterfly-svg" preserveAspectRatio="xMidYMid meet" style="overflow: visible;">
          <defs>
            <radialGradient id="wingGrad1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="${palette.s}" />
              <stop offset="100%" stop-color="${palette.p}" />
            </radialGradient>
          </defs>
          <g class="butterfly-wing left-wing" style="transform-origin: 50% 50%;">
            <path d="M 50 50 C 25 10, 5 20, 10 40 C 15 65, 35 55, 50 50" fill="url(#wingGrad1)" stroke="#221105" stroke-width="2.5" />
            <path d="M 38 42 C 22 22, 14 30, 20 40 C 25 48, 35 48, 38 42" fill="${palette.s}" opacity="0.8" />
            <circle cx="15" cy="30" r="2.5" fill="#fff" opacity="0.8"/>
            <circle cx="22" cy="20" r="1.5" fill="#fff" opacity="0.8"/>
            <path d="M 50 50 C 30 65, 20 85, 35 90 C 45 90, 48 70, 50 50" fill="${palette.p}" stroke="#221105" stroke-width="2" />
          </g>
          <g class="butterfly-wing right-wing" style="transform-origin: 50% 50%;">
            <path d="M 50 50 C 75 10, 95 20, 90 40 C 85 65, 65 55, 50 50" fill="url(#wingGrad1)" stroke="#221105" stroke-width="2.5" />
            <path d="M 62 42 C 78 22, 86 30, 80 40 C 75 48, 65 48, 62 42" fill="${palette.s}" opacity="0.8" />
            <circle cx="85" cy="30" r="2.5" fill="#fff" opacity="0.8"/>
            <circle cx="78" cy="20" r="1.5" fill="#fff" opacity="0.8"/>
            <path d="M 50 50 C 70 65, 80 85, 65 90 C 55 90, 52 70, 50 50" fill="${palette.p}" stroke="#221105" stroke-width="2" />
          </g>
          <path d="M 48 35 Q 50 15 52 35 Q 54 65 50 75 Q 46 65 48 35" fill="#2d1c10"/>
          <path d="M 50 35 Q 42 18 36 20 M 50 35 Q 58 18 64 20" stroke="#2d1c10" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </svg>
      `;
      
      el.style.setProperty("--b-size", `${sizePx}px`);
      
      const leftWing = el.querySelector('.left-wing');
      const rightWing = el.querySelector('.right-wing');
      const svg = el.querySelector('.butterfly-svg');
      
      this.container.appendChild(el);
      
      const fromLeft = Math.random() > 0.35;
      const startX = zone === "plant" ? plantX - 50 + Math.random() * 100 : (fromLeft ? -sizePx * 2 : Math.random() * this.width);
      const startY = zone === "plant" ? plantY - 30 + Math.random() * 60 : (this.height * 0.38 + Math.random() * (this.height * 0.44));
      
      return {
        el,
        leftWing,
        rightWing,
        svg,
        zone,
        x: startX,
        y: startY,
        vx: zone === "plant" ? -30 + Math.random() * 60 : (fromLeft ? 1 : (Math.random() > 0.5 ? 1 : -1)) * (16 + depth * 18 + Math.random() * 8),
        vy: zone === "plant" ? -30 + Math.random() * 60 : -4 - Math.random() * 8,
        targetX: plantX,
        targetY: plantY - 50,
        hoverTimer: 0,
        isHovering: false,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        ampX: 8 + Math.random() * 14,
        ampY: 5 + Math.random() * 9,
        wobbleX: 0.3 + Math.random() * 0.5,
        wobbleY: 0.18 + Math.random() * 0.35,
        flapPhase: Math.random() * Math.PI * 2,
        flapSpeed: 2.2 + Math.random() * 1.5,
        opacity: 0,
        lifeSecs: 15 + Math.random() * 20,
        age: 0,
        angle: 0
      };
    }

    breeze() {
      if (reducedMotion) return;
      this.breezeActive = true;
      for (const b of this.butterflies) {
        b.vy -= 15 + Math.random() * 10;
        b.flapSpeed += 1.8;
      }
      clearTimeout(this._breezeTimer);
      this._breezeTimer = setTimeout(() => {
        this.breezeActive = false;
        for (const b of this.butterflies) {
          b.flapSpeed = Math.max(2.2, b.flapSpeed - 1.8);
        }
      }, 4500);
    }

    update(now) {
      requestAnimationFrame(this.update);
      const active = state.entered && state.environment === "spring" && !state.environmentTransitioning;

      if (!this.running || document.hidden) {
        this.lastTime = now;
        return;
      }

      const delta = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;

      if (!active) {
        if (this.butterflies.length > 0) {
          this.butterflies.forEach(b => b.el.remove());
          this.butterflies = [];
        }
        this.nextZone = "center";
        return;
      }

      this.timeSinceLastSpawn += delta * 1000;
      if (
        this.butterflies.length < this.maxCount() &&
        this.timeSinceLastSpawn >= this.nextSpawnIn
      ) {
        this.butterflies.push(this.makeButterfly());
        this.timeSinceLastSpawn = 0;
        this.nextSpawnIn = reducedMotion ? 25000 : 12000 + Math.random() * 12000;
      }

      const plantX = this.width * 0.60;
      const plantY = this.height * 0.65;

      for (let i = this.butterflies.length - 1; i >= 0; i--) {
        const b = this.butterflies[i];
        b.age += delta;
        b.flapPhase += delta * b.flapSpeed * Math.PI * 2;

        if (b.zone === "plant") {
          b.hoverTimer -= delta;
          if (b.hoverTimer <= 0) {
            b.isHovering = !b.isHovering;
            if (b.isHovering) {
              b.hoverTimer = 0.5 + Math.random() * 1.5; // hover for 0.5-2s
              b.targetX = plantX - 80 + Math.random() * 160;
              b.targetY = plantY - 120 + Math.random() * 120;
            } else {
              b.hoverTimer = 2 + Math.random() * 4; // fly for 2-6s
              b.targetX = plantX - 180 + Math.random() * 360;
              b.targetY = plantY - 200 + Math.random() * 250;
            }
          }

          if (b.isHovering) {
            b.vx += (b.targetX - b.x) * 0.8 * delta;
            b.vy += (b.targetY - b.y) * 0.8 * delta;
            b.vx *= (1 - delta * 2.5);
            b.vy *= (1 - delta * 2.5);
            b.flapSpeed = 3.5 + Math.sin(now/200)*0.5;
          } else {
            b.vx += (b.targetX - b.x) * 0.2 * delta;
            b.vy += (b.targetY - b.y) * 0.2 * delta;
            b.phaseX += delta * 0.4;
            b.phaseY += delta * 0.3;
            b.vx += Math.sin(b.phaseX) * 12 * delta;
            b.vy += Math.cos(b.phaseY) * 12 * delta;
            b.vx *= (1 - delta * 0.8);
            b.vy *= (1 - delta * 0.8);
            b.flapSpeed = 2.2 + Math.sin(now/500)*0.5;
          }
          
          b.x += b.vx * delta;
          b.y += b.vy * delta;
          
        } else {
          // Center zone: original organic drift logic
          b.phaseX += delta * b.wobbleX;
          b.phaseY += delta * b.wobbleY;

          b.x += (b.vx + Math.sin(b.phaseX) * b.ampX) * delta;
          b.y += (b.vy + Math.sin(b.phaseY) * b.ampY) * delta;

          // Very gentle gravity pull back toward mid-height
          const midY = this.height * 0.58;
          b.vy += (midY - b.y) * 0.008 * delta;
          // Dampen vx/vy so it doesn't accelerate indefinitely
          b.vx *= (1 - delta * 0.18);
          b.vy *= (1 - delta * 0.28);
          
          b.flapSpeed = 2.2 + Math.sin(now/800)*0.3;
        }
        

        // Calculate facing angle based on velocity
        const targetAngle = Math.atan2(b.vy, b.vx) * (180 / Math.PI) + 90; 
        
        // Smoothly interpolate angle
        let dAngle = targetAngle - b.angle;
        while (dAngle > 180) dAngle -= 360;
        while (dAngle < -180) dAngle += 360;
        b.angle += dAngle * delta * 2;

        const wingScale = 0.2 + 0.8 * Math.abs(Math.cos(b.flapPhase));

        // Fade in/out
        if (b.age < 2) {
          b.opacity = b.age / 2;
        } else if (b.age > b.lifeSecs - 2) {
          b.opacity = (b.lifeSecs - b.age) / 2;
        } else {
          b.opacity = 1;
        }

        if (b.age >= b.lifeSecs) {
          b.el.remove();
          this.butterflies.splice(i, 1);
          continue;
        }

        // Apply transforms
        // Offset by half size to center
        b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
        b.el.style.opacity = b.opacity * 0.95; // slightly transparent to blend
        b.svg.style.transform = `translate(-50%, -50%) rotate(${b.angle}deg)`;
        
        b.leftWing.style.transform = `scaleX(${wingScale})`;
        b.rightWing.style.transform = `scaleX(${wingScale})`;
      }
    }
}

  const atmosphere = new AudioAtmosphere();

  const rain = new RainCanvas(els.canvas, () => state.entered && (state.environment === "monsoon" || state.environmentTransitioning));
  const entryRain = new RainCanvas(els.entryCanvas, () => !document.body.classList.contains("entry-settled"));
  const snow = new SnowCanvas(els.snowCanvas);
  const petals = new PetalCanvas(els.petalCanvas);
  const butterflies = new ButterflySystem(els.butterfliesContainer);
  const leaves = new LeafCanvas(els.leafCanvas);
  const dust = new SandCanvas(els.sandCanvas);
  class CoastVideoController {
    constructor(video) {
      this.video = video;
      this.rateRaf = 0;
      this.gustTimer = null;
      this.pauseTimer = null;
      this.rateToken = 0;
      this.handleVisibility = this.handleVisibility.bind(this);
      if (!video) return;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.addEventListener("canplay", () => document.body.classList.add("coast-video-ready"));
      video.addEventListener("error", () => document.body.classList.remove("coast-video-ready"));
      document.addEventListener("visibilitychange", this.handleVisibility);
      this.setMode(true);
      if (!this.shouldPlay()) video.pause();
    }

    baselineRate() {
      return reducedMotion ? 0.62 : (COAST_PLAYBACK_RATES[state.rainMode] || COAST_PLAYBACK_RATES.medium);
    }

    shouldPlay() {
      return Boolean(state.entered && state.environment === "coast" && !document.hidden && !reducedMotion);
    }

    play() {
      clearTimeout(this.pauseTimer);
      if (!this.video || reducedMotion || document.hidden) return;
      this.setMode(true);
      const playback = this.video.play();
      if (playback?.catch) playback.catch(() => document.body.classList.remove("coast-video-ready"));
    }

    pause(delay = 0) {
      clearTimeout(this.pauseTimer);
      if (!this.video) return;
      this.pauseTimer = setTimeout(() => {
        if (state.environment !== "coast" || document.hidden || reducedMotion) this.video.pause();
      }, Math.max(0, delay));
    }

    setRate(target, immediate = false) {
      if (!this.video) return;
      cancelAnimationFrame(this.rateRaf);
      this.rateRaf = 0;
      const safeTarget = Math.max(0.12, Math.min(1.25, target));
      const token = ++this.rateToken;
      const startRate = this.video.playbackRate || safeTarget;
      if (immediate || this.video.paused || Math.abs(startRate - safeTarget) < 0.01) {
        this.video.playbackRate = safeTarget;
        return;
      }
      const startTime = performance.now();
      const duration = 720;
      const update = (now) => {
        if (token !== this.rateToken) return;
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        this.video.playbackRate = startRate + (safeTarget - startRate) * eased;
        if (progress < 1) this.rateRaf = requestAnimationFrame(update);
        else this.rateRaf = 0;
      };
      this.rateRaf = requestAnimationFrame(update);
    }

    setMode(immediate = false) {
      if (this.gustTimer) return;
      this.setRate(this.baselineRate(), immediate);
    }

    gust(duration = 6.5) {
      if (!this.video || state.environment !== "coast") return;
      clearTimeout(this.gustTimer);
      const baseline = this.baselineRate();
      const boost = state.rainMode === "storm" ? 0.025 : 0.04;
      this.setRate(baseline + boost);
      this.gustTimer = setTimeout(() => {
        this.gustTimer = null;
        if (state.environment === "coast") this.setRate(this.baselineRate());
      }, duration * 1000);
    }

    settle() {
      clearTimeout(this.gustTimer);
      this.gustTimer = null;
      this.setRate(this.baselineRate());
    }

    handleVisibility() {
      if (!this.video) return;
      if (document.hidden) this.video.pause();
      else if (this.shouldPlay()) this.play();
    }
  }

  const coastVideo = new CoastVideoController(els.coastVideo);

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
        environment: state.environment,
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

  function applyEnvironmentUi(environment = state.environment) {
    const config = ENVIRONMENTS[environment];
    document.body.dataset.environment = environment;
    const sceneLabels = {
      monsoon: "A rainy Indian veranda at night",
      winter: "A snowy Himalayan veranda at dusk",
      spring: "A green Himalayan veranda in spring after rain",
      autumn: "A golden Himalayan veranda on a warm autumn evening",
      desert: "A familiar veranda overlooking the Rajasthan desert at dusk",
      coast: "A familiar veranda overlooking a quiet Indian coastline at dusk"
    };
    els.experience.setAttribute("aria-label", sceneLabels[environment] || sceneLabels.monsoon);
    els.environmentHint.textContent = config.hint;
    els.environmentButtonText.textContent = config.button;
    els.environmentButton.setAttribute("aria-label", config.buttonAria);
    els.weatherVolumeIcon.textContent = config.volumeIcon;
    els.weatherVolumeLabel.textContent = config.volumeLabel;
    els.rainVolume.setAttribute("aria-label", config.volumeAria);
    els.weatherModes.setAttribute("aria-label", config.modesAria);
    $$('[data-rain]').forEach((button) => {
      button.textContent = config.modeLabels[button.dataset.rain];
    });
    els.lightningButton.setAttribute("aria-label", config.actionAria);
    els.lightningButton.title = config.actionAria;
    const shuffleLabel = config.shuffleLabel;
    els.shuffle.setAttribute("aria-label", shuffleLabel);
    els.shuffle.title = state.shuffleEnabled ? `${shuffleLabel} on` : shuffleLabel;
    els.share.textContent = config.shareLabel;
    els.drawerKicker.textContent = config.drawerKicker;
    els.drawerTitle.textContent = config.drawerTitle;
    updateTrackUI({ preserveProgress: true });
    updateClock();
    snow.setMode();
    petals.setMode();
    leaves.setMode();
    dust.setMode();
    coastVideo.setMode();
  }

  function stopEnvironmentAttention(discovered = false) {
    clearTimeout(environmentAttentionTimer);
    clearTimeout(environmentAttentionEndTimer);
    environmentAttentionTimer = null;
    environmentAttentionEndTimer = null;
    els.environmentSwitch.classList.remove("attention");
    if (discovered) {
      environmentSwitchInteracted = true;
      environmentAttentionDue = false;
    }
  }

  function scheduleEnvironmentAttention(delay = ENVIRONMENT_ATTENTION_DELAY) {
    if (environmentSwitchInteracted) return;
    clearTimeout(environmentAttentionTimer);
    environmentAttentionTimer = setTimeout(() => {
      environmentAttentionTimer = null;
      const unavailable = !state.entered
        || state.environmentTransitioning
        || document.body.classList.contains("playlist-open");
      if (unavailable) {
        environmentAttentionDue = true;
        return;
      }

      environmentAttentionDue = false;
      els.environmentSwitch.classList.remove("attention");
      void els.environmentSwitch.offsetWidth;
      els.environmentSwitch.classList.add("attention");
      environmentAttentionEndTimer = setTimeout(() => {
        els.environmentSwitch.classList.remove("attention");
        environmentAttentionEndTimer = null;
      }, ENVIRONMENT_ATTENTION_DURATION);
    }, delay);
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

  function updateTrackUI({ preserveProgress = false } = {}) {
    const track = currentTrack();
    if (!track) return;
    els.title.textContent = track.title;
    els.artist.textContent = `${track.artist} · ${track.film}`;
    const pickLabel = state.environment === "monsoon" ? track.mood : ENVIRONMENTS[state.environment].pickLabel;
    els.mood.textContent = `${pickLabel} pick · ${track.year}`;
    els.console.dataset.trackIndex = String(state.currentTrackIndex);
    els.console.dataset.youtubeId = track.youtubeId;
    if (!preserveProgress) {
      els.progressFill.style.width = "0%";
      els.elapsed.textContent = "0:00";
      els.duration.textContent = "—:—";
    }
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
    const shuffleLabel = ENVIRONMENTS[state.environment].shuffleLabel;
    els.shuffle.title = state.shuffleEnabled ? `${shuffleLabel} on` : shuffleLabel;
    state.shuffleBackStack = [];

    if (state.shuffleEnabled) {
      rebuildShuffleQueue();
      showToast(`${ENVIRONMENTS[state.environment].pickLabel.replace(/^./, (letter) => letter.toUpperCase())} shuffle on. Jo aaya, woh suno.`);
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

  function confirmAudioUnlocked(rainStarted) {
    if (!rainStarted || atmosphere.context?.state !== "running") return false;
    audioUnlocked = true;
    AUDIO_UNLOCK_EVENTS.forEach((eventName) => {
      window.removeEventListener(eventName, unlockAudio, true);
    });
    return true;
  }

  async function unlockAudio() {
    if (audioUnlocked) return true;
    if (audioUnlockPromise) return audioUnlockPromise;

    audioUnlockPromise = (async () => {
      try {
        return confirmAudioUnlocked(await atmosphere.start());
      } catch {
        return false;
      } finally {
        audioUnlockPromise = null;
      }
    })();

    return audioUnlockPromise;
  }

  function playEntryWeatherCue() {
    if (state.environment !== "monsoon") return;
    setTimeout(() => {
      if (!state.entered || state.environment !== "monsoon") return;
      triggerLightning("distant");
      setTimeout(() => {
        if (state.entered && state.environment === "monsoon") atmosphere.thunder("distant");
      }, 700 + Math.random() * 700);
    }, reducedMotion ? 120 : 320);
  }

  function enterExperience() {
    if (state.entryStarted) return;
    state.entryStarted = true;
    clearTimeout(landingLightningTimer);
    document.body.classList.add("entering");
    els.enter.disabled = true;

    // Keep a direct retry in the click gesture without duplicating an unlock
    // already started by the pointer/key event that produced this click.
    if (!audioUnlocked) {
      const entryAudioStart = audioUnlockPromise || atmosphere.start();
      entryAudioStart.then((rainStarted) => {
        if (!audioUnlocked) confirmAudioUnlocked(rainStarted);
      }).catch(() => {});
    }

    const revealExperience = () => {
      state.entered = true;
      document.body.classList.add("entry-transition-active", "entered");
      if (state.environment === "coast") coastVideo.play();
      atmosphere.setEnvironment(state.environment, reducedMotion ? 1.2 : 3);
      playEntryWeatherCue();
      scheduleEnvironmentAttention();

      setTimeout(() => {
        atmosphere.start().catch(() => showToast("Sound nahi chala. Baarish dekhte hain."));
        scheduleEnvironmentTimers();
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
      setTimeout(() => {
        if (!state.entered && audioUnlocked) atmosphere.thunder("distant");
      }, 700 + Math.random() * 1200);
      scheduleLandingLightning();
    }, 9000 + Math.random() * 13000);
  }

  function clearEnvironmentTimers() {
    clearTimeout(state.lightningTimer);
    clearTimeout(state.ambientTimer);
    clearTimeout(state.distantRumbleTimer);
    clearTimeout(weatherActionTimer);
    snow.settle();
    petals.settle();
    leaves.settle();
    dust.settle();
    coastVideo.settle();
    state.lightningTimer = null;
    state.ambientTimer = null;
    state.distantRumbleTimer = null;
    document.body.classList.remove(
      "storm-event",
      "snow-gust",
      "winter-mist-event",
      "winter-warm-event",
      "spring-breeze-event",
      "spring-mist-event",
      "spring-sun-event",
      "autumn-breeze-event",
      "autumn-haze-event",
      "autumn-sun-event",
      "desert-gust-event",
      "desert-haze-event",
      "desert-sun-event",
      "coast-breeze-event",
      "coast-mist-event"
    );
  }

  function scheduleEnvironmentTimers() {
    clearEnvironmentTimers();
    if (!state.entered || state.environmentTransitioning) return;
    scheduleAmbientEvent();
    if (state.environment === "monsoon") {
      scheduleLightning();
      scheduleDistantRumble();
    }
  }

  function environmentTransitionDuration(fromEnvironment, toEnvironment) {
    if (fromEnvironment === "spring" || toEnvironment === "spring") return SPRING_ENVIRONMENT_TRANSITION_MS;
    if (fromEnvironment === "autumn" || toEnvironment === "autumn") return SPRING_ENVIRONMENT_TRANSITION_MS;
    if (fromEnvironment === "desert" || toEnvironment === "desert") return SPRING_ENVIRONMENT_TRANSITION_MS;
    if (fromEnvironment === "coast" || toEnvironment === "coast") return SPRING_ENVIRONMENT_TRANSITION_MS;
    return DEFAULT_ENVIRONMENT_TRANSITION_MS;
  }

  async function changeEnvironment(nextEnvironment) {
    if (!state.entered || state.environmentTransitioning || !Object.hasOwn(ENVIRONMENTS, nextEnvironment)) return;
    if (nextEnvironment === state.environment) return;

    const previousEnvironment = state.environment;
    const transitionMs = environmentTransitionDuration(previousEnvironment, nextEnvironment);
    state.environmentTransitioning = true;
    clearEnvironmentTimers();
    clearTimeout(environmentTransitionTimer);
    els.environmentButton.disabled = true;
    document.body.classList.add(
      "environment-transitioning",
      `environment-from-${previousEnvironment}`,
      `environment-to-${nextEnvironment}`
    );

    state.environment = nextEnvironment;
    if (nextEnvironment === "coast") coastVideo.play();
    applyEnvironmentUi(nextEnvironment);
    atmosphere.setEnvironment(nextEnvironment, transitionMs / 1000);
    savePreferences();

    await new Promise((resolve) => {
      environmentTransitionTimer = setTimeout(resolve, transitionMs);
    });

    document.body.classList.remove(
      "environment-transitioning",
      `environment-from-${previousEnvironment}`,
      `environment-to-${nextEnvironment}`
    );
    state.environmentTransitioning = false;
    els.environmentButton.disabled = false;
    // Clear butterflies when leaving spring so they don't persist in memory
    if (previousEnvironment === "spring") butterflies.butterflies.length = 0;
    // Reset leaf gust when leaving autumn
    if (previousEnvironment === "autumn") leaves.settle();
    if (previousEnvironment === "desert") dust.settle();
    if (previousEnvironment === "coast") {
      coastVideo.settle();
      coastVideo.pause(120);
    }
    scheduleEnvironmentTimers();
    showToast(ENVIRONMENTS[nextEnvironment].toast);
  }

  function setWeatherMode(mode, announce = true) {
    if (!Object.hasOwn({ light: 1, medium: 1, heavy: 1, storm: 1 }, mode)) return;
    state.rainMode = mode;
    document.body.dataset.rainMode = mode;
    $$("[data-rain]").forEach((button) => button.classList.toggle("active", button.dataset.rain === mode));
    rain.setMode();
    snow.setMode();
    petals.setMode();
    leaves.setMode();
    dust.setMode();
    coastVideo.setMode();
    atmosphere.setRainMode(mode, 3.2);
    clearTimeout(state.lightningTimer);
    if (state.entered && state.environment === "monsoon") scheduleLightning();
    savePreferences();
    if (announce) {
      showToast(ENVIRONMENTS[state.environment].modeToasts[mode]);
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
    if (state.environment === "winter") {
      snow.gust(4.5);
      atmosphere.winterGust(4.5);
      return;
    }
    if (state.environment === "spring") {
      petals.gust(4.8);
      atmosphere.springGust(4.8);
      butterflies.breeze(); // subtle reaction
      document.body.classList.add("spring-breeze-event");
      clearTimeout(weatherActionTimer);
      weatherActionTimer = setTimeout(() => document.body.classList.remove("spring-breeze-event"), 4800);
      return;
    }
    if (state.environment === "autumn") {
      leaves.gust(5.5);
      atmosphere.autumnGust(5.5);
      document.body.classList.add("autumn-breeze-event");
      clearTimeout(weatherActionTimer);
      weatherActionTimer = setTimeout(() => document.body.classList.remove("autumn-breeze-event"), 5500);
      return;
    }
    if (state.environment === "desert") {
      dust.gust(5.5);
      atmosphere.desertGust(5.5);
      document.body.classList.add("desert-gust-event");
      clearTimeout(weatherActionTimer);
      weatherActionTimer = setTimeout(() => document.body.classList.remove("desert-gust-event"), 5500);
      return;
    }
    if (state.environment === "coast") {
      coastVideo.gust(5.2);
      atmosphere.coastGust(5.2);
      document.body.classList.add("coast-breeze-event");
      clearTimeout(weatherActionTimer);
      weatherActionTimer = setTimeout(() => document.body.classList.remove("coast-breeze-event"), 5200);
      return;
    }
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
    if (state.environment === "winter") return manualSnowGust("Hawa tez ho gayi.");
    if (state.environment === "spring") return manualSpringBreeze("Hawa mein kuch toh hai.");
    if (state.environment === "autumn") return manualAutumnBreeze("Hawa chal padi.");
    if (state.environment === "desert") return manualDesertBreeze("Ret udne lagi.");
    if (state.environment === "coast") return manualSeaBreeze("Hawa samundar se aa rahi hai.");
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

  function manualSnowGust(message = "Hawa tez ho gayi.") {
    if (state.environment !== "winter" || state.environmentTransitioning) return false;
    const now = Date.now();
    if (now - state.lastManualStorm < STORM_COOLDOWN) {
      showToast("Hawa ko zara saans lene do.");
      return false;
    }
    state.lastManualStorm = now;
    clearTimeout(weatherActionTimer);
    document.body.classList.add("snow-gust");
    snow.gust(6.5);
    atmosphere.winterGust(6.5);
    weatherActionTimer = setTimeout(() => document.body.classList.remove("snow-gust"), 6500);
    showToast(message);
    return true;
  }

  function manualSpringBreeze(message = "Hawa mein kuch toh hai.") {
    if (state.environment !== "spring" || state.environmentTransitioning) return false;
    const now = Date.now();
    if (now - state.lastManualStorm < STORM_COOLDOWN) {
      showToast("Hawa ko zara theherne do.");
      return false;
    }
    state.lastManualStorm = now;
    clearTimeout(weatherActionTimer);
    document.body.classList.add("spring-breeze-event");
    petals.gust(reducedMotion ? 3.2 : 6.5);
    atmosphere.springGust(reducedMotion ? 3.2 : 6.5);
    butterflies.breeze(); // subtle butterfly flutter reaction
    weatherActionTimer = setTimeout(() => {
      document.body.classList.remove("spring-breeze-event");
    }, reducedMotion ? 3200 : 6500);
    showToast(message);
    return true;
  }

  function manualAutumnBreeze(message = "Hawa chal padi.") {
    if (state.environment !== "autumn" || state.environmentTransitioning) return false;
    const now = Date.now();
    if (now - state.lastManualStorm < STORM_COOLDOWN) {
      showToast("Hawa ko theherne do.");
      return false;
    }
    state.lastManualStorm = now;
    clearTimeout(weatherActionTimer);
    document.body.classList.add("autumn-breeze-event");
    leaves.gust(reducedMotion ? 3.5 : 6.5);
    atmosphere.autumnGust(reducedMotion ? 3.5 : 6.5);
    weatherActionTimer = setTimeout(() => {
      document.body.classList.remove("autumn-breeze-event");
    }, reducedMotion ? 3500 : 6500);
    showToast(message);
    return true;
  }

  function manualDesertBreeze(message = "Ret udne lagi.") {
    if (state.environment !== "desert" || state.environmentTransitioning) return false;
    const now = Date.now();
    if (now - state.lastManualStorm < STORM_COOLDOWN) {
      showToast("Hawa ko theherne do.");
      return false;
    }
    state.lastManualStorm = now;
    clearTimeout(weatherActionTimer);
    document.body.classList.add("desert-gust-event");
    dust.gust(reducedMotion ? 3.2 : 6.5);
    atmosphere.desertGust(reducedMotion ? 3.2 : 6.5);
    weatherActionTimer = setTimeout(() => {
      document.body.classList.remove("desert-gust-event");
    }, reducedMotion ? 3200 : 6500);
    showToast(message);
    return true;
  }

  function manualSeaBreeze(message = "Hawa samundar se aa rahi hai.") {
    if (state.environment !== "coast" || state.environmentTransitioning) return false;
    const now = Date.now();
    if (now - state.lastManualStorm < STORM_COOLDOWN) {
      showToast("Lehron ko zara theherne do.");
      return false;
    }
    state.lastManualStorm = now;
    clearTimeout(weatherActionTimer);
    document.body.classList.add("coast-breeze-event");
    const duration = reducedMotion ? 3.2 : 6.5;
    coastVideo.gust(duration);
    atmosphere.coastGust(duration);
    weatherActionTimer = setTimeout(() => {
      document.body.classList.remove("coast-breeze-event");
    }, duration * 1000);
    showToast(message);
    return true;
  }

  function scheduleLightning() {
    clearTimeout(state.lightningTimer);
    if (state.environment !== "monsoon" || state.environmentTransitioning) return;
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
      if (state.environment === "winter") {
        clearTimeout(weatherActionTimer);
        if (pick < 0.38) {
          snow.gust(4.2);
          atmosphere.winterGust(4.2);
        } else if (pick < 0.66) {
          document.body.classList.add("winter-mist-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("winter-mist-event"), 6200);
        } else if (pick < 0.84) {
          els.chai.classList.add("steam-boost");
          weatherActionTimer = setTimeout(() => els.chai.classList.remove("steam-boost"), 5000);
        } else {
          document.body.classList.add("winter-warm-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("winter-warm-event"), 5200);
        }
      } else if (state.environment === "spring") {
        clearTimeout(weatherActionTimer);
        if (pick < 0.34) {
          petals.gust(4.5);
          atmosphere.springGust(4.5);
          butterflies.breeze(); // subtle flutter
          document.body.classList.add("spring-breeze-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("spring-breeze-event"), 4500);
        } else if (pick < 0.6) {
          document.body.classList.add("spring-mist-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("spring-mist-event"), 6000);
        } else if (pick < 0.8) {
          document.body.classList.add("spring-sun-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("spring-sun-event"), 5200);
        } else {
          els.chai.classList.add("steam-boost");
          weatherActionTimer = setTimeout(() => els.chai.classList.remove("steam-boost"), 4600);
        }
      } else if (state.environment === "autumn") {
        clearTimeout(weatherActionTimer);
        if (pick < 0.40) {
          leaves.gust(5.0);
          atmosphere.autumnGust(5.0);
          document.body.classList.add("autumn-breeze-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("autumn-breeze-event"), 5000);
        } else if (pick < 0.65) {
          document.body.classList.add("autumn-haze-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("autumn-haze-event"), 6400);
        } else if (pick < 0.82) {
          document.body.classList.add("autumn-sun-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("autumn-sun-event"), 5000);
        } else {
          els.chai.classList.add("steam-boost");
          weatherActionTimer = setTimeout(() => els.chai.classList.remove("steam-boost"), 4800);
        }
      } else if (state.environment === "desert") {
        clearTimeout(weatherActionTimer);
        if (pick < 0.42) {
          dust.gust(4.8);
          atmosphere.desertGust(4.8);
          document.body.classList.add("desert-gust-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("desert-gust-event"), 4800);
        } else if (pick < 0.68) {
          document.body.classList.add("desert-haze-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("desert-haze-event"), 6200);
        } else if (pick < 0.84) {
          document.body.classList.add("desert-sun-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("desert-sun-event"), 4800);
        } else {
          els.chai.classList.add("steam-boost");
          weatherActionTimer = setTimeout(() => els.chai.classList.remove("steam-boost"), 4600);
        }
      } else if (state.environment === "coast") {
        clearTimeout(weatherActionTimer);
        if (pick < 0.42) {
          coastVideo.gust(4.8);
          atmosphere.coastGust(4.8);
          document.body.classList.add("coast-breeze-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("coast-breeze-event"), 4800);
        } else if (pick < 0.68) {
          document.body.classList.add("coast-mist-event");
          weatherActionTimer = setTimeout(() => document.body.classList.remove("coast-mist-event"), 6000);
        } else if (pick < 0.84) {
          els.chai.classList.add("steam-boost");
          weatherActionTimer = setTimeout(() => els.chai.classList.remove("steam-boost"), 4600);
        } else {
          els.chai.classList.add("steam-boost");
          weatherActionTimer = setTimeout(() => els.chai.classList.remove("steam-boost"), 4600);
        }
      } else if (pick < 0.34) {
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
    if (state.environment !== "monsoon" || state.environmentTransitioning) return;
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
      if (!document.body.classList.contains("playlist-open") && !document.body.classList.contains("chat-open")) document.body.classList.add("ui-idle");
    }, 5200);
  }

  function resetInactivityMessage() {
    clearTimeout(state.inactivityTimer);
    state.inactivityTimer = setTimeout(() => showToast("Soya nahi?", 3500), 120000);
  }

  function openPlaylist() {
    if (document.body.classList.contains("chat-open")) window.CBGChat?.close();
    if (!environmentSwitchInteracted && (environmentAttentionTimer || els.environmentSwitch.classList.contains("attention"))) {
      stopEnvironmentAttention();
      environmentAttentionDue = true;
    }
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
    if (environmentAttentionDue && !environmentSwitchInteracted) scheduleEnvironmentAttention(1100);
  }

  async function shareBaarish() {
    const shareCopy = {
      monsoon: "Found a tiny corner of the internet for chai, baarish and purane gaane. 🌧️☕",
      winter: "Found a tiny corner of the internet for chai, baraf and purane gaane. ❄️☕",
      spring: "Found a tiny corner of the internet for chai, bahar and purane gaane. ☕",
      autumn: "Found a tiny corner of the internet for chai, patjhad and purane gaane. 🍂☕",
      desert: "Found a tiny corner of the internet for chai, registan and purane gaane. ☕"
    };
    const data = {
      title: "Chai Baarish Gaane",
      text: shareCopy[state.environment],
      url: location.href
    };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(location.href);
        const label = ENVIRONMENTS[state.environment].pickLabel.replace(/^./, (letter) => letter.toUpperCase());
        showToast(`${label} ka link copy ho gaya.`);
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
    const place = state.entered ? ENVIRONMENTS[state.environment].placeLabel : "VERANDA";
    els.weather.textContent = `${place} · ${time.toUpperCase()}`;
    if (els.entryTime) els.entryTime.textContent = time.toUpperCase();
  }

  function bindEvents() {
    AUDIO_UNLOCK_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, unlockAudio, { passive: true, capture: true });
    });

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
    els.environmentButton.addEventListener("click", () => {
      stopEnvironmentAttention(true);
      changeEnvironment(ENVIRONMENTS[state.environment].next);
    });
    els.lightningButton.addEventListener("click", () => {
      if (state.environment === "winter") manualSnowGust("Hawa tez ho gayi.");
      else if (state.environment === "spring") manualSpringBreeze("Hawa mein kuch toh hai.");
      else if (state.environment === "autumn") manualAutumnBreeze("Hawa chal padi.");
      else if (state.environment === "desert") manualDesertBreeze("Ret udne lagi.");
      else if (state.environment === "coast") manualSeaBreeze("Hawa samundar se aa rahi hai.");
      else manualStormEvent("Bijli ka bill tumhara nahi hai.");
    });

    els.chai.addEventListener("click", () => {
      state.chaiClicks += 1;
      const messages = state.environment === "winter"
        ? ["Haath sek lo.", "Kahwa abhi garam hai.", "Thand mein chai alag lagti hai.", "Ek aur bana du?"]
        : state.environment === "spring"
          ? ["Chai abhi garam hai.", "Hawa achhi chal rahi hai.", "Bas thodi der aur.", "Ek aur bana du?"]
          : state.environment === "autumn"
            ? ["Chai thandi hone wali hai.", "Hawa thodi thandi hai.", "Patjhad mein chai ka ek hi matlab hai.", "Ek aur banate hain."]
            : ["Garam hai. Sambhal ke.", "Ek aur bana du?", "Chai pehle. Kaam baad mein.", "Bhai, chai khatam ho gayi."];
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
      const env = state.environment;
      showToast(state.ambienceOn
        ? (env === "winter" ? "Pahaadi hawa wapas." : env === "spring" ? "Naram hawa wapas." : env === "autumn" ? "Sukhi hawa wapas." : env === "desert" ? "Registan ki hawa wapas." : env === "coast" ? "Lehron ki awaaz wapas." : "Ghar ki awaazein wapas.")
        : (env === "winter" ? "Hawa halki. Sirf baraf aur gaana." : env === "spring" ? "Hawa halki. Sirf gaana." : env === "autumn" ? "Hawa ruk gayi. Sirf gaana." : env === "desert" ? "Hawa tham gayi. Sirf gaana." : env === "coast" ? "Lehrein halki. Sirf gaana." : "Sirf baarish aur gaana."));
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
      setWeatherMode(button.dataset.rain, button.dataset.rain !== "storm");
      if (button.dataset.rain === "storm") {
        if (state.environment === "winter") manualSnowGust("Hawa tez ho gayi.");
        else if (state.environment === "spring") manualSpringBreeze("Hawa mein kuch toh hai.");
        else if (state.environment === "autumn") manualAutumnBreeze("Hawa chal padi.");
        else if (state.environment === "desert") manualDesertBreeze("Ret udne lagi.");
        else if (state.environment === "coast") manualSeaBreeze("Hawa samundar se aa rahi hai.");
        else manualStormEvent("Oh ho. Storm aa gaya.");
      }
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
      if (!state.entered || document.body.classList.contains("chat-open") || ["INPUT", "TEXTAREA", "BUTTON"].includes(document.activeElement?.tagName)) return;
      if (event.code === "Space") { event.preventDefault(); togglePlay(); }
      if (event.key === "ArrowRight") nextTrack();
      if (event.key === "ArrowLeft") previousTrack();
      if (event.key.toLowerCase() === "f") toggleFullscreen();
      if (event.key.toLowerCase() === "p") openPlaylist();
      if (event.key === "Escape" && document.body.classList.contains("playlist-open")) closePlaylist();
    });

    document.addEventListener("visibilitychange", () => {
      rain.running = !document.hidden;
      snow.running = !document.hidden;
      petals.running = !document.hidden;
      leaves.running = !document.hidden;
    });
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
    applyEnvironmentUi(state.environment);
    $$("[data-rain]").forEach((button) => button.classList.toggle("active", button.dataset.rain === state.rainMode));
    $$("[data-mood]", els.moodFilters).forEach((button) => button.classList.toggle("active", button.dataset.mood === state.selectedMood));
    updateClock();
    setInterval(updateClock, 60000);
    renderPlaylist();
    updateTrackUI();
    bindEvents();
    atmosphere.start().then(confirmAudioUnlocked).catch(() => {});
    scheduleLandingLightning();
  }

  initialize();
})();
