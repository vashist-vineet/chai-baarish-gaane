/*
 * Development-only record of curated Malayalam candidates that are not part
 * of the runtime playlist. This module is imported by tests only.
 */
export const MALAYALAM_EXCLUDED_TRACKS = Object.freeze([
  { candidate: 1, title: "Alliyambal Kadavil", film: "Rosy", status: "embed-failed", lastKnownYoutubeId: "EmRRUAgOJr4", auditReason: "The exact Saregama upload returned YouTube IFrame API error 150." },
  { candidate: 13, title: "Azhake", film: "Amaram", status: "unresolved", auditReason: "The candidate title is ambiguous; an exact official upload for the intended original recording was not verified." },
  { candidate: 18, title: "Oru Raathri Koodi", film: "Summer in Bethlehem", status: "unresolved", auditReason: "No exact embeddable upload was verified during this pass." },
  { candidate: 26, title: "Annakkili", film: "4 the People", status: "rejected", auditReason: "Omitted for balance because Lajjavathiye already represents the film and its energetic style." },
  { candidate: 30, title: "Junile Nilamazhayil", film: "Nammal Thammil", status: "rejected", auditReason: "The supplied film was Nammal; the correct film is Nammal Thammil (2009). Omitted from runtime after correcting the identity." },
  { candidate: 32, title: "Kaathirunna Pennalle", film: "Classmates", status: "rejected", auditReason: "The supplied title was Kathiripoo Kanmani. Omitted to avoid over-representing Classmates." },
  { candidate: 43, title: "Onnam Kili Ponnankili", film: "Kilichundan Mampazham", status: "rejected", auditReason: "Omitted to avoid over-representing the same film." },
  { candidate: 45, title: "Ente Khalbile", film: "Classmates", status: "duplicate", auditReason: "Exact repetition of candidate 31; retained only once in runtime." },
  { candidate: 46, title: "Anuragathin Velayil", film: "Thattathin Marayathu", status: "unresolved", auditReason: "No exact embeddable official upload was verified during this pass." },
  { candidate: 51, title: "Mounam Chorum Neram", film: "Ohm Shanthi Oshaana", status: "embed-failed", lastKnownYoutubeId: "irNwh0r4imA", auditReason: "The official video and alternate official lyric upload both returned YouTube IFrame API error 150." },
  { candidate: 52, title: "Kattu Mooliyo", film: "Ohm Shanthi Oshaana", status: "embed-failed", lastKnownYoutubeId: "Qs2ta9_CaKM", auditReason: "The official video returned YouTube IFrame API error 150." },
  { candidate: 56, title: "Chinna Chinna", film: "Premam", status: "rejected", auditReason: "Omitted to keep the three-track Premam cluster from growing further." },
  { candidate: 64, title: "Pularikalo", film: "Charlie", status: "unresolved", auditReason: "No exact embeddable upload was verified during this pass." },
  { candidate: 65, title: "Oru Kari Mukilinu", film: "Charlie", status: "unresolved", auditReason: "No exact embeddable upload was verified during this pass." },
  { candidate: 79, title: "Nee Himamazhayayi", film: "Edakkad Battalion 06", status: "embed-failed", lastKnownYoutubeId: "mqOkSK8bEBM", auditReason: "Both official full-video uploads tested returned YouTube IFrame API error 150." },
  { candidate: 80, title: "Appu", film: "", status: "unresolved", auditReason: "The supplied title has no reliable film or recording identity and was not replaced by guesswork." },
  { candidate: 85, title: "Onakka Munthiri", film: "Hridayam", status: "embed-failed", lastKnownYoutubeId: "N_zXtXla2-c", auditReason: "The official video returned YouTube IFrame API error 150." },
  { candidate: 84, title: "Darshana", film: "Hridayam", status: "embed-failed", lastKnownYoutubeId: "epAFDEJImrU", auditReason: "The official video returned YouTube IFrame API error 150." },
  { candidate: 86, title: "Pottu Thotta Pournami", film: "Hridayam", status: "embed-failed", lastKnownYoutubeId: "ftIPUowtX2Q", auditReason: "The official video returned YouTube IFrame API error 150." },
  { candidate: 87, title: "Nagumo", film: "Hridayam", status: "embed-failed", lastKnownYoutubeId: "xyUxkUPe2xg", auditReason: "The official video returned YouTube IFrame API error 150." },
  { candidate: 88, title: "Mukilinte", film: "Hridayam", status: "embed-failed", lastKnownYoutubeId: "BGCuoeLqb9E", auditReason: "The official video returned YouTube IFrame API error 150." },
  { candidate: 93, title: "Scene Mone", film: "RDX", status: "rejected", auditReason: "Omitted in favor of the more atmospheric Neela Nilave." },
  { candidate: 94, title: "Halaballoo", film: "RDX", status: "rejected", auditReason: "Omitted to keep energetic tracks a smaller part of the catalog." },
  { candidate: 95, title: "Illuminati", film: "Aavesham", status: "embed-failed", lastKnownYoutubeId: "tOM-nWPcR4U", auditReason: "The official video and official distributed audio both returned YouTube IFrame API error 150." },
  { candidate: 96, title: "Armadham", film: "Aavesham", status: "embed-failed", lastKnownYoutubeId: "HkvVaj_28C8", auditReason: "The official video returned YouTube IFrame API error 150." },
  { candidate: 97, title: "Pala Palli", film: "Kaduva", status: "embed-failed", lastKnownYoutubeId: "At-rmGGn7cg", auditReason: "The official video and promo upload both returned YouTube IFrame API error 150." },
  { candidate: 98, title: "Kannil Pettole", film: "Thallumaala", status: "unresolved", auditReason: "No exact embeddable official upload was verified during this pass." },
  { candidate: 99, title: "Ole Melody", film: "Thallumaala", status: "unresolved", auditReason: "No exact embeddable official upload was verified during this pass." },
  { candidate: 100, title: "Kiliye", film: "ARM", status: "embed-failed", lastKnownYoutubeId: "B2UBMTA57JI", auditReason: "Both official Malayalam uploads tested returned YouTube IFrame API error 150." }
]);
