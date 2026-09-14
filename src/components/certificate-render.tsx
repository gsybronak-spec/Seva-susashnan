import { forwardRef } from "react";
import type {
  CertificateElement,
  CertificateTemplate,
  EventCertificate,
  EventGeneral,
} from "@/lib/event-config";

export type CertificateRenderData = {
  participant_name: string;
  registration_number: string;
  certificate_number: string;
  issued_at: string | null;
  general: EventGeneral;
  certificate: EventCertificate;
  template: CertificateTemplate;
  verifyUrl: string;
};

function formatDate(dateISO: string | null): string {
  if (!dateISO) return "";
  const d = new Date(dateISO.length <= 10 ? dateISO + "T00:00:00" : dateISO);
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// Strict template-driven renderer.
//
// The uploaded template background is the ONLY visual source of truth.
// We NEVER draw QR codes, signatures, logos, headers, footers, watermarks,
// or any decoration that isn't an admin-defined text placeholder.
//
// Only text-type placeholder elements the admin has explicitly enabled in
// the certificate designer are drawn over the background. All image-type
// element kinds (qr_code, signature) are skipped by design.
const TEXT_ELEMENT_TYPES: ReadonlySet<CertificateElement["type"]> = new Set([
  "participant_name",
  "registration_number",
  "certificate_number",
  "event_title",
  "event_theme",
  "event_date",
  "issue_date",
  "organization_name",
  "custom_text",
]);

function valueFor(el: CertificateElement, data: CertificateRenderData): string {
  switch (el.type) {
    case "participant_name": return data.participant_name;
    case "registration_number": return data.registration_number;
    case "certificate_number": return data.certificate_number;
    case "event_title": return data.general.title;
    case "event_theme": return data.general.theme;
    case "event_date": return formatDate(data.general.event_date);
    case "issue_date": return formatDate(data.issued_at ?? new Date().toISOString());
    case "organization_name": return data.certificate.organization_name;
    case "custom_text": return el.text ?? "";
    default: return "";
  }
}

export const CertificateRender = forwardRef<HTMLDivElement, { data: CertificateRenderData }>(
  function CertificateRender({ data }, ref) {
    const { template } = data;

    return (
      <div
        ref={ref}
        style={{
          position: "relative",
          width: template.canvas_width,
          height: template.canvas_height,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        {template.background_url && (
          <img
            src={template.background_url}
            alt=""
            crossOrigin="anonymous"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {template.elements
          .filter((e) => e.enabled && TEXT_ELEMENT_TYPES.has(e.type))
          .map((el) => {
            const value = valueFor(el, data);
            if (!value) return null;
            const widthPx = (el.width / 100) * template.canvas_width;
            const style: React.CSSProperties = {
              position: "absolute",
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: widthPx,
              transform: `translate(-50%, -50%) rotate(${el.rotation}deg)`,
              opacity: el.opacity,
              textAlign: el.align,
              fontFamily: el.font_family,
              fontWeight: el.font_weight,
              fontSize: el.font_size,
              color: el.color,
              letterSpacing: `${el.letter_spacing}px`,
              lineHeight: el.line_height,
            };
            return (
              <div key={el.key} style={style}>
                {value}
              </div>
            );
          })}
      </div>
    );
  },
);
