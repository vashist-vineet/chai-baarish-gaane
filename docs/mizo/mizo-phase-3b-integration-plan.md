# Chai Baarish Gaane — Mizo Playlist Phase 3B: Application Integration Plan & Review

**Repository:** `/Users/luckyali/Desktop/Veranda/chai-baarish-gaane`  
**Branch:** `dev`  
**Reference HEAD Commit:** `68b0256` (`feat: add English playlist and playback tests`)  
**Approved Catalog Source:** `docs/mizo/mizo-song-research-and-curation.md`  
**YouTube Verification Report:** `docs/mizo/mizo-youtube-verification-report.md`  
**Embedded Playback Test Report:** `docs/mizo/mizo-youtube-playback-test-report.md`  
**Phase Objective:** Technical specification, architectural review, and end-to-end integration plan for the 100-song Mizo catalog.  
**Status:** Complete Planning Review — Ready for User Approval (Read-Only; Zero Application Modifications Applied)  

---

## 1. Executive Summary & Objective

This document establishes the **complete, line-by-line engineering plan** for integrating the approved 100-song Mizo music catalog into Chai Baarish Gaane (CBG).
The integration expands the CBG music library from **14 languages (1,265 tracks, 1,263 populated YouTube IDs)** to **15 languages (1,365 tracks, 1,363 populated YouTube IDs)**, introducing `language = "mizo"` alongside Hindi, Kannada, Malayalam, Telugu, Tamil, Bengali, Marathi, Punjabi, Odia, Bhojpuri, Assamese, Gujarati, Rajasthani, and English.

### Core Integration Principles
1. **Zero Production Risk & Strict Isolation:** The integration is strictly additive. All existing 1,265 tracks retain their exact array indices (0–1264) and byte-for-byte SHA-256 integrity.
2. **Empirical Playback Proof:** All 100 candidate recordings have passed Phase 3A automated Chromium embedded-player verification (`100 Passed, 0 Errors, 0 Restrictions`). No unverified IDs are introduced.
3. **Truthful Metadata & Zero Date Invention:** In strict adherence to CBG catalog guidelines, historical and archival songs lacking verified 4-digit release years (7 tracks) are cataloged with `year: ""` rather than inventing speculative release dates.
4. **Full UI & State Flow Compliance:** Minimal surgical touchpoints across `playlist.js`, `index.html`, and `script.js` activate language selection, dynamic track counting, mood filtering, localStorage preference persistence, and shareable deep-linking without refactoring working application code.

---

## 2. Playlist Structure & Schema Mapping

