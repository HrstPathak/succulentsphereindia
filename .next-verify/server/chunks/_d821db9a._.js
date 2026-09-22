module.exports=[81810,e=>{"use strict";var t=e.i(18830),r=e.i(40721);function n(e,t=200){let r=String(e||"").replace(/\s+/g," ").trim();return r?r.length<=t?r:`${r.slice(0,t)}…`:"(empty response)"}function a(e){return String(e||"").replace(/<think>[\s\S]*?<\/think>/gi,"")}function i(e,t){let r=String(e[t]||"").trim();if(!r)throw Error(`Missing required field: ${t}`);return r}function o(e){let t,o,s,l,c=a(e),u=(s=(o=a(c).trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/,"")).indexOf("{"),l=o.lastIndexOf("}"),-1===s||-1===l||l<=s?null:o.slice(s,l+1));if(!u)throw Error(`AI response did not contain a JSON object. Raw start: ${n(c)}`);try{t=JSON.parse(u)}catch{throw Error(`AI response contained invalid JSON (likely truncated — try a higher BLOG_MAX_NEW_TOKENS or a non-reasoning model). Raw start: ${n(c)}`)}let d=i(t,"title").slice(0,60),p=String(t.excerpt||"").trim().slice(0,160),h=String(t.seoTitle||d).trim().slice(0,60),g=String(t.seoDescription||p).trim().slice(0,160),m=i(t,"primaryKeyword").slice(0,80),f=i(t,"ogTitle").slice(0,70),y=i(t,"ogDescription").slice(0,200),w=i(t,"canonicalPath"),E=(0,r.sanitizeArticleHtml)(String(t.contentHtml||""));if(!E)throw Error("Missing required field: contentHtml");if(/<style[\s>]|<script[\s>]/i.test(E))throw Error("AI output contains a <style> or <script> block — inline styles only.");let v=Array.from(new Set((Array.isArray(t.tags)?t.tags.map(e=>String(e).trim().toLowerCase()):[]).filter(Boolean))).slice(0,5),b=Array.isArray(t.faqs)?t.faqs:null;if(!b||5!==b.length)throw Error(`Missing required field: faqs (expected exactly 5 entries, got ${b?b.length:0})`);return{title:d,excerpt:p,seoTitle:h,seoDescription:g,primaryKeyword:m,contentHtml:E,tags:v,faqs:b.map((e,t)=>{let r=e&&"object"==typeof e?e:{},n=String(r.question||"").trim(),a=String(r.answer||"").trim();if(!n||!a)throw Error(`Missing required field: faqs[${t}] (question and answer are required)`);return{question:n.slice(0,220),answer:a.slice(0,1200)}}),ogTitle:f,ogDescription:y,canonicalPath:w}}function s(){return Number.parseInt(process.env.BLOG_MAX_NEW_TOKENS||"",10)||4e3}let l=/\bAPI (429|500|502|503|504)\b|provider timeout|fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|network/i;function c(){return Number.parseInt(process.env.BLOG_PROVIDER_TIMEOUT_MS||"",10)||12e4}async function u(e,t){let r=process.env.OPENROUTER_MODEL;process.env.OPENROUTER_MODEL=e;try{return await t()}finally{void 0===r?delete process.env.OPENROUTER_MODEL:process.env.OPENROUTER_MODEL=r}}async function d(e){let r=[];if(String(process.env.GEMINI_API_KEY||"").trim()){let n,a,i=(n=Number.parseInt(process.env.GEMINI_MAX_ATTEMPTS||"",10))>=1?n:2,s=(a=Number.parseInt(process.env.GEMINI_RETRY_DELAY_MS||"",10))>=0?a:1e4,u=Array.from(new Set([String(process.env.GEMINI_MODEL||"").trim()||"gemini-flash-latest",String(process.env.GEMINI_MODEL_FALLBACK||"").trim()||"gemini-flash-lite-latest"]));for(let n=0;n<u.length;n++){let a=u[n],d=0===n?i:1;for(let n=1;n<=d;n++)try{let{content:r,provider:n}=await (0,t.chatWithFailover)([{role:"user",content:e}],{temperature:.6,maxNewTokens:Number.parseInt(process.env.GEMINI_BLOG_MAX_NEW_TOKENS||"",10)||8192,timeoutMs:c(),providerOrder:["gemini"]});return{article:o(r),modelUsed:a,provider:n}}catch(i){let e=i instanceof Error?i.message:String(i),t=l.test(e);if(n<d&&t){await new Promise(e=>setTimeout(e,s));continue}u.length,r.push(`gemini(${a}): ${e}`);break}}}let n=Array.from({length:6},(e,t)=>`AUTOMATION_MODEL_${t+1}`).map(e=>String(process.env[e]||"").trim()).filter(Boolean);if(0===n.length){let{content:r,provider:n}=await (0,t.chatWithFailover)([{role:"user",content:e}],{temperature:.6,maxNewTokens:s(),timeoutMs:c(),providerOrder:["openrouter","hf","ollama"]});return{article:o(r),modelUsed:String(process.env.OPENROUTER_MODEL||process.env.HF_MODEL||"").trim()||n,provider:n}}for(let a of n)try{let{content:r,provider:n}=await u(a,()=>(0,t.chatWithFailover)([{role:"user",content:e}],{temperature:.6,maxNewTokens:s(),timeoutMs:c(),providerOrder:["openrouter"]}));return{article:o(r),modelUsed:"openrouter"===n?a:String(process.env.HF_MODEL||process.env.OLLAMA_MODEL||"").trim()||n,provider:n}}catch(t){let e=t instanceof Error?t.message:String(t);r.push(`${a}: ${e}`)}throw Error(`All automation models failed. ${r.join(" | ")}`)}e.s(["generateBlogWithFallback",()=>d],81810)},16242,e=>{"use strict";let t=`
- Homepage: https://succulentsphere.com/
- Shop all plants: https://succulentsphere.com/shop
- Succulents collection: https://succulentsphere.com/collections/succulents
- Cactus collection: https://succulentsphere.com/collections/cactus
- Pots & planters: https://succulentsphere.com/collections/pots
- Beginner-friendly succulents: https://succulentsphere.com/collections/beginner-friendly
- Succulents under Rs. 40: https://succulentsphere.com/collections/succulents-under-40
- Plant care hub (blog): https://succulentsphere.com/plant-care
- Combo builder (pick your own set): https://succulentsphere.com/combo
- Example product pages (use only when the product is genuinely relevant):
  https://succulentsphere.com/products/echeveria-elegans
  https://succulentsphere.com/products/string-of-pearls
  https://succulentsphere.com/products/haworthia-attenuata
`;function r(e,r){return`
You are an experienced Indian plant-care expert and content writer for
Succulent Sphere, a plant-care and succulent brand based in India. You have
genuinely grown succulents for years in Indian home conditions — balconies,
apartments, varying monsoon humidity, hot summers — and you write the way a
real person who loves plants writes: personally, warmly, with real anecdotes,
never like a generic AI-generated article.

═══════════════════════════════════════
STEP 1 — THINK BEFORE WRITING (do this silently, do not output it)
═══════════════════════════════════════
Before producing anything, work through:
1. Search intent: what is someone actually trying to find out when they search
   "${e}"? Are they a beginner panicking about a dying plant, a hobbyist
   optimizing care, someone comparing products, etc.? Write for that real need.
2. Primary keyword: identify the single main keyword/phrase this article should
   rank for (naturally derived from the topic — do not force it into every line).
3. Fact-check yourself: only include plant-care claims you are confident are
   horticulturally accurate for INDIAN growing conditions specifically (climate,
   common local pests, typical potting mixes available in India, monsoon
   humidity, etc.). If genuinely unsure of a specific claim (exact numbers,
   specific product ingredients, medical/chemical claims), phrase it generally
   instead of inventing false specifics.
Only after this thinking, produce the final JSON output below — do not show
your thinking process in the output.

═══════════════════════════════════════
TOPIC: "${e}"
${r?`ADDITIONAL CONTEXT FROM ADMIN: ${r}`:""}
═══════════════════════════════════════

Return ONLY valid JSON, no markdown fences, no preamble, in this exact shape:
{
  "title", "excerpt", "seoTitle", "seoDescription", "primaryKeyword",
  "contentHtml", "tags", "faqs", "ogTitle", "ogDescription", "canonicalPath"
}

═══════════════════════════════════════
AUDIENCE & VOICE
═══════════════════════════════════════
- Written for an INDIAN audience: reference Indian seasons (monsoon, Indian
  summer heat), common Indian home setups (balconies, north/south-facing
  windows, apartment living), and locally available materials (cocopeat,
  neem oil, terracotta pots) where relevant to the topic.
- Sound like a real, experienced plant person sharing genuine experience —
  use first-person anecdotes ("I once had a jade plant that...", "A common
  mistake I see beginners make is..."). Vary sentence length and rhythm the
  way a human naturally writes — do not use uniform, robotic sentence
  structures. Avoid generic AI phrasing like "In conclusion," "It is
  important to note," or "Furthermore" — write the way a knowledgeable
  friend would explain something over chai, not like a textbook.
- Include at least 2 concrete real-life examples or mini-stories, not vague
  generalities. NEVER write something like "Watering frequency depends on
  environmental conditions" — instead write something like "If your succulent
  sits on a west-facing balcony in Mumbai getting harsh afternoon sun, it'll
  dry out in 4-5 days; the same plant in a shaded Bangalore apartment might
  go 10-12 days between waterings."

═══════════════════════════════════════
CRITICAL: contentHtml MUST USE INLINE STYLES ONLY
═══════════════════════════════════════
This HTML is inserted directly into a live shared page (no isolation). Every
styled element needs its own inline "style" attribute.

NON-NEGOTIABLE RULES:
- No <style> tags, no <script> tags, no class or id attributes for styling.
- No "position: fixed" or "position: absolute".
- Repeat identical inline style strings on repeated elements (e.g. every <li>)
  rather than relying on any shared rule.
- Prefer "max-width: 100%", percentage widths, "flex-wrap: wrap" for natural
  mobile responsiveness (no media queries available).
- Root wrapper: single <div style="max-width: 100%;">.
- FAQ accordions: use native <details>/<summary> — this gives click-to-expand
  behavior with ZERO JavaScript. Style them like:
  <details style="border: 1px solid #d7e0d9; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
    <summary style="font-weight: 600; color: #344E41; cursor: pointer; font-size: 17px;">
      Question text?
    </summary>
    <p style="margin-top: 12px; color: #2E2E2E; line-height: 1.6;">Answer text.</p>
  </details>

BRAND PALETTE:
- Primary green: #344E41 | Accent terracotta: #CB997E
- Callout background: #F5F1EA | Body text: #2E2E2E
- Headings: "Georgia, serif" | Body: "Helvetica, Arial, sans-serif"

═══════════════════════════════════════
STRUCTURE & READABILITY (contentHtml must include ALL of these)
═══════════════════════════════════════
1. Intro paragraph (18px, good line-height) that immediately signals this
   article answers the reader's real search intent from Step 1.
2. 3-5 <h2> sections with logical flow (problem → cause → solution → prevention,
   or similar structure suited to the topic), inline-styled per palette.
3. At least ONE simple HTML <table> (inline-styled borders/padding) where the
   topic suits comparison data (e.g. watering schedules by season, soil mix
   ratios, pot size guide) — do not force a table if genuinely not useful.
4. Short "note" callout boxes (inline background #F5F1EA, padding, border-radius,
   left border in #CB997E) for quick tips or warnings scattered through the piece
   — not just one at the end.
5. One "Quick Tips" summary box with a <ul> of 3-5 scannable tips.
6. One blockquote/highlight box (accent-colored border) — can be a personal
   anecdote or a strong actionable statement.
7. Naturally woven internal links: when relevant to the content, link to real
   Succulent Sphere pages using these ACTUAL URLs (do not invent URLs):
${t}
   Use descriptive anchor text (e.g. "shop our terracotta pots" not "click here"),
   inline-styled as <a href="..." style="color: #CB997E; text-decoration: underline;">.
   If genuinely relevant, you may also reference one credible external source
   (e.g. a university extension horticulture page) as plain text mention,
   without fabricating a URL you're not certain exists.
8. Exactly 5 FAQ entries in the "faqs" array AND rendered as <details>/<summary>
   dropdowns near the end of contentHtml — real questions someone would type
   into Google about this exact topic, with concise, useful answers (2-4
   sentences each).
9. Vary the specific visual layout and section order between different posts —
   do not reuse an identical template call after call.

═══════════════════════════════════════
SEO REQUIREMENTS (this is the highest priority — check every box)
═══════════════════════════════════════
☐ One clear, singular search intent addressed (from Step 1 thinking)
☐ One primary keyword/topic, used naturally 3-5 times across the piece
   (title, one H2, intro, one body paragraph) — NEVER keyword-stuff
☐ title: strong, compelling, under 60 characters, includes primary keyword
☐ Useful, hook-y introduction that doesn't waste the reader's time
☐ Logical H2/H3 structure (no skipped levels, no walls of text)
☐ Related/semantic terms included naturally (not just the exact keyword
   repeated — use natural variations)
☐ Original, genuinely useful information — not generic filler
☐ Descriptive alt-text guidance: if contentHtml references an image via <img>,
   include a specific, descriptive "alt" attribute (not "image" or "plant photo")
☐ Internal links included naturally (see list above)
☐ FAQ section included (exactly 5, see above)
☐ seoTitle: under 60 characters
☐ seoDescription: under 155 characters, compelling, includes primary keyword
☐ ogTitle / ogDescription: can mirror seoTitle/seoDescription or be slightly
   more social-friendly/clickable
☐ canonicalPath: suggest a clean URL path like "/plant-care/your-slug-here"
   based on the title (lowercase, hyphenated, no stop words)
☐ No keyword stuffing anywhere
☐ No unnecessary filler sentences — every paragraph should earn its place
☐ tags: 3-5 relevant lowercase tags for the "tags" field

NOTE ON SCHEMA MARKUP: Article/FAQ structured data (schema.org JSON-LD) and
author/date metadata are NOT part of contentHtml — those are generated
separately from the "faqs" array and article fields by the page template,
not by you here.

WRITING STYLE:
- Warm, approachable, beginner-friendly, human, occasionally conversational.
- Short paragraphs (2-4 sentences).
- 900-1300 words of actual reading content (inline styles/HTML tags don't count).

ACCURACY:
- Only give horticulturally accurate advice suited to Indian conditions. If
  unsure of a specific claim, phrase it generally rather than inventing
  specifics. Do not fabricate statistics, studies, or expert names.

Now produce the final JSON only, following every rule above exactly.
`}e.s(["buildBlogPrompt",()=>r])},6249,e=>e.a(async(t,r)=>{try{var n=e.i(89171),a=e.i(65044),i=e.i(67417),o=e.i(73051),s=e.i(81810),l=e.i(16242),c=t([i,o]);function u(e){return String(e).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,96)}async function d(e){let t=(0,o.getFirebaseDb)(),r=await t.collection("articles").where("handle",">=",e).where("handle","<",`${e}\uf8ff`).get(),n=new Set(r.docs.map(e=>String(e.data().handle||""))),a=e,i=1;for(;n.has(a)&&i<1e3;)a=`${e}-${i}`,i+=1;if(n.has(a))throw Error("Could not generate a unique article handle.");return a}async function p(){let e=(0,o.getFirebaseDb)(),t=await e.collection("blogTopics").where("status","==","pending").limit(50).get();if(t.empty)return{published:!1,message:"No pending topics"};let r=t.docs.slice().sort((e,t)=>String(e.data().createdAt||"").localeCompare(String(t.data().createdAt||"")))[0],n=r.ref,i=r.data(),c=String(i.topic||"");try{let t=(0,l.buildBlogPrompt)(c,String(i.notes||"")),{article:r,modelUsed:o}=await (0,s.generateBlogWithFallback)(t),p=u(r.title)||u(c)||`ai-post-${Date.now()}`,h=await d(p),g=new Date().toISOString(),m=String(i.featuredImageUrl||"").trim(),f=String(r.canonicalPath||"").trim(),y=/^\/[\w/\-]+$/.test(f)?f:`/plant-care/${h}`,w={title:r.title,handle:h,excerpt:r.excerpt,seoTitle:r.seoTitle,seoDescription:r.seoDescription,primaryKeyword:r.primaryKeyword,faqs:r.faqs,ogTitle:r.ogTitle,ogDescription:r.ogDescription,canonicalPath:y,authorName:"Succulent Sphere Team",contentHtml:r.contentHtml,status:"published",image:m?{url:m,altText:r.title,width:1600,height:900}:null,tags:r.tags,blogHandle:"plant-care",blogTitle:"Plant Care",publishedAt:g,createdAt:g,updatedAt:g},E=await e.collection("articles").add(w);await n.update({status:"published",publishedArticleId:E.id,modelUsed:o,failureReason:null});try{(0,a.revalidatePath)("/plant-care"),(0,a.revalidatePath)("/plant-care/[handle]","page")}catch{}return{published:!0,articleId:E.id,handle:h,modelUsed:o}}catch(t){let e=String(t.message||t);try{await n.update({status:"failed",failureReason:e.slice(0,500)})}catch{}throw t}}async function h(e){try{let t=String(process.env.CRON_SECRET||"").trim(),r=String(e.headers.get("authorization")||"").trim();t&&r===`Bearer ${t}`||await (0,i.requireAdmin)();let a=await p();return n.NextResponse.json({ok:!0,...a})}catch(e){return n.NextResponse.json({ok:!1,error:String(e.message||e)},{status:500})}}async function g(e){return h(e)}async function m(e){return h(e)}[i,o]=c.then?(await c)():c,e.s(["GET",()=>g,"POST",()=>m,"dynamic",0,"force-dynamic","maxDuration",0,300,"runtime",0,"nodejs"]),r()}catch(e){r(e)}},!1),40111,e=>e.a(async(t,r)=>{try{var n=e.i(47909),a=e.i(74017),i=e.i(96250),o=e.i(59756),s=e.i(61916),l=e.i(74677),c=e.i(69741),u=e.i(16795),d=e.i(87718),p=e.i(95169),h=e.i(47587),g=e.i(66012),m=e.i(70101),f=e.i(26937),y=e.i(10372),w=e.i(93695);e.i(52474);var E=e.i(220),v=e.i(6249),b=t([v]);[v]=b.then?(await b)():b;let A=new n.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/cron/blog-automation/route",pathname:"/api/cron/blog-automation",filename:"route",bundlePath:""},distDir:".next-verify",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/cron/blog-automation/route.ts",nextConfigOutput:"",userland:v}),{workAsyncStorage:N,workUnitAsyncStorage:O,serverHooks:T}=A;function R(){return(0,i.patchFetch)({workAsyncStorage:N,workUnitAsyncStorage:O})}async function S(e,t,r){A.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let n="/api/cron/blog-automation/route";n=n.replace(/\/index$/,"")||"/";let i=await A.prepare(e,t,{srcPage:n,multiZoneDraftMode:!1});if(!i)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:v,params:b,nextConfig:R,parsedUrl:S,isDraftMode:N,prerenderManifest:O,routerServerContext:T,isOnDemandRevalidate:x,revalidateOnlyGenerated:I,resolvedPathname:k,clientReferenceManifest:C,serverActionsManifest:M}=i,D=(0,c.normalizeAppPath)(n),_=!!(O.dynamicRoutes[D]||O.routes[k]),P=async()=>((null==T?void 0:T.render404)?await T.render404(e,t,S,!1):t.end("This page could not be found"),null);if(_&&!N){let e=!!O.routes[k],t=O.dynamicRoutes[D];if(t&&!1===t.fallback&&!e){if(R.experimental.adapterPath)return await P();throw new w.NoFallbackError}}let L=null;!_||A.isDev||N||(L=k,L="/index"===L?"/":L);let U=!0===A.isDev||!_,H=_&&!U;M&&C&&(0,l.setManifestsSingleton)({page:n,clientReferenceManifest:C,serverActionsManifest:M});let q=e.method||"GET",$=(0,s.getTracer)(),F=$.getActiveScopeSpan(),B={params:b,prerenderManifest:O,renderOpts:{experimental:{authInterrupts:!!R.experimental.authInterrupts},cacheComponents:!!R.cacheComponents,supportsDynamicResponse:U,incrementalCache:(0,o.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:R.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,n,a)=>A.onRequestError(e,t,n,a,T)},sharedContext:{buildId:v}},G=new u.NodeNextRequest(e),K=new u.NodeNextResponse(t),j=d.NextRequestAdapter.fromNodeNextRequest(G,(0,d.signalFromNodeResponse)(t));try{let i=async e=>A.handle(j,B).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=$.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${q} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t)}else e.updateName(`${q} ${n}`)}),l=!!(0,o.getRequestMeta)(e,"minimalMode"),c=async o=>{var s,c;let u=async({previousCacheEntry:a})=>{try{if(!l&&x&&I&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await i(o);e.fetchMetrics=B.renderOpts.fetchMetrics;let s=B.renderOpts.pendingWaitUntil;s&&r.waitUntil&&(r.waitUntil(s),s=void 0);let c=B.renderOpts.collectedTags;if(!_)return await (0,g.sendResponse)(G,K,n,B.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,m.toNodeOutgoingHttpHeaders)(n.headers);c&&(t[y.NEXT_CACHE_TAGS_HEADER]=c),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==B.renderOpts.collectedRevalidate&&!(B.renderOpts.collectedRevalidate>=y.INFINITE_CACHE)&&B.renderOpts.collectedRevalidate,a=void 0===B.renderOpts.collectedExpire||B.renderOpts.collectedExpire>=y.INFINITE_CACHE?void 0:B.renderOpts.collectedExpire;return{value:{kind:E.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==a?void 0:a.isStale)&&await A.onRequestError(e,t,{routerKind:"App Router",routePath:n,routeType:"route",revalidateReason:(0,h.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:x})},!1,T),t}},d=await A.handleResponse({req:e,nextConfig:R,cacheKey:L,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:O,isRoutePPREnabled:!1,isOnDemandRevalidate:x,revalidateOnlyGenerated:I,responseGenerator:u,waitUntil:r.waitUntil,isMinimalMode:l});if(!_)return null;if((null==d||null==(s=d.value)?void 0:s.kind)!==E.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(c=d.value)?void 0:c.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});l||t.setHeader("x-nextjs-cache",x?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),N&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,m.fromNodeOutgoingHttpHeaders)(d.value.headers);return l&&_||p.delete(y.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,f.getCacheControlHeader)(d.cacheControl)),await (0,g.sendResponse)(G,K,new Response(d.value.body,{headers:p,status:d.value.status||200})),null};F?await c(F):await $.withPropagatedContext(e.headers,()=>$.trace(p.BaseServerSpan.handleRequest,{spanName:`${q} ${n}`,kind:s.SpanKind.SERVER,attributes:{"http.method":q,"http.target":e.url}},c))}catch(t){if(t instanceof w.NoFallbackError||await A.onRequestError(e,t,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,h.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:x})},!1,T),_)throw t;return await (0,g.sendResponse)(G,K,new Response(null,{status:500})),null}}e.s(["handler",()=>S,"patchFetch",()=>R,"routeModule",()=>A,"serverHooks",()=>T,"workAsyncStorage",()=>N,"workUnitAsyncStorage",()=>O]),r()}catch(e){r(e)}},!1)];

//# sourceMappingURL=_d821db9a._.js.map