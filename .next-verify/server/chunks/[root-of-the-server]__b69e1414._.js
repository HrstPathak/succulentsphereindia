module.exports=[6461,(e,t,r)=>{t.exports=e.x("zlib",()=>require("zlib"))},88947,(e,t,r)=>{t.exports=e.x("stream",()=>require("stream"))},33405,(e,t,r)=>{t.exports=e.x("child_process",()=>require("child_process"))},21517,(e,t,r)=>{t.exports=e.x("http",()=>require("http"))},24836,(e,t,r)=>{t.exports=e.x("https",()=>require("https"))},46786,(e,t,r)=>{t.exports=e.x("os",()=>require("os"))},27699,(e,t,r)=>{t.exports=e.x("events",()=>require("events"))},54799,(e,t,r)=>{t.exports=e.x("crypto",()=>require("crypto"))},92509,(e,t,r)=>{t.exports=e.x("url",()=>require("url"))},4446,(e,t,r)=>{t.exports=e.x("net",()=>require("net"))},55004,(e,t,r)=>{t.exports=e.x("tls",()=>require("tls"))},88369,e=>e.a(async(t,r)=>{try{e.i(23502);var i=e.i(73051),a=e.i(74681),o=t([i]);function d(e){return String(e||"").replace(/[&<>'"]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[e]||e)}function n(e){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(e)}async function s(e){if(!(0,a.configuredEmailProvider)())return await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({emailStatus:"not_configured",emailUpdatedAt:new Date().toISOString()},{merge:!0}),{sent:!1,skipped:!0};try{let t,r,o,s,p,l,c,m,g,f=await (0,a.sendEmail)({to:e.customerEmail,subject:`Succulent Sphere — Order #${e.orderNumber} confirmed`,html:(t=e.items.map(e=>`
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #edf0ed">
          <table cellspacing="0" cellpadding="0">
            <tr>
              ${e.image?`<td style="padding-right:12px"><img src="${d(e.image)}" alt="${d(e.imageAlt||e.title||"Plant")}" width="64" height="64" style="display:block;border-radius:10px;object-fit:cover" /></td>`:""}
              <td style="vertical-align:middle">
                <strong style="display:block;color:#113323">${d(e.title||"Plant")}</strong>
                <span style="font-size:12px;color:#5d6f63">Quantity: ${Math.max(1,Number(e.quantity||1))}</span>
              </td>
            </tr>
          </table>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid #edf0ed;color:#113323">${n(Number(e.price||0)*Math.max(1,Number(e.quantity||1)))}</td>
      </tr>`).join(""),r="admin_test"===e.paymentMode?"This is an administrator-created test order. No payment was collected and no shipment will be booked.":"cod_deposit"===e.paymentMode?"Your COD security deposit was received. The remaining balance will be collected at delivery.":"Your payment was received successfully.",o=[e.address||e.address||e.address1||e.address_line1,e.address2||e.address_line2,e.city||e.city||e.town,e.state||e.state||e.province,e.pincode||e.pincode||e.zip].filter(Boolean).map(d).join(", "),s=e.phone?`<p style="margin:0 0 8px">Phone: ${d(e.phone)}</p>`:"",p=o?`<h3 style="margin:18px 0 8px;color:#2b563f">Delivery address</h3><p style="margin:0 0 8px;color:#425b4b">${o}</p>${s}`:"",l="admin_test"===e.paymentMode?"Admin test order — no payment collected":"cod_deposit"===e.paymentMode?`Cash on Delivery — ${n(e.paymentReceived??0)} deposit paid; remaining balance at delivery`:`Prepaid — ${n(e.paymentReceived??e.total)} paid online`,c="admin_test"===e.paymentMode?"No payment was collected for this test order.":"cod_deposit"===e.paymentMode?`Deposit received: ${n(e.paymentReceived??0)}. Remaining balance due at delivery.`:`Amount paid online: ${n(e.paymentReceived??e.total)}.`,g=(m=String(process.env.ORDER_EMAIL_LOGO_URL||"https://whitesmoke-cattle-754161.hostingersite.com").trim())?`<img src="${d(m)}" alt="Succulent Sphere" width="64" height="64" style="display:block;border-radius:14px;object-fit:cover" />`:'<div style="width:64px;height:64px;border-radius:14px;background:linear-gradient(135deg,#2a6b46,#79b07a);box-shadow:0 8px 18px rgba(39,88,56,.18);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px">SS</div>',`<!doctype html>
  <html>
    <body style="margin:0;background:linear-gradient(180deg,#f6fbf6 0%,#eef6ee 100%);font-family:Inter,system-ui,Arial,sans-serif;color:#20352a">
      <main style="max-width:720px;margin:28px auto;padding:28px">
        <div style="border-radius:20px;padding:18px;background:linear-gradient(180deg,#ffffff,#f8fbf8);box-shadow: 0 18px 40px rgba(32,53,40,0.12), inset 0 1px 0 rgba(255,255,255,0.6);overflow:hidden">
          <header style="display:flex;align-items:center;gap:18px">
            ${g}
            <div>
              <p style="margin:0;font-size:12px;letter-spacing:1px;color:#4c6b57;font-weight:700">SUCCULENT SPHERE</p>
              <h1 style="margin:6px 0 0;font-size:22px;color:#163b2a">Order confirmed</h1>
              <p style="margin:4px 0 0;font-size:13px;color:#577567">Order #${d(e.orderNumber)}</p>
            </div>
          </header>
          <section style="margin-top:18px;padding-top:8px;border-top:1px dashed #e6efe6">
            <div style="display:flex;gap:18px;align-items:flex-start">
              <div style="flex:1">
                <p style="margin:0 0 12px;font-size:15px;color:#254032">Hi ${d(e.customerName||"there")},</p>
                <p style="margin:0 0 14px;color:#425b4b">${r}</p>
                <div style="border-radius:14px;padding:14px;background:linear-gradient(180deg,#fbfff9,#eef7ea);box-shadow:0 6px 18px rgba(32,53,40,0.06)">
                  <h2 style="margin:0 0 8px;font-size:15px;color:#1d4a35">Your plants</h2>
                  <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px">${t}</table>
                </div>
                ${p}
              </div>
              <aside style="width:220px;flex-shrink:0">
                <div style="padding:12px;border-radius:12px;background:linear-gradient(180deg,#ffffff,#f4fbf4);box-shadow:0 12px 30px rgba(32,53,40,0.06)">
                  <p style="margin:0 0 8px;font-size:12px;color:#54705c">Order summary</p>
                  <p style="margin:0;font-size:18px;font-weight:700;color:#1f4a35">${n(e.total)}</p>
                  <p style="margin:10px 0 0;font-size:12px;color:#637a6f">${l}</p>
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
  </html>`),idempotencyKey:`order-confirmation-${e.orderId}`});await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({emailStatus:"sent",emailProvider:f.provider,emailProviderId:f.id||"",emailSentAt:new Date().toISOString()},{merge:!0});let u=String(process.env.ADMIN_EMAILS||"").trim();if(u)for(let t of u.split(",").map(e=>String(e||"").trim()).filter(Boolean))try{let r=await (0,a.sendEmail)({to:t,subject:`New order #${e.orderNumber} — Succulent Sphere`,html:function(e){let t=Number(e.shipping||0),r=Number(e.discount||0),i=Number(e.codFee||0),a=Number(e.walletAmountUsed||0),o=Number(e.cashbackEarned||0),s=Number(e.paymentReceived??e.payableAmount??e.total),p=e.total+r+t-i,l=[e.address||e.address||e.address1||e.address_line1,e.address2||e.address_line2,e.city||e.city||e.town,e.state||e.state||e.province,e.pincode||e.pincode||e.zip].filter(Boolean).map(e=>String(e).trim()).filter(Boolean),c=e.items.map(e=>{let t=Number(e.price||0),r=Math.max(1,Number(e.quantity||1));return`
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;vertical-align:top">${d(e.title||"Plant")}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;text-align:center">${r}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;text-align:right">${n(t)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #ebf1eb;text-align:right">${n(t*r)}</td>
      </tr>`}).join(""),m=`${String("https://succulentsphere.com").replace(/\/+$/,"")}/admin?order=${encodeURIComponent(String(e.orderNumber))}`;return`<!doctype html>
  <html>
    <body style="margin:0;background:#f4f5f2;font-family:Arial,sans-serif;color:#1c3328">
      <div style="max-width:780px;margin:26px auto;padding:18px">
        <div style="border-radius:22px;background:linear-gradient(135deg,#ffffff,#f8faf5);border:1px solid #e1e8df;box-shadow:0 18px 40px rgba(20,38,28,0.08);overflow:hidden">
          <div style="padding:24px 28px;background:linear-gradient(135deg,#1d4c38,#3a6f52);color:#fff">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;font-weight:bold;opacity:0.9">NEW ORDER ALERT</p>
            <h1 style="margin:0;font-size:30px;line-height:1.2">Order #${d(e.orderNumber)}</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:0.9">A fresh customer purchase has been received.</p>
          </div>
          <div style="padding:28px">
            <table width="100%" style="border-collapse:collapse;margin-bottom:20px">
              <tr>
                <td style="padding:0 0 14px;vertical-align:top;width:50%">
                  <div style="background:#f3f8f4;border:1px solid #def0de;border-radius:14px;padding:16px">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#587366;text-transform:uppercase">Customer</p>
                    <p style="margin:0 0 6px;font-size:18px;font-weight:bold;color:#163a2d">${d(e.customerName||"Unknown customer")}</p>
                    <p style="margin:0 0 6px;color:#415b4b">${d(e.customerEmail||"No email")}</p>
                    <p style="margin:0;color:#415b4b">${d(e.phone||"No phone")}</p>
                  </div>
                </td>
                <td style="padding:0 0 14px;vertical-align:top;width:50%">
                  <div style="background:#f7f5ef;border:1px solid #efe4d7;border-radius:14px;padding:16px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#7b6753;text-transform:uppercase">Payment</p>
                    <p style="margin:0 0 6px;font-size:18px;font-weight:bold;color:#223d32">${d("cod_deposit"===e.paymentMode?"COD Deposit":"admin_test"===e.paymentMode?"Admin Test":"Prepaid")}</p>
                    <p style="margin:0 0 6px;color:#52665b">Amount paid: <strong>${n(s)}</strong></p>
                    <p style="margin:0;color:#52665b">COD fee: ${n(i)} \xb7 Shipping: ${n(t)} \xb7 Discount: ${n(r)}</p>
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
              <p style="margin:0;color:#274534;line-height:1.7">${d(l.join(", ")||"Address not provided")}</p>
            </div>

            <div style="background:#eef7f1;border:1px solid #dfeee2;border-radius:16px;padding:16px;margin-bottom:20px">
              <p style="margin:0 0 10px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#587366;text-transform:uppercase">Financial summary</p>
              <table width="100%" style="border-collapse:collapse;font-size:14px;color:#1f382f">
                <tr>
                  <td style="padding:6px 0">Subtotal</td>
                  <td style="padding:6px 0;text-align:right">${n(Math.max(0,p))}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Shipping</td>
                  <td style="padding:6px 0;text-align:right">${n(t)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Discount</td>
                  <td style="padding:6px 0;text-align:right">-${n(r)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Wallet used <span style="color:#7b6753">- deducted from customer wallet, not extra discount</span></td>
                  <td style="padding:6px 0;text-align:right">-${n(a)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">COD fee</td>
                  <td style="padding:6px 0;text-align:right">${n(i)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Amount paid through Razorpay</td>
                  <td style="padding:6px 0;text-align:right">${n(s)}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0">Cashback credited after confirmation</td>
                  <td style="padding:6px 0;text-align:right">${n(o)}</td>
                </tr>
                <tr style="border-top:1px solid #d7e8d8">
                  <td style="padding:10px 0 0;font-weight:bold">Total</td>
                  <td style="padding:10px 0 0;text-align:right;font-weight:bold">${n(e.total)}</td>
                </tr>
              </table>
            </div>

            <div style="padding-top:4px">
              <a href="${d(m)}" style="display:inline-block;background:#1d4c38;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Open in Admin</a>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>`}(e),idempotencyKey:`order-admin-notify-${e.orderId}-${t}`});await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({adminEmailStatus:"sent",adminEmailProvider:r.provider,adminEmailProviderId:r.id||"",adminEmailSentAt:new Date().toISOString()},{merge:!0})}catch(t){await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({adminEmailStatus:"failed",adminEmailError:String(t.message||t).slice(0,300),adminEmailUpdatedAt:new Date().toISOString()},{merge:!0})}return{sent:!0,skipped:!1}}catch(t){return await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({emailStatus:"failed",emailError:String(t.message||"Unable to send order email.").slice(0,300),emailUpdatedAt:new Date().toISOString()},{merge:!0}),{sent:!1,skipped:!1}}}async function p(e){if(!(0,a.configuredEmailProvider)())return{sent:!1,skipped:!0};let t=e.carrier||"Delhivery",r=e.trackingUrl||`https://www.delhivery.com/track/package/${encodeURIComponent(e.trackingNumber)}`,o=`<!doctype html><html><body style="margin:0;background:#f4f6f2;font-family:Arial,sans-serif;color:#20352a"><main style="max-width:620px;margin:28px auto;background:#fff;border:1px solid #e2e8e1;border-radius:20px;overflow:hidden"><header style="padding:30px;background:linear-gradient(135deg,#173c2d,#356649);color:#fff"><p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:2px">SUCCULENT SPHERE</p><h1 style="margin:12px 0 0;font-size:28px">Your plants are on their way</h1></header><section style="padding:30px"><p style="font-size:16px">Hi ${d(e.customerName||"there")},</p><p>Great news — order <strong>#${d(e.orderNumber)}</strong> has been handed to ${d(t)}.</p><div style="margin:24px 0;padding:20px;border-radius:14px;background:#edf6ee;border:1px solid #d7ead9"><p style="margin:0 0 8px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#54705c">TRACKING NUMBER</p><p style="margin:0;font-size:22px;font-weight:bold;color:#1d4a35">${d(e.trackingNumber)}</p></div><p style="margin:24px 0"><a href="${d(r)}" style="display:inline-block;background:#1d573b;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:bold">Track your shipment</a></p><p style="font-size:13px;line-height:1.6;color:#607267">The tracking page can take a little time to show its first scan after dispatch. Please keep this email for your reference.</p></section><footer style="padding:18px 30px;background:#f7f9f6;color:#718076;font-size:12px">Questions? Reply to this email and our plant team will help.</footer></main></body></html>`;try{let t=await (0,a.sendEmail)({to:e.customerEmail,subject:`Your Succulent Sphere order #${e.orderNumber} is on its way`,html:o,idempotencyKey:`tracking-${e.orderId}-${e.trackingNumber}`});return await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({trackingEmailStatus:"sent",trackingEmailProvider:t.provider,trackingEmailSentAt:new Date().toISOString()},{merge:!0}),{sent:!0,skipped:!1}}catch(t){return await (0,i.getFirebaseDb)().collection("orders").doc(e.orderId).set({trackingEmailStatus:"failed",trackingEmailError:String(t.message).slice(0,300),trackingEmailUpdatedAt:new Date().toISOString()},{merge:!0}),{sent:!1,skipped:!1}}}[i]=o.then?(await o)():o,e.s(["sendOrderConfirmationEmail",()=>s,"sendTrackingEmail",()=>p]),r()}catch(e){r(e)}},!1),51301,e=>e.a(async(t,r)=>{try{e.i(23502);var i=e.i(73051),a=e.i(88369),o=t([i,a]);[i,a]=o.then?(await o)():o;let c=String(process.env.DELHIVERY_CREATE_URL||"").trim(),m=String(process.env.DELHIVERY_API_TOKEN||"").trim();function d(e,t=0){let r=Number(e);return Number.isFinite(r)?r:t}async function n(e){if(!(c&&m))throw Error("Delhivery shipment creation is not configured. Set DELHIVERY_CREATE_URL and DELHIVERY_API_TOKEN.");let t=await fetch(c,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Token ${m}`},body:JSON.stringify(e),cache:"no-store"}),r=await t.text(),i=null;try{i=r?JSON.parse(r):null}catch{i={raw:r}}if(!t.ok)throw Error(String(i?.message||i?.error||`Delhivery shipment creation failed (${t.status}).`));return i}async function s(e,t={}){let r=(0,i.getFirebaseDb)().collection("shipments").doc(e),a=new Date().toISOString(),o=await r.get();return o.exists?t.retryFailed&&"failed"===o.get("status")&&await r.set({status:"pending",attempts:0,lastError:null,updatedAt:a},{merge:!0}):await r.set({orderId:e,orderNumber:t.orderNumber||null,package:t.package||null,carrier:"Delhivery",status:"pending",attempts:0,createdAt:a,updatedAt:a}),r.id}async function p(e){let t=(0,i.getFirebaseDb)(),r=t.collection("shipments").doc(e);if(!(c&&m))return{ok:!1,skipped:!0,reason:"carrier_not_configured"};let o=await t.runTransaction(async e=>{let t=await e.get(r);if(!t.exists)throw Error("Shipment job not found.");let i=t.data();if("done"===i.status)return{job:i,skip:"already_created"};if("failed"===i.status)return{job:i,skip:"retry_limit_reached"};let a=new Date(String(i.updatedAt||0)).getTime();if("processing"===i.status&&Number.isFinite(a)&&Date.now()-a<6e5)return{job:i,skip:"already_processing"};let o=d(i.attempts)+1,n={...i,attempts:o};return e.set(r,{status:"processing",attempts:o,updatedAt:new Date().toISOString()},{merge:!0}),{job:n,skip:""}});if(o.skip)return{ok:"already_created"===o.skip,skipped:!0,reason:o.skip};let s=o.job,p=d(s.attempts);try{var l;let e=t.collection("orders").doc(String(s.orderId)),i=await e.get();if(!i.exists)throw Error("Order not found for shipment job.");let o=i.data()||{},p=Array.isArray(o.tracking)?o.tracking[0]:null;if(p?.number)return await r.set({status:"done",updatedAt:new Date().toISOString(),trackingNumber:p.number},{merge:!0}),{ok:!0,skipped:!0,reason:"order_already_has_tracking",trackingNumber:p.number};let c=String(o.paymentMode||"prepaid"),m=d(o.total),g=d(o.paymentReceived),f="cod_deposit"===c?Math.max(0,Number((m-g).toFixed(2))):0,u=o.customer||{},x=Array.isArray(o.lineItems)?o.lineItems:[],b={order_id:s.orderNumber||o.orderNumber||e.id,name:u.fullName||o.customerName||"Customer",phone:u.phone||o.phone||o.customerPhone||"",email:u.email||o.emailLower||"",address:[u.address1||u.address,u.address2,u.city,u.province||u.state,u.pincode||u.zip].filter(Boolean).join(", "),city:u.city||"",state:u.province||u.state||"",pin:u.pincode||u.zip||o.zip||"",payment_type:f>0?"COD":"Prepaid",cod_amount:f,collectable_amount:f,items:x.map(e=>({name:String(e.title||"Product"),sku:String(e.productId||e.id||""),qty:Math.max(1,d(e.quantity,1)),price:d(e.price?.amount??e.price)})),package:(l=s.package)?l:{package_type:String(process.env.DELHIVERY_PACKAGE_TYPE||"Cardboard Box"),length_cm:d(process.env.DELHIVERY_PACKAGE_LENGTH_CM,14),breadth_cm:d(process.env.DELHIVERY_PACKAGE_BREADTH_CM,12),height_cm:d(process.env.DELHIVERY_PACKAGE_HEIGHT_CM,12),weight_gm:d(process.env.DELHIVERY_PACKAGE_WEIGHT_GM,450)},shipping_mode:String(s.package?.shipping_mode||process.env.DELHIVERY_SHIPPING_MODE||"Surface"),pickup_location:String(process.env.DELHIVERY_PICKUP_LOCATION||"").trim(),seller:String(process.env.DELHIVERY_SELLER_NAME||"Succulent Sphere").trim()},y=await n(b),h=String(y?.waybill||y?.awb||y?.waybill_number||y?.data?.waybill||y?.data?.awb||"").trim(),w=String(y?.tracking_url||y?.url||"").trim()||`https://www.delhivery.com/track/package/${encodeURIComponent(h)}`;if(!h)throw Error("Delhivery did not return a tracking number.");let S=[{number:h,url:w,company:"Delhivery"}];await e.set({tracking:S,fulfillmentStatus:"SHIPPED",updatedAt:new Date().toISOString()},{merge:!0}),await r.set({status:"done",updatedAt:new Date().toISOString(),trackingNumber:h,result:y},{merge:!0});let v=String(o.emailLower||u.email||"").trim();if(/^\S+@\S+\.\S+$/.test(v))try{await (0,a.sendTrackingEmail)({orderId:e.id,orderNumber:d(o.orderNumber),customerName:String(u.fullName||o.customerName||"Customer"),customerEmail:v,trackingNumber:h,trackingUrl:w,carrier:"Delhivery"})}catch(t){await e.set({trackingEmailError:String(t.message||t).slice(0,300),updatedAt:new Date().toISOString()},{merge:!0})}return{ok:!0,trackingNumber:h,trackingUrl:w}}catch(e){throw await r.set({status:p>=8?"failed":"pending",updatedAt:new Date().toISOString(),lastError:String(e.message||e).slice(0,1e3)},{merge:!0}),e}}async function l(e=5){let t=(0,i.getFirebaseDb)(),[r,a]=await Promise.all([t.collection("shipments").where("status","==","pending").orderBy("createdAt").limit(e).get(),t.collection("shipments").where("status","==","processing").limit(e).get()]),o=Date.now()-6e5,d=[...r.docs,...a.docs.filter(e=>new Date(String(e.get("updatedAt")||0)).getTime()<o)].slice(0,e),n=[];for(let e of d)try{n.push({id:e.id,...await p(e.id)})}catch(t){n.push({id:e.id,ok:!1,error:String(t.message||t)})}return n}e.s(["enqueueShipment",()=>s,"processPendingShipments",()=>l,"processShipmentJob",()=>p]),r()}catch(e){r(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__b69e1414._.js.map