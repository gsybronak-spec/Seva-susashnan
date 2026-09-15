import { createFileRoute } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/contact")({ component: Page });

function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-primary">Contact</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {BRAND.name}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card icon={MapPin} title="Department">
          {BRAND.departmentLine}, Government of Gujarat
        </Card>
        <Card icon={Mail} title="Official Enquiries">
          Contact information and official helpline will be published by Gujarat State Yog Board. For event queries, please refer to your event registration pass or contact your local shibir coordinator.
        </Card>
      </div>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-brand-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
