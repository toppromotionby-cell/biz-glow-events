import zlib from "node:zlib";
import { buildPresentationPdf } from "@/lib/presentations/pdf.server";
import { blankSlide } from "@/lib/presentations/model";
const p: any = { id:"1", title:"Test", company_id:null, quote_id:null, status:"draft", template:"dark", logo_url:null, client_logo_url:null, logo_layout:"auto", font_family:"inherit", public_token:"t", share_enabled:false, created_at:"", updated_at:"" };
const base = blankSlide("text",0);
const s: any = { ...base, content: { ...base.content, background: { mode:"gradient", stops:["#102030","#405060"], angle:135 } }, resolved_image_url:null, resolved_images:[] };
const bytes = await buildPresentationPdf(p, [s], null, null, null);
const buf = Buffer.from(bytes);
let out = "";
const marker = Buffer.from("stream");
let i = 0;
while (true) {
  const at = buf.indexOf(marker, i); if (at < 0) break;
  let st = at + 6; if (buf[st] === 13) st++; if (buf[st] === 10) st++;
  const end = buf.indexOf(Buffer.from("endstream"), st); if (end < 0) break;
  try { out += zlib.inflateSync(buf.subarray(st, end)).toString("latin1") + "\n"; } catch {}
  i = end + 9;
}
const ops = out.match(/[\d.]+ [\d.]+ [\d.]+ rg/g) ?? [];
console.log("ops", ops.length, ops[0], ops[ops.length-1]);
