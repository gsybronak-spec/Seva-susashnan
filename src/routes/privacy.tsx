import { createFileRoute } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/privacy")({ component: Page });

function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-primary">Privacy Policy</h1>
      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
        <p>
          {BRAND.name} respects the privacy of every participant. Information
          collected through this registration portal is used solely for the purpose of
          organising and administering the Yog ane Dhyan Shibir.
        </p>
        <p>
          We collect your name, mobile number, location details (district/taluka as
          configured for each event), designation and any custom fields enabled by the
          organisers. This data is stored securely and is not shared with any third party
          for marketing purposes.
        </p>
        <p>
          You may contact us to request correction or removal of your information.
        </p>
      </div>
    </div>
  );
}