### A. Application Song Schema
In [`playlist.js`](file:///Users/luckyali/Desktop/Veranda/chai-baarish-gaane/playlist.js), song objects are instantiated using the `cbgSong` factory function:
```javascript
const cbgSong = (title, artist, film, year, decade, moods = ["romantic"], youtubeId = "", language = "hindi") => ({
  title,
  artist,
  film,
  year,
  decade,
  language,
  moods,
  youtubeId
});
```
Runtime song objects contain exactly eight keys: `["artist", "decade", "film", "language", "moods", "title", "year", "youtubeId"]`.

### B. Field Mapping Rules for Mizo
1. **`title`**: Exact canonical song title as approved in `docs/mizo/mizo-song-research-and-curation.md`. Parenthetical subtitles (e.g. *Ka Lai (Sang Fal)*, *Aw Ka Ngai Em A Che (Luah Loh Di Hmeltha)*, *Ro Min Rêlsak Ang Che (Aw Nang, Kan Lal, Kan Pathian)*) are preserved to retain cultural recognition.
2. **`artist`**: Complete artist credits including featured performers and composer credits (*Phuahtu: ...*), as approved in the curation document (e.g., `Guru Gee (Phuahtu: Guru Gee)`, `David Darlong (Phuahtu: R. Lalhmangaiha)`). Preserving composer credits honors Mizo songwriting tradition where lyricist/composers hold paramount cultural esteem.
3. **`film` (Context)**: For non-film regional singles and modern releases, this field holds the release context, album, or EP title (e.g., `"Single"`, `"Vangpui Lunglen S4"`, `"Run Nuam Album"`, `"Bul I Tan Nan EP"`, `"Phek 35 Na"`, `"Family Worship 4"`, `"Grace OST"`).
4. **`year`**: Exact 4-digit release year string (`"2025"`, `"2024"`, `"2023"`, `"2007"`, `"1985"`, `"1947"`, `"1944"`).
   - **Missing Date Handling:** Seven tracks without a verified 4-digit release year (#67, #68, #69, #75, #76, #77, #82) are assigned empty string `year: ""`. Speculative release years are **not invented**, matching the precedent set by traditional Rajasthani catalog entries (`"Mor Bole Re"`, `"Mumal"`, `"Panihari"`).
   - **Composite/Digitized Tracks:** For tracks with composition vs. digitization dates, the primary verified recording/release year is used (e.g. #27 `2007`, #32 `2008`, #49 `2018`, #55 `2022`).
5. **`decade`**: Standard CBG decade tag (`"20s"`, `"10s"`, `"00s"`, `"80s"`, `"40s"`, or `""` when exact year is omitted). Note that `decade` is an internal metadata tag and does not affect UI playback or filtering.
6. **`moods`**: Array of 2–3 valid tags drawn strictly from CBG's application taxonomy: `['baarish', 'old-gold', 'romantic', 'sad', 'safar', 'shaam', 'sukoon', 'nostalgic']`.
7. **`youtubeId`**: The verified 11-character YouTube video ID confirmed during Phase 3A embedded playback testing.
8. **`language`**: Constant string `"mizo"`.

### C. Mood Taxonomy Distribution
The 100 Mizo tracks map across CBG's mood taxonomy as follows (tracks contain multiple overlapping moods):
- **`sukoon` (Peace / Serenity):** 52 tracks (including gospel hymns, devotional classics, acoustic ballads)
- **`romantic` (Love / Intimacy):** 46 tracks (contemporary pop, RnB, acoustic love songs)
- **`nostalgic` (Reminiscence / Yearning):** 38 tracks (patriotic anthems, vintage recordings, gospel)
- **`safar` (Travel / Uplifting Rhythm):** 18 tracks (upbeat pop, melodic acoustic anthems)
- **`shaam` (Evening Chill):** 13 tracks (lo-fi hip-hop, contemporary late-night RnB)
- **`old-gold` (Heritage Classics):** 11 tracks (canonical 20th-century anthems, golden era cassettes)
- **`sad` (Heartbreak / Melancholy):** 9 tracks (poignant ballads, longing compositions)
- **`baarish` (Rain / Atmosphere):** 3 tracks (acoustic rain/mist atmospheres, e.g. #18, #65, #77)

---

## 3. Approved 100-Song Runtime Mapping Manifest

The table below details all 100 approved songs mapped to the runtime schema, ordered 1–100 exactly as approved:

| # | Title | Artist Credit | Release Context (`film`) | Year | Decade | Mood Tags (`moods`) | YouTube ID | Language |
|---|---|---|---|---|---|---|---|---|
| **1** | Elina | Guru Gee (Phuahtu: Guru Gee) | Single | `"2025"` | `"20s"` | `["romantic", "sukoon"]` | `01_T76ypu3A` | `mizo` |
| **2** | Ka Lai (Sang Fal) | Rebecca Lallawmsangi ft. Lil Kiki | Single | `"2025"` | `"20s"` | `["safar", "romantic"]` | `BD4y5LLRnXg` | `mizo` |
| **3** | Ṭhalenghermawi | Guru Gee (Phuahtu: Guru Gee) | Single | `"2024"` | `"20s"` | `["safar", "romantic"]` | `jMAlGXlZbFU` | `mizo` |
| **4** | Hriat Ka Duh | Rebecca Lallawmsangi ft. Young Fella | Single | `"2023"` | `"20s"` | `["safar", "romantic"]` | `zHBtAihn778` | `mizo` |
| **5** | Tui Leh Mei | SaiWanah ft. Omomi | Single | `"2022"` | `"20s"` | `["shaam", "sukoon"]` | `lTioL5yZXS8` | `mizo` |
| **6** | Rûnhmun Dî | Sangtei Khuptong | Single | `"2025"` | `"20s"` | `["romantic", "sukoon"]` | `H2i9h6B8fY0` | `mizo` |
| **7** | Beisei Bo | Aengi & Rosalyn (Phuahtu: Aengi Royte) | Single | `"2025"` | `"20s"` | `["romantic", "sukoon"]` | `Cu1jtZPuc2c` | `mizo` |
| **8** | Min Vei Ve Rawh | Kimkima (Phuahtu: Lalneihthangi) | Vangpui Lunglen S4 | `"2023"` | `"20s"` | `["romantic", "sukoon"]` | `sNI66ANu7MA` | `mizo` |
| **9** | Nihawi | Siampuii Ralte (Phuahtu: Rza Pachuau) | Single | `"2025"` | `"20s"` | `["romantic", "sukoon"]` | `TDdq1QEe4tc` | `mizo` |
| **10** | Hmangaihna | Rpa Ralte ft. Bzi Tochhawng | Single | `"2024"` | `"20s"` | `["romantic", "sukoon"]` | `8nDftqrLNgI` | `mizo` |
| **11** | Ka Lo Nghak Reng Ang Che | Triau Trackx ft. Ruatfeli | Single | `"2020"` | `"20s"` | `["romantic", "sukoon"]` | `S9ml1YxZMiM` | `mizo` |
| **12** | Bul I Tan Nan | Dingtea Guite | EP Title Track | `"2021"` | `"20s"` | `["safar", "romantic"]` | `6q_EiiPvxjw` | `mizo` |
| **13** | Darbiahnem | Guru Gee | Single | `"2024"` | `"20s"` | `["safar", "romantic"]` | `QqfbuDlRl6E` | `mizo` |
| **14** | Lungdum Parmawite | Guru Gee | Single / Zonet Awards | `"2023"` | `"20s"` | `["shaam", "sukoon"]` | `ZFeNWXsZkFE` | `mizo` |
| **15** | Hmangaih Vangin | Rpa Ralte ft. Bzi Tochhawng | Single | `"2023"` | `"20s"` | `["shaam", "sukoon"]` | `f4Vwq7revn4` | `mizo` |
| **16** | Zohnahthlak Lanu | Kimkima (Phuahtu: Lalsangluaia Renthlei) | Digital Single | `"2024"` | `"20s"` | `["romantic", "sukoon"]` | `xvFk1yvqHJg` | `mizo` |
| **17** | Piallei Leh Thangvan | Rpa Ralte ft. Hmangaihi | Single | `"2024"` | `"20s"` | `["shaam", "sukoon"]` | `3W2Olulo8D4` | `mizo` |
| **18** | Zanlai Thlifim | Kimkima (Phuahtu: Lallianmawia Pachuau) | Single | `"2023"` | `"20s"` | `["baarish", "nostalgic", "sukoon"]` | `bC8aLHZnGvI` | `mizo` |
| **19** | Mampui (Lungrunpui) | Gnat Lalrinchhana (Phuahtu: Sangtea Ronald) | EP | `"2010"` | `"10s"` | `["romantic", "sukoon"]` | `R5bHpA7yTZs` | `mizo` |
| **20** | Luahlai I Rem Si Lo | Lalrindiki Khiangte (Daduhi) (Phuahtu: C. Durthanga) | Single | `"2017"` | `"10s"` | `["sad", "romantic"]` | `jTDTT9CbawM` | `mizo` |
| **21** | Thawnthu Tawp Thei Lo Tur | Siampuii Ralte (Phuahtu: Parmawi) | Single | `"2021"` | `"20s"` | `["romantic", "sukoon"]` | `fFTb9H0Wk-o` | `mizo` |
| **22** | Lunglen | Mimi Renthlei | Single | `"2025"` | `"20s"` | `["romantic", "sukoon"]` | `sgwt3Nb7_9M` | `mizo` |
| **23** | Khuavang Note | Rpa Ralte ft. Shin Bia | Single | `"2023"` | `"20s"` | `["shaam", "sukoon"]` | `N_EWPwOwWM4` | `mizo` |
| **24** | Hmangaihna Diklo | Young Fella & Smiley | Single / YK Ent | `"2023"` | `"20s"` | `["safar", "romantic"]` | `cH6V8P5RUFU` | `mizo` |
| **25** | Ka Hringnun Diary | K. Hminga (Phuahtu: K. Hminga) | Single | `"2022"` | `"20s"` | `["romantic", "sukoon"]` | `deaVRRUe7Ps` | `mizo` |
| **26** | Ka Neih Chhun | Rebecca Lallawmsangi (Phuahtu: SaiWanah Sailo) | Single | `"2022"` | `"20s"` | `["romantic", "sukoon"]` | `vk9OHqYvkRg` | `mizo` |
| **27** | Suihlunglen | Mami Varte (Phuahtu: Mapuii Fanai & John Mawitea) | Damlai Par | `"2007"` | `"00s"` | `["romantic", "sukoon"]` | `pLJ4FosvNxY` | `mizo` |
| **28** | I Zun Ngaih Lunglen Vangin | Kimkima (Phuahtu: Kimkima) | Single | `"2018"` | `"10s"` | `["romantic", "sukoon"]` | `fV6zVnGkvu4` | `mizo` |
| **29** | A Na Em Mai | Lalrindiki Khiangte (Daduhi) | Digital Album | `"2017"` | `"10s"` | `["sad", "romantic"]` | `geC4sClGLfY` | `mizo` |
| **30** | Naktuka Fam Tur Ni Ila | K. Hminga (Phuahtu: K. Hminga) | Single | `"2024"` | `"20s"` | `["romantic", "sukoon"]` | `Uj-DJ8n5O8c` | `mizo` |
| **31** | Zantin Mangtha | Manuna (Phuahtu: T. Lalnunzama) | Single | `"2025"` | `"20s"` | `["romantic", "sukoon"]` | `ubQthmD8E_c` | `mizo` |
| **32** | Engtin? | Manuna (Hard Ray) | Hringnun | `"2008"` | `"00s"` | `["romantic", "sukoon"]` | `T94waJeR0cA` | `mizo` |
| **33** | I Tel Loin | Triau Trackx | Single | `"2020"` | `"20s"` | `["romantic", "sukoon"]` | `ZYk9OvnxCJU` | `mizo` |
| **34** | Thian | SaiWanah ft. Henz (TRG) | Single / Zorimawi | `"2022"` | `"20s"` | `["safar", "romantic"]` | `fOvXpB2DYpo` | `mizo` |
| **35** | Sakhmel Mawi | Lalrindiki Khiangte (Daduhi) | Digital Album | `"2017"` | `"10s"` | `["romantic", "sukoon"]` | `mngLuD89FtE` | `mizo` |
| **36** | A Riang Chan Tawk | Michael M Sailo ft. Elizabeth Zodinpuii | Single | `"2022"` | `"20s"` | `["romantic", "sukoon"]` | `JCxs1uYwl9c` | `mizo` |
| **37** | Ka Pa Khuma | SaiWanah ft. Mary Dawngi | Run Nuam Album | `"2023"` | `"20s"` | `["safar", "romantic"]` | `DA9gCKwaefg` | `mizo` |
| **38** | Chhai Ang | Rebecca Lallawmsangi ft. Lil Kiki (Phuahtu: Peka Fanai & Lil Kiki) | Single | `"2023"` | `"20s"` | `["safar", "romantic"]` | `OP-rseLPpSg` | `mizo` |
| **39** | Phuloh Lengi | Lalnunsanga (Phuahtu: Darthuama) | Phek 35 Na | `"2016"` | `"10s"` | `["sad", "romantic"]` | `qLpoCWWFSxM` | `mizo` |
| **40** | Ka Pa'n A Ti | Mendal | Single / YK Ent | `"2023"` | `"20s"` | `["safar", "romantic"]` | `NhcpUZ5bqg4` | `mizo` |
| **41** | Dí Rûk Tê! | Sangtei Khuptong | Single | `"2023"` | `"20s"` | `["romantic", "sukoon"]` | `2NHTelKYpas` | `mizo` |
| **42** | Ka Tlawm | Lesky Hype | Single / Zorimawi | `"2023"` | `"20s"` | `["sad", "romantic"]` | `dWqCtjlPmDQ` | `mizo` |
| **43** | Chhun Ni A Rei Mang E | Lalrindiki Khiangte (Daduhi) | Digital Album | `"2017"` | `"10s"` | `["sad", "romantic"]` | `wRa1a3fESwU` | `mizo` |
| **44** | Nang Nen | Chrisz Mizo ft. Sangsangi | Single / Zorimawi | `"2024"` | `"20s"` | `["safar", "romantic"]` | `S0aG8Z_YOwc` | `mizo` |
| **45** | Nghilh Har Di Hlui | Aengi & Rosalyn (Phuahtu: Aengi Royte) | Single | `"2024"` | `"20s"` | `["sad", "romantic"]` | `Z4Lqz5xU_rc` | `mizo` |
| **46** | Run Nuam | SaiWanah | Album Title Track | `"2023"` | `"20s"` | `["safar", "romantic"]` | `O4Qti_WdpVI` | `mizo` |
| **47** | Khuanu Malsawmna | SaiWanah ft. Benjamin Sum | Single | `"2022"` | `"20s"` | `["safar", "romantic"]` | `R8p_wg-lN2U` | `mizo` |
| **48** | Thiannu Ngurpuii | K. Hminga (Phuahtu: K. Hminga) | Single | `"2025"` | `"20s"` | `["romantic", "sukoon"]` | `s5yXryRLiH0` | `mizo` |
| **49** | Ka Ngai Ber Che | Mimi Renthlei (Phuahtu: Zirsangzela Hnamte) | Single | `"2018"` | `"10s"` | `["romantic", "sukoon"]` | `WUXtamW7BAo` | `mizo` |
| **50** | Hmeltha | Ahima Khiangte ft. Clement | Single | `"2023"` | `"20s"` | `["romantic", "sukoon"]` | `L7AJ8-wSDeE` | `mizo` |
| **51** | Nghilh A Har | Shai Hills | Single | `"2020"` | `"20s"` | `["romantic", "sukoon"]` | `FHrqGOi48JE` | `mizo` |
| **52** | I Zunzam | Matilda & The Quest | Single | `"2021"` | `"20s"` | `["shaam", "sukoon"]` | `Rf8SUVG3LjA` | `mizo` |
| **53** | Rose | Dingtea Guite | Bul I Tan Nan EP | `"2021"` | `"20s"` | `["shaam", "sukoon"]` | `JOx_3qfKNyk` | `mizo` |
| **54** | Lam Dun Ila | Alex Hauhulh ft. JH Peka | Single | `"2022"` | `"20s"` | `["safar", "romantic"]` | `gOzNLBP-pzY` | `mizo` |
| **55** | A Va Mak Em | Van Hlei Sung (Phuahtu: H.C. Sanglura) | Single | `"2022"` | `"20s"` | `["romantic", "sukoon"]` | `VtJKKn3Onqw` | `mizo` |
| **56** | Vawi Khat Tal | Jenny Jathang (Phuahtu: Peka Fanai) | Album Title Track | `"2021"` | `"20s"` | `["shaam", "sukoon"]` | `CLUocxMWdx0` | `mizo` |
| **57** | Lung Min Lentu | Francis (Francis Lallawmkima) | Single / Westend | `"2020"` | `"20s"` | `["shaam", "sukoon"]` | `tbEoATkkz9c` | `mizo` |
| **58** | Ka Lung Damna | Rebecca Saimawii | Single | `"2020"` | `"20s"` | `["romantic", "sukoon"]` | `PQxacSyqJb4` | `mizo` |
| **59** | Highschool | Dior ft. Morningstar | Aizawl Urban Records | `"2019"` | `"10s"` | `["safar", "romantic"]` | `Ke2lP2-9mhk` | `mizo` |
| **60** | I Tang Ka Belh Lai Khan | Van Hlei Sung (Phuahtu: Rpa Ralte) | Single | `"2022"` | `"20s"` | `["shaam", "sukoon"]` | `DaClXuHNCoc` | `mizo` |
| **61** | Thinlung Khawngaihthlak | Francis (Francis Lallawmkima) (Phuahtu: Ramenga & Ramsanga) | Single | `"2019"` | `"10s"` | `["sad", "romantic"]` | `RYMefTCUjww` | `mizo` |
| **62** | Di Lenna | Famkima ft. Rebecca Lallawmsangi | Single | `"2021"` | `"20s"` | `["safar", "romantic"]` | `VSfFWLe5pBg` | `mizo` |
| **63** | Engtinnge Ni Dawn? | Cassettes (Phuahtu: Ramenga) | Single | `"2019"` | `"10s"` | `["shaam", "sukoon"]` | `ZKbjcC-WD5k` | `mizo` |
| **64** | Khuanu Ruatloh Di | Malsawmtluangi Fanai (Msi) | Single | `"2023"` | `"20s"` | `["sad", "romantic"]` | `UXE-jGHqtKw` | `mizo` |
| **65** | Nang Ngaih A Zual | R. Lalhmangaiha / David Darlong | Vangpui Lunglen S4 | `"2021"` | `"20s"` | `["baarish", "nostalgic", "sukoon"]` | `ozLDZjK5JY8` | `mizo` |
| **66** | Damlai Par | Mami Varte (Phuahtu: John Mawitea & Mapuii Fanai) | Album Title Track | `"2007"` | `"00s"` | `["romantic", "sukoon"]` | `IxWVI21wxC8` | `mizo` |
| **67** | Khuavang Kal Lai | C.FL Hmingthanga (Phuahtu: C.FL Hmingthanga) | Single | `""` | `""` | `["old-gold", "nostalgic", "sukoon"]` | `iBtUyCL8hIQ` | `mizo` |
| **68** | Aw Ka Ngai Em A Che (Luah Loh Di Hmeltha) | C.FL Hmingthanga | Single | `""` | `""` | `["old-gold", "nostalgic", "sad"]` | `MBmf8mWfvz8` | `mizo` |
| **69** | Leng Dang Dar Ang a Chhai an Ti Che | Vanlalruati (Phuahtu: Sangkhuma Hnamte) | Single | `""` | `""` | `["old-gold", "nostalgic", "sukoon"]` | `mof-M5ps4KE` | `mizo` |
| **70** | Vanlalhmelthai | Muffy Hauhnar ft. Juan Angtea | Single / Zorimawi | `"2022"` | `"20s"` | `["safar", "romantic"]` | `yMesoUXSBDU` | `mizo` |
| **71** | Nunhlui Ngaiin | Lallianmawia Pachuau | Hnahthial | `"1985"` | `"80s"` | `["shaam", "sukoon"]` | `a2gTyOZ0CEE` | `mizo` |
| **72** | Kha Ni Kha | Rpa Ralte ft. Elena HT Par | Single | `"2022"` | `"20s"` | `["shaam", "sukoon"]` | `CUDzuEWluac` | `mizo` |
| **73** | Hrilh Ka Hai Ngei | Lalrindiki Khiangte (Daduhi) (Phuahtu: C. Durthanga) | Single | `"2017"` | `"10s"` | `["romantic", "sukoon"]` | `NTdZ8eihDg4` | `mizo` |
| **74** | In Tan | Triau Trackx (Phuahtu: Ramenga) | Single | `"2019"` | `"10s"` | `["safar", "romantic"]` | `owKHIPScOz8` | `mizo` |
| **75** | Duhsakna | Vanlalsailova (Phuahtu: C.K. Khai) | Single | `""` | `""` | `["romantic", "sukoon"]` | `JEyG1Mcz4bo` | `mizo` |
| **76** | Kan Zotlang Ram Nuam | Pu Rokunga | Single | `""` | `""` | `["old-gold", "nostalgic", "sukoon"]` | `WUGTXPeXLpI` | `mizo` |
| **77** | Ka Pianna Zoram Nuam (Lentupui Kai Vel Romei Chhumin) | Pu Rokunga | Single | `""` | `""` | `["old-gold", "nostalgic", "sukoon"]` | `haFTOpRJEu4` | `mizo` |
| **78** | Ro Min Rêlsak Ang Che (Aw Nang, Kan Lal, Kan Pathian) | Pu Rokunga | Single | `"1947"` | `"40s"` | `["romantic", "sukoon"]` | `qe8DgoTaWlw` | `mizo` |
| **79** | Raltiang I Kai Ve Ang | Pu Rokunga | Single | `"1944"` | `"40s"` | `["old-gold", "nostalgic", "sukoon"]` | `16XLg5KbBDo` | `mizo` |
| **80** | Thinlung a Thlir Zawk Thin E | Vanlalsailova (Phuahtu: Vanlalsailova) | Single | `"2021"` | `"20s"` | `["sukoon", "nostalgic"]` | `1Oo7rdwX9HM` | `mizo` |
| **81** | Runmawi | Vanlalsailova (Phuahtu: Valzotea) | Album Title Track | `"2004"` | `"00s"` | `["sukoon", "romantic"]` | `8enjgPkJFdM` | `mizo` |
| **82** | Hahchawlhna | Vanlalsailova (Phuahtu: Sanglianthanga) | Single | `""` | `""` | `["sukoon", "nostalgic"]` | `Bl5MhLToigI` | `mizo` |
| **83** | Min Hmangaih Si A | Bethsy Lalrinsangi (Phuahtu: C. Lalzarmawia) | Album Track | `"2021"` | `"20s"` | `["sukoon", "nostalgic"]` | `C2Jd9I4YGyI` | `mizo` |
| **84** | Isua Nen Chuan | Bethsy Lalrinsangi | Album Track | `"2021"` | `"20s"` | `["sukoon", "nostalgic"]` | `YnIFVX98hqU` | `mizo` |
| **85** | Nitin Hian | Bethsy Lalrinsangi (Phuahtu: C. Lalzarmawia) | Album Track | `"2021"` | `"20s"` | `["sukoon", "nostalgic"]` | `OjdJblwxZ2c` | `mizo` |
| **86** | Nun Ṭobul | Jonathan Lianhna (Phuahtu: Jonathan Lianhna) | Single | `"2023"` | `"20s"` | `["sukoon", "nostalgic"]` | `qTWjv3eG6KM` | `mizo` |
| **87** | Ka Thlang Sual Lo | Jonathan Lianhna | Single | `"2023"` | `"20s"` | `["sukoon", "nostalgic"]` | `aFN4ul8iE2w` | `mizo` |
| **88** | Ka Chiang Nawn Leh Thin | Jonathan Lianhna | Single | `"2025"` | `"20s"` | `["sukoon", "nostalgic"]` | `78iIzOY1nyk` | `mizo` |
| **89** | Lalpa Remruat | Stacy Punte | Single / Blue Wave | `"2021"` | `"20s"` | `["sukoon", "nostalgic"]` | `xHjsd0ibTAM` | `mizo` |
| **90** | Ka Thupui Ber | Stacy Punte | Single | `"2024"` | `"20s"` | `["sukoon", "nostalgic"]` | `Tr3pQHCsBfk` | `mizo` |
| **91** | Isua A Tel Ve | Maruati Hnamte | Single | `"2023"` | `"20s"` | `["sukoon", "nostalgic"]` | `t7m5AeTo76A` | `mizo` |
| **92** | Ka Thlang Nawn Zel Fovang Che | Maruati Hnamte (Phuahtu: Capt. C Vanlalhriatpuia) | Single | `"2022"` | `"20s"` | `["sukoon", "nostalgic"]` | `D1WawxKodCI` | `mizo` |
| **93** | Khi Vanah Khian | Zorema Khiangte | Single | `"2025"` | `"20s"` | `["sukoon", "romantic"]` | `yyrkpsqhyfs` | `mizo` |
| **94** | I Hlû A Ni | Zorema Khiangte (Phuahtu: C. Lalzarmawia) | Single | `"2022"` | `"20s"` | `["sukoon", "romantic"]` | `CLKDNnK1v1U` | `mizo` |
| **95** | Nitinin Hmangaih Che Ka Duh | Pensy B Lalthangliani (Phuahtu: C. Lalzarmawia) | Single | `"2021"` | `"20s"` | `["sukoon", "romantic"]` | `bbXwgQ5y3JQ` | `mizo` |
| **96** | Thlarauin Min Hruai Rawh | Jerry Lalrinawma (Phuahtu: J.H. Mangheta) | Single | `"2022"` | `"20s"` | `["sukoon", "nostalgic"]` | `FR5fRTKp7SA` | `mizo` |
| **97** | Aw Ropui Ber | Grace Lalchhanhimi | Album A Kiangah | `"2022"` | `"20s"` | `["sukoon", "nostalgic"]` | `gKnrHuWKXrU` | `mizo` |
| **98** | An Hrilhfiah | Isaac Hnamte (Phuahtu: C. Lalzarmawia) | Family Worship 4 | `"2022"` | `"20s"` | `["sukoon", "nostalgic"]` | `lMUZgcUYzDM` | `mizo` |
| **99** | Grep Hrui Tak | Hlimhlimi (Vanlalhlimpuii Hmar) | Single | `"2024"` | `"20s"` | `["sukoon", "nostalgic"]` | `PY9z52xSXzA` | `mizo` |
| **100** | Min Pui Ang Che | Hlimhlimi (Vanlalhlimpuii Hmar) (Phuahtu: R. Lalchhanhima - Chhantea) | Single | `"2020"` | `"20s"` | `["sukoon", "nostalgic"]` | `HKi-SYz3Dz8` | `mizo` |

---

## 4. Language Registration & UI Integration Touchpoints

### A. Complete Audit of Language References Across the Codebase

A full static analysis was conducted across all files to identify every touchpoint where languages are registered, displayed, selected, filtered, or persisted:

1. **`playlist.js` (Catalog Registration):**
   - Song objects declare `language: "mizo"` via the `cbgSong` constructor.
   - The playlist array `window.CBG_PLAYLIST` serves as the single source of truth for all track metadata.
2. **`index.html` (UI Selector):**
   - Line 256: `<select id="languageFilters" aria-label="Filter songs by language">` defines the dropdown options.
   - Requires adding: `<option value="mizo" data-language="mizo">Mizo</option>`.
3. **`script.js` (Application State & Engine):**
   - Line 210–211: `availableLanguages` Set whitelist:
     ```javascript
     const availableLanguages = new Set(["all", "hindi", "kannada", "malayalam", "telugu", "tamil", "bengali", "marathi", "punjabi", "odia", "bhojpuri", "assamese", "gujarati", "rajasthani"]);
     availableLanguages.add("english");
     availableLanguages.add("mizo"); // <-- Add Mizo
     ```
   - Line 228: `language: availableLanguages.has(saved.selectedLanguage) ? saved.selectedLanguage : "all"` cleanly loads saved Mizo preference from localStorage.
   - Line 1983–1986: `trackMatchesLanguage(track, language)` matches `(track.language || "hindi").toLowerCase() === language.toLowerCase()`.
   - Line 2006–2017: `updateFilterOptionCounts()` dynamically queries all `<option>` elements in `#languageFilters`, calculates eligible track counts for the active mood, and appends the count badge (e.g. `Mizo (100)`). No hardcoded language lists exist here.
   - Line 2101–2105: `isTrackEligibleForPlayback(track)` automatically considers non-Hindi tracks with valid 11-char YouTube IDs as playback eligible.
   - Line 3359–3369: Event listener on `#languageFilters` change updates `state.selectedLanguage`, clears and rebuilds the shuffle queue (`rebuildShuffleQueue()`), re-renders the playlist drawer (`renderPlaylist()`), and saves preferences (`savePreferences()`).
4. **`share-context.js` (Shareable URLs & Deep Linking):**
   - `resolveInitialState({ languages, ... })` accepts the `availableLanguages` set dynamically from `script.js`.
   - Deep links with `?lang=mizo` automatically resolve, validate, and set the application filter state without requiring changes to `share-context.js`.
5. **Responsive & Mobile Viewport Compatibility:**
   - `#languageFilters` is styled as a native HTML `<select>` inside `.playlist-select-wrap`.
   - Increasing from 15 options (All + 14 languages) to 16 options (All + 15 languages) introduces zero layout distortion, overflow, or flex wrapping issues on mobile or desktop viewports.

### B. Minimum Code Changes Required
Only three files require direct production edits, totaling **102 lines of code added** (100 lines in `playlist.js`, 1 line in `index.html`, 1 line in `script.js`):

#### 1. [`playlist.js`](file:///Users/luckyali/Desktop/Veranda/chai-baarish-gaane/playlist.js)
Append the 100 `cbgSong` entries to the end of `window.CBG_PLAYLIST`:
```javascript
  /* Mizo — approved Phase 1 / Phase 2 / Phase 3A manifest */
  cbgSong("Elina", "Guru Gee (Phuahtu: Guru Gee)", "Single", "2025", "20s", ["romantic","sukoon"], "01_T76ypu3A", "mizo"),
  cbgSong("Ka Lai (Sang Fal)", "Rebecca Lallawmsangi ft. Lil Kiki", "Single", "2025", "20s", ["safar","romantic"], "BD4y5LLRnXg", "mizo"),
  // ... tracks 3 through 99 ...
  cbgSong("Min Pui Ang Che", "Hlimhlimi (Vanlalhlimpuii Hmar) (Phuahtu: R. Lalchhanhima - Chhantea)", "Single", "2020", "20s", ["sukoon","nostalgic"], "HKi-SYz3Dz8", "mizo")
];
```

#### 2. [`index.html`](file:///Users/luckyali/Desktop/Veranda/chai-baarish-gaane/index.html)
Add the `<option>` tag inside `#languageFilters` (Line ~272):
```diff
                 <option value="rajasthani" data-language="rajasthani">Rajasthani</option>
                 <option value="english" data-language="english">English</option>
+                <option value="mizo" data-language="mizo">Mizo</option>
               </select>
```

#### 3. [`script.js`](file:///Users/luckyali/Desktop/Veranda/chai-baarish-gaane/script.js)
Add `"mizo"` to `availableLanguages` (Line ~212):
```diff
   const availableLanguages = new Set(["all", "hindi", "kannada", "malayalam", "telugu", "tamil", "bengali", "marathi", "punjabi", "odia", "bhojpuri", "assamese", "gujarati", "rajasthani"]);
   availableLanguages.add("english");
+  availableLanguages.add("mizo");
```

---

## 5. Testing & Validation Strategy

### A. Proposed Mizo Test Suite: `test/mizo-playback.test.js`
Following the rigorous patterns established in [`test/english-playback.test.js`](file:///Users/luckyali/Desktop/Veranda/chai-baarish-gaane/test/english-playback.test.js) and [`test/rajasthani-playback.test.js`](file:///Users/luckyali/Desktop/Veranda/chai-baarish-gaane/test/rajasthani-playback.test.js), a new dedicated test file will be created containing four comprehensive unit and contract tests:

1. **Test 1: Mizo runtime catalog integrity & hash locks:**
   - Asserts total playlist length is exactly `1,365`.
   - Asserts Mizo catalog length is exactly `100`.
   - Locks the catalog against unauthorized edits via SHA-256 core hash and full hash:
     - `EXPECTED_MIZO_CORE_HASH = "f903f6f44b0be56c7167e01d300a4e4b5ae724b4787963aa2fbd66963fcbf52b"`
     - `EXPECTED_MIZO_FULL_HASH = "cdf446f81ebde5a034d7e436203c9a818a637b7cdfe1eb85c1c1dd012a3b358c"`
   - Asserts all 100 YouTube IDs are valid 11-character strings (`/^[A-Za-z0-9_-]{11}$/`).
   - Asserts all 100 tracks have non-empty mood arrays (`moods.length > 0`).
   - Asserts schema keys match `['artist', 'decade', 'film', 'language', 'moods', 'title', 'year', 'youtubeId']`.
   - Asserts all 100 Mizo IDs are unique within Mizo (`new Set(mizoIds).size === 100`).
   - Asserts 0 ID collisions against any of the 1,263 other language IDs.
   - Asserts 0 identity collisions across the entire 1,365-track catalog.
   - Confirms that the only two unverified tracks in the entire library remain `['Jaage Jaage', 'Woh Lamhe']`.
2. **Test 2: All 14 pre-Mizo language catalogs are byte-for-byte unchanged:**
   - Validates that the addition of Mizo did not mutate a single character or byte in any prior language.
   - Hash lock table:
     ```javascript
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
       gujarati: [71, "433502b614d6899f60e95767ecbb5a42439e731959336f178b73518b9304e702"],
       rajasthani: [33, "f7cf140919fb868655420ab134bb9cb83c751659b760d643cd86cc384d6e4e21"],
       english: [100, "40619a1e124142d3cfd4a932918ff8aa7f385335a34bee8c4b6614dfc8acf5c1"]
     };
     ```
3. **Test 3: Mizo language and mood pools contain only eligible stable indices:**
   - Iterates through all 16 language options (`all` + 15 languages) and all moods.
   - Asserts that filtering for `language === "mizo"` yields strictly unique, valid indices pointing to tracks where `track.language === "mizo"`.
4. **Test 4: UI selector, state registration, and recovery integration:**
   - Verifies `index.html` contains `<option value="mizo" data-language="mizo">Mizo</option>`.
   - Verifies `script.js` contains `availableLanguages.add("mizo")`.
   - Verifies integration with queue rebuilding, error recovery, and filter counts.

### B. Coordinated Updates to 10 Existing Test Files
Ten existing playback test suites assert the previous total catalog size (`1265`) and populated IDs count (`1263`). When Mizo is added, these assertions must be updated to `1365` and `1363`:
```
┌───────────────────────────────────┬───────────────────────────────────┬───────────────────────────────────┐
│ Existing Test File                │ Line Reference                    │ Coordinated Change                │
├───────────────────────────────────┼───────────────────────────────────┼───────────────────────────────────┤
│ test/assamese-playback.test.js    │ Line 55                           │ assert.equal(playlist.length, 1365)│
│ test/bengali-playback.test.js     │ Line 41                           │ assert.equal(playlist.length, 1365)│
│ test/bhojpuri-playback.test.js    │ Line 42                           │ assert.equal(playlist.length, 1365)│
│ test/english-playback.test.js     │ Lines 44 & 55                     │ playlist.length: 1365, allIds: 1363│
│ test/gujarati-playback.test.js    │ Lines 44 & 55                     │ playlist.length: 1365, allIds: 1363│
│ test/kannada-playback.test.js     │ Lines 18 & 53                     │ playlist.length: 1365, allIds: 1363│
│ test/marathi-playback.test.js     │ Line 42                           │ assert.equal(playlist.length, 1365)│
│ test/odia-playback.test.js        │ Line 42                           │ assert.equal(playlist.length, 1365)│
│ test/punjabi-playback.test.js     │ Line 42                           │ assert.equal(playlist.length, 1365)│
│ test/rajasthani-playback.test.js  │ Lines 44 & 55                     │ playlist.length: 1365, allIds: 1363│
└───────────────────────────────────┴───────────────────────────────────┴───────────────────────────────────┘
```

### C. Playback Testing Distinction & Evidence Reference
> [!IMPORTANT]
> **Node.js unit tests do NOT execute live YouTube player rendering.**
> Unit tests prove schema validity, non-collision, ordering, and state routing. Real embedded playback eligibility was empirically established during **Phase 3A** via automated Chromium test harness (`test_player.html`), documenting 100/100 tracks transitioning to State 1 `PLAYING` without Error 101/150 restrictions (`docs/mizo/mizo-youtube-playback-test-report.md`).

### D. Post-Implementation Validation Commands
Execution of the following command sequence validates the implementation:
```bash
# 1. Validate the dedicated Mizo test suite
node --test test/mizo-playback.test.js

# 2. Validate all 11 playback test suites simultaneously
node --test test/*-playback.test.js

# 3. Validate git diff stat (confirm only expected files were modified)
git diff --stat
```

---

## 6. Licensing, Attribution & Provenance Disclosures

1. **Distinction Between Technical Playback and Commercial Licensing:**
   - Phase 3A verification proves technical playback capability within YouTube's embedded iframe player.
   - It does **not** assert commercial licensing clearance, synchronization rights, or public performance indemnity.
2. **Third-Party, Archival & Community Preservation Uploads (11 Tracks):**
   - Eleven tracks (#19, #22, #54, #61, #63, #64, #66, #68, #74, #76, #81) utilize non-official, third-party preservation or community aggregator uploads:
     - **#19 — Mampui (Lungrunpui)** (`R5bHpA7yTZs`): Memorial tribute channel upload for the late artist (*Gnat: Tribute to the Legend*).
     - **#22 — Lunglen** (`sgwt3Nb7_9M`): Personal upload by music video director/videographer (*Tawia Pachuau*).
     - **#54 — Lam Dun Ila** (`gOzNLBP-pzY`): Regional music aggregator channel upload (*Zo Siam*).
     - **#61 — Thinlung Khawngaihthlak** (`RYMefTCUjww`): Regional music aggregator lyric video upload (*Zo Siam*).
     - **#63 — Engtinnge Ni Dawn?** (`ZKbjcC-WD5k`): Regional music aggregator channel upload (*Zo Siam*).
     - **#64 — Khuanu Ruatloh Di** (`UXE-jGHqtKw`): Legacy 2000s music video digital archive upload by *dinagrafix*.
     - **#66 — Damlai Par** (`IxWVI21wxC8`): Legacy 2000s music video digital archive upload by *dinagrafix*.
     - **#68 — Aw Ka Ngai Em A Che (Luah Loh Di Hmeltha)** (`MBmf8mWfvz8`): Heritage analog cassette tape digitization upload by *Marcus Zaua*.
     - **#74 — In Tan** (`owKHIPScOz8`): Regional music portal and media channel upload (*Sakeibaknei*).
     - **#76 — Kan Zotlang Ram Nuam** (`WUGTXPeXLpI`): Community cultural heritage upload of Pu Rokunga's anthem by *Mizo Zotui Thiang*.
     - **#81 — Runmawi** (`8enjgPkJFdM`): Community gospel archivist upload (*Zopa Thul*) of the 2003 *Ka Hmangaih Em Che* cassette recording.
   - CBG interacts with these videos strictly through standard YouTube IFrame API embeds in full compliance with YouTube Terms of Service.
3. **No Unsupported Licensing Metadata:**
   - No unsupported copyright flags, fake ISRC codes, or speculative licensing fields are injected into `playlist.js` or application state.

---

## 7. Implementation Scope, Risks & Rollback Approach

### A. Exact File Modification Summary
```
┌───────────────────────────────────┬───────────────┬───────────────────────────────────────────────────────┐
│ File Path                         │ Action        │ Justification                                         │
├───────────────────────────────────┼───────────────┼───────────────────────────────────────────────────────┤
│ playlist.js                       │ Edit (Append) │ Register 100 approved Mizo tracks (indices 1265–1364).│
│ index.html                        │ Edit (1 line) │ Expose "Mizo" option in #languageFilters selector.    │
│ script.js                         │ Edit (1 line) │ Register "mizo" in availableLanguages Set.            │
│ test/mizo-playback.test.js        │ New File      │ Establish 4-test regression & catalog lock suite.     │
│ test/*-playback.test.js (10 files)│ Edit (Lines)  │ Update total catalog count assertion (1265 -> 1365).  │
└───────────────────────────────────┴───────────────┴───────────────────────────────────────────────────────┘
```

### B. Risks & Mitigations
1. **Risk: Unintended modification of existing playlist tracks**
   - *Mitigation:* `test/mizo-playback.test.js` enforces SHA-256 hash checks on all 14 pre-existing languages. Any accidental edit to earlier tracks fails tests immediately.
2. **Risk: User preference corruption**
   - *Mitigation:* `script.js` uses `availableLanguages.has(saved.selectedLanguage) ? saved.selectedLanguage : "all"`. Stored preferences remain 100% backward compatible.
3. **Risk: Mobile dropdown UI overflow**
   - *Mitigation:* Standard `<select>` elements render native OS picker sheets on iOS/Android, capable of handling 50+ options without page layout reflow.

### C. Rollback Procedure
If any anomaly occurs post-implementation:
```bash
# Instant rollback to commit 68b0256 baseline
git checkout 68b0256 -- playlist.js index.html script.js test/
rm -f test/mizo-playback.test.js
```
This completely and instantaneously restores the exact 14-language, 1,265-track baseline with zero persistent side effects.

---

## 8. Decisions for User Review Prior to Implementation

Please review and confirm the following three architectural decisions before code implementation begins:

1. **Composer Attribution in Artist Credit String:**
   - In the approved catalog, songwriter/composers are credited alongside performers (e.g. `Guru Gee (Phuahtu: Guru Gee)`, `David Darlong (Phuahtu: R. Lalhmangaiha)`).
   - *Recommendation:* Retain the full credit string in `playlist.js`. This preserves cultural authenticity and matches user-facing expectations in Mizo music culture.
2. **Release Context in `film` Attribute:**
   - Non-film regional tracks use descriptive context tags (e.g. `"Single"`, `"Vangpui Lunglen S4"`, `"Run Nuam Album"`, `"Bul I Tan Nan EP"`).
   - *Recommendation:* Retain these descriptive contexts, matching the conventions established in English and Rajasthani playlists.
3. **Representation of Unverified Release Years (7 Tracks):**
   - Tracks #67, #68, #69, #75, #76, #77, #82 have approximate/decade-only chronologies in research (`1980s comp.`, `1950s comp.`, `2000s comp.`, `2010s`).
   - *Recommendation:* Use `year: ""` and `decade: ""` to strictly avoid inventing release dates, identical to traditional tracks in Rajasthani (`"Mor Bole Re"`, `"Mumal"`). Alternatively, `decade` can store `"80s"`/`"50s"` while `year` remains `""`.
4. **Coordinated Total Count Assertion Updates:**
   - Update the 10 existing playback test files from `1265` to `1365` (and `1263` to `1363`) concurrently with the Mizo addition.
   - *Recommendation:* Apply these coordinated updates in Phase 3B so that `npm test` runs 100% green across all language suites.

---

*Report generated for Chai Baarish Gaane Phase 3B review. Awaiting explicit user approval before proceeding to implementation.*