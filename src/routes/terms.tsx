import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/terms")({ component: Page });

function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-primary">Terms</h1>
      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
        <p>
          By registering for the Yog ane Dhyan Shibir organised by {BRAND.name},
          you agree to participate in good faith and follow the schedule and instructions
          shared by the organisers.
        </p>
        <p>
          Registration is open to eligible participants of the districts announced for
          each event. Certificates will be issued after successful completion of the
          event, subject to the certificate settings chosen by the organisers.
        </p>
        <p>
          {BRAND.name} reserves the right to modify the schedule, content or
          eligibility as required.
        </p>
      </div>
    </div>
  );
}
