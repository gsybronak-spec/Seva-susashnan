import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home } from "lucide-react";
import { BrandEmblem } from "./site-header";
import { getCampaignBySlug } from "@/lib/campaign.functions";
import { useCurrentEvent } from "@/hooks/use-current-event";
import { useEventConfig } from "@/hooks/use-event-config";

export type RegistrationProgramHeaderProps = {
  campaignName?: string;
  slogan?: string;
  programTitle?: string;
  bannerUrl?: string;
};

/**
 * Top Program Header for Public Registration & Success pages.
 *
 * Scoped dynamically:
 * - When under a campaign (e.g. /campaigns/snehmilan/register), displays the
 *   campaign's actual name ("Yog Sneh Milan - 2026") and slogan.
 * - "Home" and emblem clicks strictly route to the campaign's main URL, never
 *   redirecting out to the root portal.
 * - Legacy Seva Sushasan / Seva Sankalp district events maintain their official 5-line hierarchy.
 */
export function RegistrationProgramHeader(props: RegistrationProgramHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const campaignMatch = pathname ? pathname.match(/^\/campaigns\/([^/]+)/) : null;
  const campaignSlug = campaignMatch && campaignMatch[1] !== "index" ? campaignMatch[1] : null;

  const loadCampaign = useServerFn(getCampaignBySlug);
  const { data: cData } = useQuery({
    queryKey: ["campaign", campaignSlug],
    queryFn: () => loadCampaign({ data: { slug: campaignSlug! } }),
    enabled: Boolean(campaignSlug),
    staleTime: 60_000,
  });

  const eventSlug = useCurrentEvent();
  const { config } = useEventConfig(!campaignSlug ? eventSlug : null);

  const campaign = cData?.ok ? cData.campaign : null;

  const homeTarget = campaignSlug ? `/campaigns/${campaignSlug}` : eventSlug ? `/${eventSlug}` : "/";

  // Dynamic branding text resolution
  const resolvedCampaignName =
    props.campaignName ||
    campaign?.name ||
    (eventSlug && !config.general?.title?.toLowerCase().includes("sneh") ? "સેવા સંકલ્પ અભિયાન" : null) ||
    config.general?.title ||
    "ગુજરાત રાજ્ય યોગ બોર્ડ";

  const resolvedSlogan =
    props.slogan ||
    campaign?.slogan ||
    (resolvedCampaignName.includes("સેવા સંકલ્પ")
      ? "સુશાસનના ૨૫ વર્ષની ઉજવણીના ભાગરૂપે"
      : "");

  const resolvedProgramTitle =
    props.programTitle ||
    config.general?.title ||
    (campaign ? campaign.name : "યોગ અને ધ્યાન શિબિર");

  const bannerImg = props.bannerUrl || campaign?.banner_url;

  return (
    <header className="w-full bg-[#FAF8F5] border-b border-[#E8E0D5] select-none">
      {/* Subtle Top Indian Tricolor Accent Line */}
      <div className="h-1 sm:h-1.5 w-full flex" aria-hidden="true">
        <div className="w-1/3 bg-[#FF9933]" />
        <div className="w-1/3 bg-white" />
        <div className="w-1/3 bg-[#138808]" />
      </div>

      {/* Optional Campaign Top Banner */}
      {bannerImg && (
        <div className="w-full bg-black/5 border-b border-[#E8E0D5]">
          <div className="mx-auto max-w-4xl px-3 py-2 sm:py-3">
            <Link to={homeTarget} className="block">
              <img
                src={bannerImg}
                alt={resolvedCampaignName}
                className="w-full max-h-48 sm:max-h-64 object-cover rounded-lg sm:rounded-xl shadow-xs mx-auto"
              />
            </Link>
          </div>
        </div>
      )}

      {/* Official Government Program Announcement Block */}
      <div className="relative mx-auto max-w-3xl px-3.5 py-3.5 sm:py-5 text-center">
        {/* Context-scoped Home Button */}
        <div className="absolute left-3.5 top-3.5 sm:left-6 sm:top-5">
          <Link
            to={homeTarget}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[#0F3E3E] hover:bg-[#E8E0D5]/50 transition"
            title="મુખ્ય પૃષ્ઠ / Home"
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </div>

        {/* Official GSYB Emblem - Linked to Campaign Home */}
        <div className="flex justify-center mb-2 sm:mb-2.5">
          <Link to={homeTarget} className="inline-block transition hover:opacity-90" title="મુખ્ય પૃષ્ઠ / Home">
            <BrandEmblem className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 drop-shadow-xs" />
          </Link>
        </div>

        {/* 5-Line Gujarati Typography Hierarchy */}
        <div className="space-y-1 sm:space-y-1.5 font-gujarati">
          {/* Line 1: Official Authority */}
          <div className="text-[13px] sm:text-[15px] md:text-[16px] font-semibold text-[#0F3E3E] tracking-normal leading-snug">
            ગુજરાત રાજ્ય યોગ બોર્ડ દ્વારા
          </div>

          {/* Line 2: Supporting Sub-headline */}
          {resolvedSlogan && (
            <div className="text-[11.5px] sm:text-[13px] md:text-[14px] font-medium text-[#4B5563] leading-snug">
              {resolvedSlogan}
            </div>
          )}

          {/* Line 3: Campaign Title (Warm Orange/Saffron Highlight) */}
          <div className="text-[17px] sm:text-[20px] md:text-[22px] font-bold text-[#EA580C] tracking-wide leading-snug">
            “{resolvedCampaignName}”
          </div>

          {/* Line 4: Small Connective Text */}
          <div className="text-[11px] sm:text-[12px] md:text-[12.5px] font-normal text-[#6B7280] leading-snug">
            અંતર્ગત
          </div>

          {/* Line 5: Main Program Title (Largest Heading, Dark Teal) */}
          <h1 className="text-[23px] sm:text-[30px] md:text-[36px] font-extrabold text-[#0F3E3E] tracking-tight leading-tight pt-0.5">
            {resolvedProgramTitle}
          </h1>
        </div>
      </div>
    </header>
  );
}

// Alias for existing imports
export { RegistrationProgramHeader as RegistrationHeader };
