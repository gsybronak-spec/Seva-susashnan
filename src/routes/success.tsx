import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SuccessView } from "@/components/pages/success-view";

const searchSchema = z.object({ reg: z.string().optional() });

export const Route = createFileRoute("/success")({
  validateSearch: (s) => searchSchema.parse(s),
  component: () => {
    const { reg } = Route.useSearch();
    return <SuccessView reg={reg ?? ""} />;
  },
});
