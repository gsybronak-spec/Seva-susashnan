// ============================================================
// BRAND / ORGANIZATION CONFIGURATION — the single source of truth
// for the ORGANIZATION identity of the platform.
//
// Hierarchy:
//   Gujarat State Yog Board            (organization — this file)
//     └── Campaigns                    (e.g. Seva Sushasan Abhiyan)
//           └── Events                 (e.g. Yog ane Dhyan Shibir)
//                 └── Registrations / Attendance / Certificates
//
// Campaign-level branding (title, slogan, colors, logo) lives in the
// campaigns admin — never here. Change values here and the global
// identity (header, footer, metadata, legal pages) follows everywhere.
// ============================================================

export const BRAND = {
  /** Full official organization name (title case). */
  name: "Gujarat State Yog Board",
  /** Name shown in the header — uppercase. */
  nameDisplay: "GUJARAT STATE YOG BOARD",
  /** Official department line under the header title. */
  departmentLine: "Under Sports, Youth and Cultural Activities Department",
  /** Header logo (served from /public). */
  logoPath: "/logo-gsyb.png",
  /** Short name / initials used in codes and labels. */
  shortName: "GSYB",
  /** Participant ID prefix (e.g. GSYB000123). Per-event prefix may override. */
  regPrefix: "GSYB",
  /** Certificate number prefix (e.g. GSYB-2026-000123). */
  certPrefix: "GSYB",
  /** Default certificate-issuing organization name. */
  organizationName: "Gujarat State Yog Board",
  /** Certificate verification footer text. */
  verificationText: "This certificate is verified by Gujarat State Yog Board.",
  /** Geo scope label for state-wide events. */
  regionName: "Gujarat",
  regionWideLabel: "State-wide (Gujarat)",
  allRegionLabel: "All Districts",
  /** Legal/contact defaults (edit freely). */
  contactLine: "Gujarat State Yog Board",
  contactAddress: "Sports, Youth and Cultural Activities Department, Government of Gujarat",
  contactEmail: "contact@gsyb.example.org",
  /** Slug of the default/legacy microsite used by top-level routes.
   *  The seeded default event in the fresh schema uses this slug. */
  defaultMicrositeSlug: "default",
  /** Theme color for browser UI (must match --brand-primary in styles.css). */
  themeColor: "#9F3138",
  /** Author/meta attribution. */
  author: "Gujarat State Yog Board",
} as const;
