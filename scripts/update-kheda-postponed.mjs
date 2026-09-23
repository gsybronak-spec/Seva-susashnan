import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envContent = readFileSync(".env", "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const idx = t.indexOf("=");
  if (idx > 0) env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
}
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function updateKheda() {
  console.log("Fetching existing Kheda event row...");
  const { data: event, error: fetchErr } = await supabase
    .from("events")
    .select("*")
    .eq("slug", "kheda-yog-shibir")
    .single();

  if (fetchErr || !event) {
    console.error("Failed to fetch Kheda event:", fetchErr);
    process.exit(1);
  }

  console.log("Current Kheda event_date:", event.event_date);
  console.log("Current Kheda general.event_date:", event.general?.event_date);

  const updatedGeneral = {
    ...event.general,
    event_date: null,
    event_time: null,
    start_time: null,
    end_time: null,
  };

  const { data: updated, error: updateErr } = await supabase
    .from("events")
    .update({
      event_date: null,
      event_time: null,
      general: updatedGeneral,
      updated_at: new Date().toISOString(),
    })
    .eq("id", event.id)
    .select("id, slug, event_date, event_time, general, lifecycle_status, is_active, publish_status, features")
    .single();

  if (updateErr) {
    console.error("Failed to update Kheda event:", updateErr);
    process.exit(1);
  }

  console.log("Successfully updated Kheda event!");
  console.log("New event_date:", updated.event_date);
  console.log("New event_time:", updated.event_time);
  console.log("New general.event_date:", updated.general.event_date);
  console.log("New general.start_time:", updated.general.start_time);
  console.log("New general.end_time:", updated.general.end_time);
  console.log("Lifecycle status:", updated.lifecycle_status);
  console.log("Is active:", updated.is_active);
  console.log("Publish status:", updated.publish_status);
  console.log("Registration enabled:", updated.features?.registration);
}

updateKheda().catch(console.error);
