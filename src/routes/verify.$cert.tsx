import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Award, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyCertificate } from "@/lib/certificate.functions";

const VERIFY_CERTIFICATE_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export const Route = createFileRoute("/verify/$cert")({
  head: () => ({
    meta: [
      { title: "Verify Certificate — Gujarat State Yog Board" },
      { name: "description", content: "Verify the authenticity of a event participation certificate." },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { cert } = Route.useParams();
  const verify = useServerFn(verifyCertificate);
  const { data, isLoading, error } = useQuery({
    queryKey: ["verify-cert", cert],
    queryFn: () =>
      withTimeout(
        verify({ data: { certificate_number: cert } }),
        VERIFY_CERTIFICATE_TIMEOUT_MS,
        "Certificate verification took too long. Please try again.",
      ),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">Verifying…</div>;
  }

  if (!data?.ok) {
    const message = error instanceof Error ? error.message : undefined;
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-destructive">Certificate Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {message || <>The certificate number <span className="font-mono">{cert}</span> could not be verified.</>}
        </p>
        <Button asChild variant="outline" className="mt-6"><Link to="/">Back to Home</Link></Button>
      </div>
    );
  }

  const ok = data.valid;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="brand-bar h-1 w-full" />
        <div className="p-6 sm:p-8">
          <div className="text-center">
            <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${ok ? "bg-brand-success/10 text-brand-success" : "bg-destructive/10 text-destructive"}`}>
              {ok ? <ShieldCheck className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
            </div>
            <h1 className="text-2xl font-bold text-brand-primary">
              {ok ? "Certificate Verified" : `Status: ${data.status}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ok ? "This certificate is authentic and issued by the Gujarat State Yog Board." : "This certificate is not currently valid."}
            </p>
          </div>

          <dl className="mt-6 space-y-2 rounded-lg border border-border bg-background p-4 text-sm">
            <Row label="Participant" value={data.participant_name} />
            <Row label="Registration No." value={data.registration_number} mono />
            <Row label="Certificate No." value={data.certificate_number} mono />
            <Row label="Event" value={data.event_title || "—"} />
            <Row label="Issued On" value={data.issued_at ? new Date(data.issued_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"} />
            <Row label="Status" value={data.status.toUpperCase()} />
          </dl>

          {data.verification_text && (
            <p className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
              <Award className="mr-1 inline h-3.5 w-3.5" />
              {data.verification_text}
            </p>
          )}

          <Button asChild variant="outline" className="mt-6 w-full">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium ${mono ? "font-mono text-brand-primary" : ""}`}>{value}</dd>
    </div>
  );
}
