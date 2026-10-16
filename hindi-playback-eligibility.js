(() => {
  "use strict";

  const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  const orderedHindiVideoIds = Object.freeze([
    "JQoSSJDZxOo",
    "hd9HRLgNJzc",
    "WrCxy1JqdYQ",
    "xGACLUFBgL0",
    "xdlZXTf2w34",
    "V8DCYB6ORAE",
    "A9arc2hWNOw",
    "6Z3DO-OFIjQ",
    "KT0NlItK86A",
    "SBfPs-PMGTA",
    "fTauOK8J-U8",
    "_Bhb22mLTc8",
    "5G9BcbPZQaQ",
    "cNV5hLSa9H8",
    "g6Jb30bg6Ho",
    "5dWbn_qER3s",
    "V5_7mcLYDHg",
    "9HiQHEwKBTU",
    "AOrJ785iH7E",
    "6CXI5ZQgo7A",
    "L-XATrd3Guw",
    "wHIv660rbpE",
    "4aonHAp21aA",
    "cmMiyZaSELo",
    "qoq8B8ThgEM",
    "ZYew0HIcFnY",
    "oWKgpB2zpgw",
    "L0zKs8i7Nc8",
    "g0eO74UmRBs",
    "zLEv6XeUAJc",
    "0T63y3Kmzb4",
    "4sMdGz8rbcs",
    "kPtn26x8TZM",
    "ujcKFK9kuaQ",
    "rURPfwV5c1o",
    "-s0B-K_GnjM",
    "mX0_1yejIQI",
    "LqsVDJL8Zz4",
    "2pRLL2zl3m4",
    "zWEOx7TSM6I",
    "-LESbtPT8uw",
    "NgjYaDqv3BA",
    "aGbPyM6lzBs",
    "AwjEzV2G1PA",
    "v9iGIvNwGHI",
    "Km5AQkh58DU",
    "0eSVgD2V2AQ",
    "a1lQ9n-XECU",
    "jXwg9l9D51A",
    "lhx8YSbrI6A",
    "lrkaKvhRnEI",
    "iv7lcUkFVSc",
    "YrLcPfihpYA",
    "R4YeD7aoOmU",
    "TEc5JCL_BjE",
    "Wo5nJJiJ8Cg",
    "H2f7MZaw3Yo",
    "_Olt3tqwjuE",
    "f3FFOBrMmdg",
    "2OvZtdwe30s",
    "d3wmhbDENHs",
    "6FURuLYrR_Q",
    "284Ov7ysmfA",
    "mrdRHsIkK_c",
    "cYOB941gyXI",
    "cO02qJw6skA",
    "ZmcBC9-wAXM",
    "j6muwUGdvXw",
    "9hE7pJ3DrKI",
    "GtNrQy90Ih4",
    "lpoUDudB35c",
    "9WlczCe16Ao",
    "VmH8tELQ3aE",
    "KzBa4ZKTVjE",
    "U2UtV32zcSs",
    "peBsfgbOlYM",
    "er-I472Kszc",
    "ktPD6TMovxs",
    "bKyhc18RCho",
    "cyKZXbxx2lc",
    "C16EMv_J02w",
    "RFx4g4GunYw",
    "as6gP05d_d4",
    "u6p6dubzHAc",
    "Zt6C5Cg2JWo",
    "-tJ3VwhseBo",
    "NzijbnP6B0w",
    "3pz_bHeZLkg",
    "OXQ_qXKTqjY",
    "g5WZLO8BAC8",
    "RNkOsHChwTE",
    "B-u_jnJE_N8",
    "PR_mFnjFidk",
    "2Qxib7NSWVk",
    "P1FVilrlePw",
    "fUEC56NxUyA",
    "yG39Bggzwlo",
    "KgdBrGHviv4",
    "pIAGX4Hva_0",
    "6KTS5HpwK0E",
    "lbWac5ji3rc",
    "fVfAvx7ghZM",
    "v2dgwxvGBqE",
    "QaOe6GKw5Ic",
    "guHHhEUYAQ4",
    "YTmbHhDfwMI",
    "4zk4M8xAYrU",
    "4fsEs8MtxIo",
    "h5-Kq9k3zeo",
    "P2kS3h46cIA",
    "WhOXkydrjTs",
    "vr8RaNuWjWc",
    "2NN4zD16MUw",
    "bCgBLKPE35Y",
    "noh67W48qlU",
    "ZsAOnmByy38",
    "V1fbOsHBlZE",
    "-7_MyOao-eE",
    "Eu9LPo0gqeQ",
    "E8A5357genE",
    "hYKY4oLbs2Q",
    "wTgrZE9RWNY",
    "opABbsJaRLQ",
    "OkhjzAfaH0I",
    "F7PL4ktY3nA",
    "LpX-fCgat1M",
    "9ylzcAwzROs",
    "TuxveFT--1U",
    "u5JIUfrpzY8",
    "ZHcxorEN7k4",
    "SbnpXVOzf6g",
    "ufg_wuxTVuQ"
  ]);
  const verifiedHindiIds = new Set(orderedHindiVideoIds);

  function hasValidVideoId(track) {
    return Boolean(track && typeof track.youtubeId === "string" && VIDEO_ID_PATTERN.test(track.youtubeId));
  }

  function isTrackEligible(track) {
    if (!hasValidVideoId(track)) return false;
    if ((track.language || "hindi").toLowerCase() !== "hindi") return true;
    return verifiedHindiIds.has(track.youtubeId);
  }

  function trackMatchesLanguage(track, language) {
    return !language || language === "all" || (track.language || "hindi").toLowerCase() === language.toLowerCase();
  }

  function trackMatchesMood(track, mood) {
    if (!mood || mood === "all") return true;
    if (Array.isArray(track.moods)) return track.moods.includes(mood);
    return track.mood === mood;
  }

  function eligibleIndices(tracks, { language = "all", mood = "all", excludedIndices = new Set() } = {}) {
    return tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track, index }) => (
        isTrackEligible(track) &&
        !excludedIndices.has(index) &&
        trackMatchesLanguage(track, language) &&
        trackMatchesMood(track, mood)
      ))
      .map(({ index }) => index);
  }

  function resolveEligibleIndex(tracks, currentIndex, { language = "all", mood = "all" } = {}) {
    if (Number.isInteger(currentIndex) && isTrackEligible(tracks[currentIndex])) return currentIndex;
    return eligibleIndices(tracks, { language, mood })[0]
      ?? eligibleIndices(tracks)[0]
      ?? 0;
  }

  window.CBG_PLAYBACK_ELIGIBILITY = Object.freeze({
    auditDate: "2026-10-16",
    sourceHindiCatalogHash: "eb308a06c5a550912a1d77cbe521ffa8069d7fa6d8d3d1f4dd54973baf2e5811",
    orderedManifestIdentityHash: "4fb8dcabc45f4037c3b01f02b86c1c072390cefa8acf8a42e1d7dbc168ab7572",
    orderedManifestIdsHash: "1f59a91d3102895a750fa237c6d39a9f019f480dd6475b08499bd118649172f1",
    orderedHindiVideoIds,
    hasValidVideoId,
    isTrackEligible,
    eligibleIndices,
    resolveEligibleIndex
  });
})();
