/**
 * Authoritative campaign branding constants and utilities for Gujarat State Yog Board.
 * Ensures consistent multi-page branding across campaign portals, registration flows,
 * digital ID cards, and linked online events.
 */

export const YOG_SNEH_MILAN_BRANDING = {
  line1: "ગુજરાત રાજ્ય યોગ બોર્ડ દ્વારા",
  line2: "નૂતનવર્ષ અભિનંદન",
  line3: "યોગ સ્નેહમિલન કાર્યક્રમ",
  campaignSlug: "snehmilan",
  campaignId: "2df8033b-5f6f-47f3-9411-9781f1d9469c",
} as const;

export function isYogSnehMilanCampaign(params: {
  pathname?: string | null;
  campaignSlug?: string | null;
  campaignName?: string | null;
  campaignId?: string | null;
  eventSlug?: string | null;
  eventTitle?: string | null;
}): boolean {
  const p = (params.pathname || "").toLowerCase();
  const cs = (params.campaignSlug || "").toLowerCase();
  const cn = (params.campaignName || "").toLowerCase();
  const cid = params.campaignId || "";
  const es = (params.eventSlug || "").toLowerCase();
  const et = (params.eventTitle || "").toLowerCase();

  return (
    p.includes("snehmilan") ||
    p.includes("sneh-milan") ||
    cs === "snehmilan" ||
    cs.includes("sneh") ||
    cn.includes("sneh") ||
    cn.includes("સ્નેહ") ||
    cid === YOG_SNEH_MILAN_BRANDING.campaignId ||
    es.includes("snehmilan") ||
    es.includes("sneh-milan") ||
    et.includes("sneh") ||
    et.includes("સ્નેહ")
  );
}
