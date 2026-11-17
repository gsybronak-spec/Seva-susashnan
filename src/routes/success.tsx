import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { SuccessView } from "@/components/pages/success-view";
import { isYogSnehMilanCampaign } from "@/lib/campaign-branding";

const searchSchema = z.object({
  reg: z.string().optional(),
  key: z.string().optional(),
  access: z.string().optional(),
  auto: z.string().optional(),
  ref: z.string().optional(),
});

export const Route = createFileRoute("/success")({
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: ({ search }) => {
    const isSnehMilan = isYogSnehMilanCampaign({
      registrationNumber: search.reg || search.ref,
    });

    if (isSnehMilan) {
      if (search.ref && !search.reg) {
        throw redirect({
          to: "/campaigns/$slug/register",
          params: { slug: "snehmilan" },
          search: { ref: search.ref },
        });
      }
      if (search.reg && !search.key && !search.access) {
        throw redirect({
          to: "/campaigns/$slug/register",
          params: { slug: "snehmilan" },
          search: { ref: search.reg },
        });
      }
    }
  },
  component: () => {
    const { reg, key, access, auto } = Route.useSearch();
    return (
      <SuccessView
        reg={reg ?? ""}
        cardAccess={key || access}
        autoDownload={auto === "1"}
      />
    );
  },
});
