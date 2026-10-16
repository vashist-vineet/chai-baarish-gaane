(() => {
  "use strict";

  const SHARE_VERSION = "1";
  const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

  function parseShareContext(search = "") {
    const params = new URLSearchParams(search);
    if (params.get("share") !== SHARE_VERSION) return Object.freeze({ isShared: false });
    return Object.freeze({
      isShared: true,
      environment: params.get("env") || "",
      language: params.get("lang") || "",
      mood: params.get("mood") || "",
      trackId: params.get("track") || ""
    });
  }

  function hasValidVideoId(track) {
    return Boolean(track && typeof track.youtubeId === "string" && VIDEO_ID_PATTERN.test(track.youtubeId));
  }

  function trackMatchesLanguage(track, language) {
    return language === "all" || (track.language || "hindi").toLowerCase() === language;
  }

  function trackMatchesMood(track, mood) {
    if (mood === "all") return true;
    if (Array.isArray(track.moods)) return track.moods.includes(mood);
    return track.mood === mood;
  }

  function resolveInitialState({ rawContext, saved = {}, environments, languages, moods, tracks = [], isTrackEligible }) {
    const environmentKeys = new Set(environments || []);
    const languageKeys = new Set(languages || []);
    const moodKeys = new Set(moods || []);
    const trackIsEligible = typeof isTrackEligible === "function" ? isTrackEligible : hasValidVideoId;
    const maximumTrackIndex = Math.max(tracks.length - 1, 0);
    const savedTrackIndex = Math.min(saved.currentTrack || 0, maximumTrackIndex);
    const normalState = {
      isShared: false,
      environment: environmentKeys.has(saved.environment) ? saved.environment : "monsoon",
      language: languageKeys.has(saved.selectedLanguage) ? saved.selectedLanguage : "all",
      mood: moodKeys.has(saved.selectedMood) ? saved.selectedMood : "all",
      trackIndex: savedTrackIndex,
      trackMatched: false
    };

    if (!rawContext?.isShared) return Object.freeze(normalState);

    const environment = environmentKeys.has(rawContext.environment) ? rawContext.environment : "monsoon";
    const language = languageKeys.has(rawContext.language) ? rawContext.language : "all";
    const mood = moodKeys.has(rawContext.mood) ? rawContext.mood : "all";
    const exactTrackIndex = VIDEO_ID_PATTERN.test(rawContext.trackId)
      ? tracks.findIndex((track) => trackIsEligible(track) && track.youtubeId === rawContext.trackId)
      : -1;
    const filteredFallbackIndex = tracks.findIndex((track) => (
      trackIsEligible(track) &&
      trackMatchesLanguage(track, language) &&
      trackMatchesMood(track, mood)
    ));
    const globalFallbackIndex = tracks.findIndex(trackIsEligible);

    return Object.freeze({
      isShared: true,
      environment,
      language,
      mood,
      trackIndex: exactTrackIndex >= 0
        ? exactTrackIndex
        : (filteredFallbackIndex >= 0 ? filteredFallbackIndex : Math.max(globalFallbackIndex, 0)),
      trackMatched: exactTrackIndex >= 0
    });
  }

  function buildShareUrl(baseHref, context, { environments, languages, moods } = {}) {
    const url = new URL(baseHref);
    const environmentKeys = new Set(environments || []);
    const languageKeys = new Set(languages || []);
    const moodKeys = new Set(moods || []);
    url.search = "";
    url.hash = "";
    url.searchParams.set("share", SHARE_VERSION);
    if (environmentKeys.has(context.environment)) url.searchParams.set("env", context.environment);
    if (context.language !== "all" && languageKeys.has(context.language)) url.searchParams.set("lang", context.language);
    if (context.mood !== "all" && moodKeys.has(context.mood)) url.searchParams.set("mood", context.mood);
    if (VIDEO_ID_PATTERN.test(context.trackId || "")) url.searchParams.set("track", context.trackId);
    return url.href;
  }

  function resolveFailedTrackTransition({ requestId, failedRequestId, isSharedContext, playIntent }) {
    if (requestId === failedRequestId) {
      return Object.freeze({ accepted: false, failedRequestId, autoplay: false, persistSelection: false });
    }
    const autoplay = Boolean(playIntent);
    return Object.freeze({
      accepted: true,
      failedRequestId: requestId,
      autoplay,
      persistSelection: !isSharedContext || autoplay
    });
  }

  window.CBG_SHARE_CONTEXT = Object.freeze({
    SHARE_VERSION,
    VIDEO_ID_PATTERN,
    parseShareContext,
    resolveInitialState,
    buildShareUrl,
    resolveFailedTrackTransition
  });
})();
