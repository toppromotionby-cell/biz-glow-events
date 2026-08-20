import { buildPresentationPdf } from "@/lib/presentations/pdf.server";
import { blankSlide } from "@/lib/presentations/model";
const p: any = { id:"1", title:"Test", company_id:null, quote_id:null, status:"draft", template:"dark", logo_url:null, client_logo_url:null, logo_layout:"auto", font_family:"inherit", public_token:"t", share_enabled:false, created_at:"", updated_at:"" };
const s: any = { ...blankSlide("text",0), content: { ...blankSlide("text",0).content, background: { mode:"gradient", stops:["#102030","#405060"], angle:135 } }, resolved_image_url:null, resolved_images:[] };
const bytes = await buildPresentationPdf(p, [s], null, null, null);
const txt = Buffer.from(bytes).toString("latin1");
console.log(bytes.length, txt.slice(0, 400).replace(/\n/g," ").slice(0,300));
const m = txt.match(/[\d.]+ [\d.]+ [\d.]+ rg/g);
console.log("rg ops:", m ? m.length : 0, m?.slice(0,3), m?.slice(-3));
