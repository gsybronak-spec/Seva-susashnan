/**
 * Helper to match events against admin search queries.
 * Supports:
 * - District name (English and Gujarati)
 * - Event name / title (Gujarati and English)
 * - Event slug
 * - Level / type (District / Municipal / State)
 * - Venue / Address
 *
 * Case-insensitive, whitespace-trimmed matching.
 */
export function matchesAdminEventSearch(
  item: {
    title?: string | null;
    district?: string | null;
    district_name?: string | null;
    slug?: string | null;
    level?: string | null;
    venue?: string | null;
    coverage_type?: string | null;
    coverage_district_names?: string[] | null;
  },
  searchQuery: string,
): boolean {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return true;

  // 1. Direct field checks
  if (item.title && item.title.toLowerCase().includes(q)) return true;
  if (item.district && item.district.toLowerCase().includes(q)) return true;
  if (item.district_name && item.district_name.toLowerCase().includes(q)) return true;
  if (item.slug && item.slug.toLowerCase().includes(q)) return true;
  if (item.venue && item.venue.toLowerCase().includes(q)) return true;

  // 2. Level / Type checks
  const level = (item.level || "").toLowerCase();
  if (level && level.includes(q)) return true;

  if (item.coverage_type && item.coverage_type.toLowerCase().includes(q)) return true;

  // 3. Multi-district coverage check
  if (
    item.coverage_district_names &&
    item.coverage_district_names.some((d) => d && d.toLowerCase().includes(q))
  ) {
    return true;
  }

  // 4. Synonym checks:
  // "municipal" <-> "મહાનગરપાલિકા" / "મનપા"
  const isMunicipal =
    level === "municipal" ||
    (item.title ? item.title.includes("મહાનગરપાલિકા") : false);
  if (
    isMunicipal &&
    ("municipal".includes(q) ||
      "મહાનગરપાલિકા".includes(q) ||
      "મનપા".includes(q))
  ) {
    return true;
  }

  // "district" <-> "જિલ્લા" / "જિલ્લો"
  const isDistrict =
    level === "district" ||
    (item.title
      ? item.title.includes("જિલ્લા") || item.title.includes("જિલ્લો")
      : false);
  if (
    isDistrict &&
    ("district".includes(q) ||
      "જિલ્લા".includes(q) ||
      "જિલ્લો".includes(q))
  ) {
    return true;
  }

  return false;
}
