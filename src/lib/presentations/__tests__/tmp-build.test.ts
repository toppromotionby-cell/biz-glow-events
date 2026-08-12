import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { loadPresentationBundle, buildBundlePdf } from "@/lib/presentations/render.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

it("build real presentation pdf", { timeout: 120000 }, async () => {
  const { data } = await supabaseAdmin.from("presentations").select("id").limit(1);
  const id = (data as { id: string }[])[0].id;
  const b = await loadPresentationBundle({ id });
  const bytes = await buildBundlePdf(b!);
  writeFileSync("/tmp/pdfqa/out.pdf", bytes);
});
