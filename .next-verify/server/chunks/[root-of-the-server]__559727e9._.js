module.exports=[24361,(e,t,r)=>{t.exports=e.x("util",()=>require("util"))},67417,e=>e.a(async(t,r)=>{try{e.i(23502);var i=e.i(66663),a=e.i(76680),o=t([i,a]);async function n(e){let t=await (0,a.getAuthenticatedCustomer)(e),r=String(t.customer?.email||"").trim().toLowerCase();return{...t,email:r,isAdmin:!!(r&&new Set(String(process.env.ADMIN_EMAILS||"").split(",").map(e=>e.trim().toLowerCase()).filter(Boolean)).has(r))}}async function d(){let e=await n();if(!e.uid)throw Error("UNAUTHENTICATED");if(!e.isAdmin)throw Error("ADMIN_REQUIRED");return e}[i,a]=o.then?(await o)():o,e.s(["getAdminSession",()=>n,"requireAdmin",()=>d]),r()}catch(e){r(e)}},!1),6461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},88947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},33405,(e,t,r)=>{t.exports=e.x("child_process",()=>require("child_process"))},21517,(e,t,r)=>{t.exports=e.x("http",()=>require("http"))},24836,(e,t,r)=>{t.exports=e.x("https",()=>require("https"))},46786,(e,t,r)=>{t.exports=e.x("os",()=>require("os"))},27699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},54799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},92509,(e,t,r)=>{t.exports=e.x("url",()=>require("url"))},4446,(e,t,r)=>{t.exports=e.x("net",()=>require("net"))},55004,(e,t,r)=>{t.exports=e.x("tls",()=>require("tls"))},88369,e=>e.a(async(t,r)=>{try{e.i(23502);var i=e.i(73051),a=e.i(74681),o=t([i]);function n(e){return String(e||"").replace(/[&<>'"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[e]||e)}function d(e){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(e)}async function s(e){if(!(0,a.configuredEmailProvider)())return await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({emailStatus:"not_configured",emailUpdatedAt:new Date().toISOString()},{merge:!0}),{sent:!1,skipped:!0};try{let t,r,o,s,l,p,c,g,m,u=await (0,a.sendEmail)({to:e.customerEmail,subject:`Succulent Sphere — Order #${e.orderNumber} confirmed`,html:(t=e.items.map(e=>`
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #edf0ed">
          <table cellspacing="0" cellpadding="0">
            <tr>
              ${e.image?`<td style="padding-right:12px"><img src="${n(e.image)}" alt="${n(e.imageAlt||e.title||"Plant")}" width="64" height="64" style="display:block;border-radius:10px;object-fit:cover" /></td>`:""}
              <td style="vertical-align:middle">
                <strong style="display:block;color:#113323">${n(e.title||"Plant")}</strong>
                <span style="font-size:12px;color:#5d6f63">Quantity: ${Math.max(1,Number(e.quantity||1))}</span>
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #edf0ed;color:#113323">${d(Number(e.price||0)*Math.max(1,Number(e.quantity||1)))}</td>
      </tr>`).join(""),r="admin_test"===e.paymentMode?"This is an administrator-created test order. No payment was collected and no shipment will be booked.":"cod_deposit"===e.paymentMode?"Your COD security deposit was received. The remaining balance will be collected at delivery.":"Your payment was received successfully.",o=[e.address||e.address||e.address1||e.address_line1,e.address2||e.address_line2,e.city||e.city||e.town,e.state||e.state||e.province,e.pincode||e.pincode||e.zip].filter(Boolean).map(n).join(", "),s=e.phone?`<p style="margin:0 0 8px">Phone: ${n(e.phone)}</p>`:"",l=o?`<h3 style="margin:18px 0 8px;color:#2b563f">Delivery address</h3><p style="margin:0 0 8px;color:#425b4b">${o}</p>${s}`:"",p="admin_test"===e.paymentMode?"Admin test order — no payment collected":"cod_deposit"===e.paymentMode?`Cash on Delivery — ${d(e.paymentReceived??0)} deposit paid; remaining balance at delivery`:`Prepaid — ${d(e.paymentReceived??e.total)} paid online`,c="admin_test"===e.paymentMode?"No payment was collected for this test order.":"cod_deposit"===e.paymentMode?`Deposit received: ${d(e.paymentReceived??0)}. Remaining balance due at delivery.`:`Amount paid online: ${d(e.paymentReceived??e.total)}.`,m=(g=String(process.env.ORDER_EMAIL_LOGO_URL||"https://whitesmoke-cattle-754161.hostingersite.com").trim())?`<img src="${n(g)}" alt="Succulent Sphere" width="64" height="64" style="display:block;border-radius:14px;object-fit:cover" />`:'<div style="width:64px;height:64px;border-radius:14px;background:linear-gradient(135deg,#2a6b46,#79b07a);box-shadow:0 8px 18px rgba(39,88,56,.18);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px">SS</div>',`<!doctype html>
  <html>
    <body style="margin:0;background:linear-gradient(180deg,#f6fbf6 0%,#eef6ee 100%);font-family:Inter,system-ui,Arial,sans-serif;color:#20352a">
      <main style="max-width:720px;margin:28px auto;padding:28px">
        <div style="border-radius:20px;padding:18px;background:linear-gradient(180deg,#ffffff,#f8fbf8);box-shadow: 0 18px 40px rgba(32,53,40,0.12), inset 0 1px 0 rgba(255,255,255,0.6);overflow:hidden">
          <header style="display:flex;align-items:center;gap:18px">
            ${m}
            <div>
              <p style="margin:0;font-size:12px;letter-spacing:1px;color:#4c6b57;font-weight:700">SUCCULENT SPHERE</p>
              <h1 style="margin:6px 0 0;font-size:22px;color:#163b2a">Order confirmed</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#577567">Order #${n(e.orderNumber)}</p>
            </div>
          </header>
          <section style="margin-top:18px;padding-top:8px;border-top:1px dashed #e6efe6">
            <div style="display:flex;gap:18px;align-items:flex-start">
              <div style="flex:1">
                <p style="margin:0 0 12px;font-size:15px;color:#254032">Hi ${n(e.customerName||"there")},</p>
                <p style="margin:0 0 14px;color:#425b4b">${r}</p>
                <div style="border-radius:14px;padding:14px;background:linear-gradient(180deg,#fbfff9,#eef7ea);box-shadow:0 6px 18px rgba(32,53,40,0.06)">
                  <h2 style="margin:0 0 8px;font-size:15px;color:#1d4a35">Your plants</h2>
                  <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px">${t}</table>
                </div>
                ${l}
              </div>
              <aside style="width:220px;flex-shrink:0">
                <div style="padding:12px;border-radius:12px;background:linear-gradient(180deg,#ffffff,#f4fbf4);box-shadow:0 12px 30px rgba(32,53,40,0.06)">
                  <p style="margin:0 0 8px;font-size:12px;color:#54705c">Order summary</p>
                  <p style="margin:0;font-size:18px;font-weight:700;color:#1f4a35">${d(e.total)}</p>
                  <p style="margin:10px 0 0;font-size:12px;color:#637a6f">${p}</p>
                </div>
              </aside>
            </div>
            <div style="margin-top:18px;padding:12px;border-radius:12px;background:#f6fbf6;border:1px solid #e9f2ea">
              <p style="margin:0;font-size:13px;color:#415a4d">${c}</p>
            </div>
            <footer style="margin-top:22px;display:flex;justify-content:space-between;align-items:center">
              <p style="margin:0;font-size:12px;color:#6b8774">Questions? Reply to this email and our plant team will help.</p>
              <p style="margin:0;font-size:12px;color:#4a6a57">&copy; ${new Date().getFullYear()} Succulent Sphere</p>
            </footer>
          </section>
        </div>
      </main>
    </body>
  </html>`),idempotencyKey:`order-confirmation-${e.orderId}`});await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({emailStatus:"sent",emailProvider:u.provider,emailProviderId:u.id||"",emailSentAt:new Date().toISOString()},{merge:!0});let x=String(process.env.ADMIN_EMAILS||"").trim();if(x)for(let t of x.split(",").map(e=>String(e||"").trim()).filter(Boolean))try{let r=await (0,a.sendEmail)({to:t,subject:`New order #${e.orderNumber} — Succulent Sphere`,html:function(e){let t=Number(e.shipping||0),r=Number(e.discount||0),i=Number(e.codFee||0),a=Number(e.walletAmountUsed||0),o=Number(e.cashbackEarned||0),s=Number(e.paymentReceived??e.payableAmount??e.total),l=e.total+r+t-i,p=[e.address||e.address||e.address1||e.address_line1,e.address2||e.address_line2,e.city||e.city||e.town,e.state||e.state||e.province,e.pincode||e.pincode||e.zip].filter(Boolean).map(e=>String(e).trim()).filter(Boolean),c=e.items.map(e=>{let t=Number(e.price||0),r=Math.max(1,Number(e.quantity||1));return`
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;vertical-align:top">${n(e.title||"Plant")}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;text-align:center">${r}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;text-align:right">${d(t)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;text-align:right">${d(t*r)}</td>
      </tr>`}).join(""),g=`${String("https://succulentsphere.com").replace(/\/+$/,"")}/admin?order=${encodeURIComponent(String(e.orderNumber))}`;return`<!doctype html>
  <html>
    <body style="margin:0;background:#f4f5f2;font-family:Arial,sans-serif;color:#1c3328">
      <div style="max-width:780px;margin:26px auto;padding:18px">
        <div style="border-radius:22px;background:linear-gradient(135deg,#ffffff,#f8faf5);border:1px solid #e1e8df;box-shadow:0 18px 40px rgba(20,38,28,0.08);overflow:hidden">
          <div style="padding:24px 28px;background:linear-gradient(135deg,#1d4c38,#3a6f52);color:#fff">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;font-weight:bold;opacity:0.9">NEW ORDER ALERT</p>
            <h1 style="margin:0;font-size:30px;line-height:1.2">Order #${n(e.orderNumber)}</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:0.9">A fresh customer purchase has been received.</p>
          </div>
          <div style="padding:28px">
            <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
              <tr>
                <td style="padding:0 0 14px;vertical-align:top;width:50%">
                  <div style="background:#f3f8f4;border:1px solid #def0de;border-radius:14px;padding:16px">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#587366;text-transform:uppercase">Customer</p>
                    <p style="margin:0 0 6px;font-size:18px;font-weight:bold;color:#163a2d">${n(e.customerName||"Unknown customer")}</p>
                    <p style="margin:0 0 6px;color:#415b4b">${n(e.customerEmail||"No email")}</p>
                    <p style="margin:0;color:#415b4b">${n(e.phone||"No phone")}</p>
                  </div>
                </td>
                <td style="padding:0 0 14px;vertical-align:top;width:50%">
                  <div style="background:#f7f5ef;border:1px solid #efe4d7;border-radius:14px;padding:16px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#7b6753;text-transform:uppercase">Payment</p>
                    <p style="margin:0 0 6px;font-size:18px;font-weight:bold;color:#223d32">${n("cod_deposit"===e.paymentMode?"COD Deposit":"admin_test"===e.paymentMode?"Admin Test":"Prepaid")}</p>
                    <p style="margin:0 0 6px;color:#52665b">Amount paid: <strong>${d(s)}</strong></p>
                    <p style="margin:0;color:#52665b">COD fee: ${d(i)} \xb7 Shipping: ${d(t)} \xb7 Discount: ${d(r)}</p>
                  </div>
                </td>
              </tr>
            </table>

            <div style="background:#f9fcf9;border:1px solid #e3efe5;border-radius:16px;padding:16px;margin-bottom:20px">
              <p style="margin:0 0 12px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#587366;text-transform:uppercase">Plants ordered</p>
              <table width="100%" style="border-collapse:collapse;font-size:14px;color:#1f382f">
                <thead>
                  <tr>
                    <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #dfe9df;color:#587366;font-size:12px;text-transform:uppercase">Product</th>
                    <th style="padding:10px 12px;border-bottom:1px solid #dfe9df;color:#587366;font-size:12px;text-transform:uppercase">Qty</th>
                    <th style="padding:10px 12px;border-bottom:1px solid #dfe9df;color:#587366;font-size:12px;text-transform:uppercase;text-align:right">Unit Price</th>
                    <th style="padding:10px 12px;border-bottom:1px solid #dfe9df;color:#587366;font-size:12px;text-transform:uppercase;text-align:right">Total</th>
                  </tr>
                </thead>
                <tbody>${c}</tbody>
              </table>
            </div>

            <div style="background:#f7faf7;border:1px solid #e4efe2;border-radius:16px;padding:16px;margin-bottom:20px">
              <p style="margin:0 0 12px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#587366;text-transform:uppercase">Delivery address</p>
              <p style="margin:0;color:#274534;line-height:1.7">${n(p.join(", ")||"Address not provided")}</p>
            </div>

            <div style="background:#eef7f1;border:1px solid #dfeee2;border-radius:16px;padding:16px;margin-bottom:20px">
              <p style="margin:0 0 10px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#587366;text-transform:uppercase">Financial summary</p>
              <table width="100%" style="border-collapse:collapse;font-size:14px;color:#1f382f">
                <tr>
                  <td style="padding:6px 0">Subtotal</td>
                  <td style="padding:6px 0;text-align:right">${d(Math.max(0,l))}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Shipping</td>
                  <td style="padding:6px 0;text-align:right">${d(t)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Discount</td>
                  <td style="padding:6px 0;text-align:right">-${d(r)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Wallet used <span style="color:#7b6753">- deducted from customer wallet, not extra discount</span></td>
                  <td style="padding:6px 0;text-align:right">-${d(a)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">COD fee</td>
                  <td style="padding:6px 0;text-align:right">${d(i)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Amount paid through Razorpay</td>
                  <td style="padding:6px 0;text-align:right">${d(s)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Cashback credited after confirmation</td>
                  <td style="padding:6px 0;text-align:right">${d(o)}</td>
                </tr>
                <tr style="border-top:1px solid #d7e8d8">
                  <td style="padding:10px 0 0;font-weight:bold">Total</td>
                  <td style="padding:10px 0 0;text-align:right;font-weight:bold">${d(e.total)}</td>
                </tr>
              </table>
            </div>

            <div style="padding-top:4px">
              <a href="${n(g)}" style="display:inline-block;background:#1d4c38;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Open in Admin</a>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>`}(e),idempotencyKey:`order-admin-notify-${e.orderId}-${t}`});await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({adminEmailStatus:"sent",adminEmailProvider:r.provider,adminEmailProviderId:r.id||"",adminEmailSentAt:new Date().toISOString()},{merge:!0})}catch(t){await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({adminEmailStatus:"failed",adminEmailError:String(t.message||t).slice(0,300),adminEmailUpdatedAt:new Date().toISOString()},{merge:!0})}return{sent:!0,skipped:!1}}catch(t){return await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({emailStatus:"failed",emailError:String(t.message||"Unable to send order email.").slice(0,300),emailUpdatedAt:new Date().toISOString()},{merge:!0}),{sent:!1,skipped:!1}}}async function l(e){if(!(0,a.configuredEmailProvider)())return{sent:!1,skipped:!0};let t=e.carrier||"Delhivery",r=e.trackingUrl||`https://www.delhivery.com/track/package/${encodeURIComponent(e.trackingNumber)}`,o=`<!doctype html><html><body style="margin:0;background:#f4f6f2;font-family:Arial,sans-serif;color:#20352a"><main style="max-width:620px;margin:28px auto;background:#fff;border:1px solid #e2e8e1;border-radius:20px;overflow:hidden"><header style="padding:30px;background:linear-gradient(135deg,#173c2d,#356649);color:#fff"><p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:2px">SUCCULENT SPHERE</p><h1 style="margin:12px 0 0;font-size:28px">Your plants are on their way</h1></header><section style="padding:30px"><p style="font-size:16px">Hi ${n(e.customerName||"there")},</p><p>Great news — order <strong>#${n(e.orderNumber)}</strong> has been handed to ${n(t)}.</p><div style="margin:24px 0;padding:20px;border-radius:14px;background:#edf6ee;border:1px solid #d7ead9"><p style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#54705c">TRACKING NUMBER</p><p style="margin:0;font-size:22px;font-weight:bold;color:#1d4a35">${n(e.trackingNumber)}</p></div><p style="margin:24px 0"><a href="${n(r)}" style="display:inline-block;background:#1d573b;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:bold">Track your shipment</a></p><p style="font-size:13px;line-height:1.6;color:#607267">The tracking page can take a little time to show its first scan after dispatch. Please keep this email for your reference.</p></section><footer style="padding:18px 30px;background:#f7f9f6;color:#718076;font-size:12px">Questions? Reply to this email and our plant team will help.</footer></main></body></html>`;try{let t=await (0,a.sendEmail)({to:e.customerEmail,subject:`Your Succulent Sphere order #${e.orderNumber} is on its way`,html:o,idempotencyKey:`tracking-${e.orderId}-${e.trackingNumber}`});return await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({trackingEmailStatus:"sent",trackingEmailProvider:t.provider,trackingEmailSentAt:new Date().toISOString()},{merge:!0}),{sent:!0,skipped:!1}}catch(t){return await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({trackingEmailStatus:"failed",trackingEmailError:String(t.message).slice(0,300),trackingEmailUpdatedAt:new Date().toISOString()},{merge:!0}),{sent:!1,skipped:!1}}}[i]=o.then?(await o)():o,e.s(["sendOrderConfirmationEmail",()=>s,"sendTrackingEmail",()=>l]),r()}catch(e){r(e)}},!1),70971,e=>e.a(async(t,r)=>{try{var i=e.i(89171),a=e.i(67417),o=e.i(88369),n=t([a,o]);async function d(e){try{return await (0,a.requireAdmin)(),i.NextResponse.json({error:"Not allowed in production"},{status:403})}catch(e){return i.NextResponse.json({error:String(e?.message||e)},{status:500})}}[a,o]=n.then?(await n)():n,e.s(["POST",()=>d,"runtime",0,"nodejs"]),r()}catch(e){r(e)}},!1),71422,e=>e.a(async(t,r)=>{try{var i=e.i(47909),a=e.i(74017),o=e.i(96250),n=e.i(59756),d=e.i(61916),s=e.i(74677),l=e.i(69741),p=e.i(16795),c=e.i(87718),g=e.i(95169),m=e.i(47587),u=e.i(66012),x=e.i(70101),f=e.i(26937),y=e.i(10372),h=e.i(93695);e.i(52474);var b=e.i(220),v=e.i(70971),w=t([v]);[v]=w.then?(await w)():w;let S=new i.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/dev/email/send-test/route",pathname:"/api/dev/email/send-test",filename:"route",bundlePath:""},distDir:".next-verify",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/dev/email/send-test/route.ts",nextConfigOutput:"",userland:v}),{workAsyncStorage:$,workUnitAsyncStorage:k,serverHooks:N}=S;function E(){return(0,o.patchFetch)({workAsyncStorage:$,workUnitAsyncStorage:k})}async function R(e,t,r){S.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let i="/api/dev/email/send-test/route";i=i.replace(/\/index$/,"")||"/";let o=await S.prepare(e,t,{srcPage:i,multiZoneDraftMode:!1});if(!o)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:v,params:w,nextConfig:E,parsedUrl:R,isDraftMode:$,prerenderManifest:k,routerServerContext:N,isOnDemandRevalidate:A,revalidateOnlyGenerated:C,resolvedPathname:I,clientReferenceManifest:D,serverActionsManifest:O}=o,P=(0,l.normalizeAppPath)(i),z=!!(k.dynamicRoutes[P]||k.routes[I]),_=async()=>((null==N?void 0:N.render404)?await N.render404(e,t,R,!1):t.end("This page could not be found"),null);if(z&&!$){let e=!!k.routes[I],t=k.dynamicRoutes[P];if(t&&!1===t.fallback&&!e){if(E.experimental.adapterPath)return await _();throw new h.NoFallbackError}}let T=null;!z||S.isDev||$||(T=I,T="/index"===T?"/":T);let U=!0===S.isDev||!z,q=z&&!U;O&&D&&(0,s.setManifestsSingleton)({page:i,clientReferenceManifest:D,serverActionsManifest:O});let M=e.method||"GET",H=(0,d.getTracer)(),j=H.getActiveScopeSpan(),F={params:w,prerenderManifest:k,renderOpts:{experimental:{authInterrupts:!!E.experimental.authInterrupts},cacheComponents:!!E.cacheComponents,supportsDynamicResponse:U,incrementalCache:(0,n.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:E.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,i,a)=>S.onRequestError(e,t,i,a,N)},sharedContext:{buildId:v}},L=new p.NodeNextRequest(e),K=new p.NodeNextResponse(t),B=c.NextRequestAdapter.fromNodeNextRequest(L,(0,c.signalFromNodeResponse)(t));try{let o=async e=>S.handle(B,F).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=H.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==g.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${M} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t)}else e.updateName(`${M} ${i}`)}),s=!!(0,n.getRequestMeta)(e,"minimalMode"),l=async n=>{var d,l;let p=async({previousCacheEntry:a})=>{try{if(!s&&A&&C&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let i=await o(n);e.fetchMetrics=F.renderOpts.fetchMetrics;let d=F.renderOpts.pendingWaitUntil;d&&r.waitUntil&&(r.waitUntil(d),d=void 0);let l=F.renderOpts.collectedTags;if(!z)return await (0,u.sendResponse)(L,K,i,F.renderOpts.pendingWaitUntil),null;{let e=await i.blob(),t=(0,x.toNodeOutgoingHttpHeaders)(i.headers);l&&(t[y.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==F.renderOpts.collectedRevalidate&&!(F.renderOpts.collectedRevalidate>=y.INFINITE_CACHE)&&F.renderOpts.collectedRevalidate,a=void 0===F.renderOpts.collectedExpire||F.renderOpts.collectedExpire>=y.INFINITE_CACHE?void 0:F.renderOpts.collectedExpire;return{value:{kind:b.CachedRouteKind.APP_ROUTE,status:i.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==a?void 0:a.isStale)&&await S.onRequestError(e,t,{routerKind:"App Router",routePath:i,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:A})},!1,N),t}},c=await S.handleResponse({req:e,nextConfig:E,cacheKey:T,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:k,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:C,responseGenerator:p,waitUntil:r.waitUntil,isMinimalMode:s});if(!z)return null;if((null==c||null==(d=c.value)?void 0:d.kind)!==b.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(l=c.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});s||t.setHeader("x-nextjs-cache",A?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),$&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let g=(0,x.fromNodeOutgoingHttpHeaders)(c.value.headers);return s&&z||g.delete(y.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||g.get("Cache-Control")||g.set("Cache-Control",(0,f.getCacheControlHeader)(c.cacheControl)),await (0,u.sendResponse)(L,K,new Response(c.value.body,{headers:g,status:c.value.status||200})),null};j?await l(j):await H.withPropagatedContext(e.headers,()=>H.trace(g.BaseServerSpan.handleRequest,{spanName:`${M} ${i}`,kind:d.SpanKind.SERVER,attributes:{"http.method":M,"http.target":e.url}},l))}catch(t){if(t instanceof h.NoFallbackError||await S.onRequestError(e,t,{routerKind:"App Router",routePath:P,routeType:"route",revalidateReason:(0,m.getRevalidateReason)({isStaticGeneration:q,isOnDemandRevalidate:A})},!1,N),z)throw t;return await (0,u.sendResponse)(L,K,new Response(null,{status:500})),null}}e.s(["handler",()=>R,"patchFetch",()=>E,"routeModule",()=>S,"serverHooks",()=>N,"workAsyncStorage",()=>$,"workUnitAsyncStorage",()=>k]),r()}catch(e){r(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__559727e9._.js.map