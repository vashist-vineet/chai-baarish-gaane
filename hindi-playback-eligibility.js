(() => {
  "use strict";

  const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  const orderedHindiVideoIds = Object.freeze([
    "JQoSSJDZxOo",
    "hd9HRLgNJzc",
    "AMuRRXCuy-4",
    "WrCxy1JqdYQ",
    "xGACLUFBgL0",
    "xdlZXTf2w34",
    "V8DCYB6ORAE",
    "A9arc2hWNOw",
    "6Z3DO-OFIjQ",
    "KT0NlItK86A",
    "SBfPs-PMGTA",
    "fTauOK8J-U8",
    "dReDtHKF0-g",
    "_Bhb22mLTc8",
    "5G9BcbPZQaQ",
    "KeyfUuXPOcY",
    "cNV5hLSa9H8",
    "g6Jb30bg6Ho",
    "5dWbn_qER3s",
    "V5_7mcLYDHg",
    "9HiQHEwKBTU",
    "AOrJ785iH7E",
    "6CXI5ZQgo7A",
    "L-XATrd3Guw",
    "wHIv660rbpE",
    "7KKVb0_IdD4",
    "4aonHAp21aA",
    "XG8XskoJz1I",
    "UlacMvx_VYk",
    "cmMiyZaSELo",
    "qoq8B8ThgEM",
    "ZYew0HIcFnY",
    "DAYszemgPxc",
    "oWKgpB2zpgw",
    "L0zKs8i7Nc8",
    "g0eO74UmRBs",
    "DIJW7rWPkSw",
    "zLEv6XeUAJc",
    "0T63y3Kmzb4",
    "4sMdGz8rbcs",
    "mt9xg0mmt28",
    "kPtn26x8TZM",
    "SS3lIQdKP-A",
    "ujcKFK9kuaQ",
    "2mWaqsC3U7k",
    "rURPfwV5c1o",
    "T94PHkuydcw",
    "useznoRhrWU",
    "-s0B-K_GnjM",
    "FA_J8XwpCaQ",
    "AlvUuGJccKs",
    "e5LShHAE03A",
    "mX0_1yejIQI",
    "hP2p-yH1tGU",
    "yIrU21hoHys",
    "LqsVDJL8Zz4",
    "2pRLL2zl3m4",
    "zWEOx7TSM6I",
    "-LESbtPT8uw",
    "NgjYaDqv3BA",
    "aGbPyM6lzBs",
    "2OssKfYvVys",
    "AwjEzV2G1PA",
    "v9iGIvNwGHI",
    "Km5AQkh58DU",
    "0eSVgD2V2AQ",
    "a1lQ9n-XECU",
    "jXwg9l9D51A",
    "lhx8YSbrI6A",
    "lrkaKvhRnEI",
    "iv7lcUkFVSc",
    "GLEx6bhPu7s",
    "81qmmlsIE3k",
    "II7ttbkotA0",
    "YrLcPfihpYA",
    "tQL-gx7PeBc",
    "sK7riqg2mr4",
    "R4YeD7aoOmU",
    "jJ4AsIV1FDI",
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
    "OJVKIvKFmWk",
    "GtNrQy90Ih4",
    "lpoUDudB35c",
    "d8IT-16kA8M",
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
    "V7LwfY5U5WI",
    "u6p6dubzHAc",
    "IA2SN1QQbp8",
    "Zt6C5Cg2JWo",
    "-tJ3VwhseBo",
    "NzijbnP6B0w",
    "3pz_bHeZLkg",
    "Etkd-07gnxM",
    "OXQ_qXKTqjY",
    "g5WZLO8BAC8",
    "RNkOsHChwTE",
    "B-u_jnJE_N8",
    "PR_mFnjFidk",
    "2Qxib7NSWVk",
    "gJLVTKhTnog",
    "ilNt2bikxDI",
    "P1FVilrlePw",
    "fUEC56NxUyA",
    "yG39Bggzwlo",
    "vA86QFrXoho",
    "SmaY7RfBgas",
    "KgdBrGHviv4",
    "EdftT8GMU1U",
    "bP8ATWCvqzw",
    "oafxkMv4xnc",
    "pIAGX4Hva_0",
    "6KTS5HpwK0E",
    "Mje4yC8NG_s",
    "lbWac5ji3rc",
    "KtqPRxTAbYQ",
    "fVfAvx7ghZM",
    "ze9EhyeE9-4",
    "v2dgwxvGBqE",
    "-u1YYyRmmsc",
    "QaOe6GKw5Ic",
    "guHHhEUYAQ4",
    "YTmbHhDfwMI",
    "dfghBD0hC9I",
    "cBGDDBHN22U",
    "KvWylZjOrYs",
    "4zk4M8xAYrU",
    "qKpnmFiCTSY",
    "OMoU0Pfibc4",
    "L7r_roRQMl8",
    "F5KtNSMRAfM",
    "iCZfjggJg3M",
    "7v5F-t1z5ts",
    "FxAG_11PzCk",
    "4fsEs8MtxIo",
    "VMEXKJbsUmE",
    "h5-Kq9k3zeo",
    "P2kS3h46cIA",
    "atVof3pjT-I",
    "WhOXkydrjTs",
    "iDrNusV2bE8",
    "vr8RaNuWjWc",
    "2NN4zD16MUw",
    "bCgBLKPE35Y",
    "noh67W48qlU",
    "ZsAOnmByy38",
    "acdKE2hja7w",
    "v71SiUe0KYY",
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
    "p5jvLT7wod4",
    "FNImjHOLS_E",
    "RA8iE6XwI7E",
    "ufg_wuxTVuQ",
    "CnIqESltgwA",
    "petIS6mS-0o",
    "6DK0htUj_Us",
    "LCl2_jiPtpg",
    "tALSTPQUMf8",
    "9AgIuLJ33lY"
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
    auditDate: "2026-10-28",
    sourceHindiCatalogHash: "492b24292cec85f0e294d859db2b65ea2a56083622dc092cfb5cc737d1ece68a",
    orderedManifestIdentityHash: "45861124016fd49bb6f1f482c0fb97a801254242735ef3d136288c2c3d13f612",
    orderedManifestIdsHash: "b92c92e73a38d7202ca2c2ce97b9535cc598d0e158d38b47b6b814e69090fb50",
    orderedHindiVideoIds,
    hasValidVideoId,
    isTrackEligible,
    eligibleIndices,
    resolveEligibleIndex
  });
})();
