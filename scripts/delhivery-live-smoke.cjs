const orderReference = "1009(1)";
const token = String(process.env.DELHIVERY_API_TOKEN || "").trim();
if (!token) throw new Error("DELHIVERY_API_TOKEN is missing");

const payload = {
  format: "json",
  data: JSON.stringify({
    pickup_location: {
      name: process.env.DELHIVERY_PICKUP_LOCATION,
      city: process.env.DELHIVERY_SELLER_CITY || "Bhimtal",
      pin: process.env.DELHIVERY_PICKUP_PINCODE || "263136",
      country: "India",
      phone: process.env.DELHIVERY_CONTACT_PHONE,
      add: process.env.DELHIVERY_SELLER_ADDRESS || "Bhimtal, Uttarakhand",
    },
    shipments: [{
      name: process.env.DELHIVERY_CONTACT_NAME || "Harshit Pathak",
      add: process.env.DELHIVERY_SELLER_ADDRESS || "Bhimtal, Uttarakhand",
      city: process.env.DELHIVERY_SELLER_CITY || "Bhimtal",
      state: process.env.DELHIVERY_SELLER_STATE || "Uttarakhand",
      country: "India",
      pin: process.env.DELHIVERY_SELLER_PINCODE || "263136",
      phone: process.env.DELHIVERY_CONTACT_PHONE,
      email: process.env.DELHIVERY_CONTACT_EMAIL,
      order: orderReference,
      order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
      address_type: "home",
      payment_mode: "Prepaid",
      cod_amount: 0,
      total_amount: 100,
      shipping_mode: "Surface",
      weight: "450 gm",
      shipment_length: 14,
      shipment_width: 12,
      shipment_height: 12,
      package_type: "Cardboard Box",
      fragile_shipment: "false",
      products_desc: "Succulent",
      commodity_value: 100,
      quantity: 1,
      seller_name: process.env.DELHIVERY_SELLER_NAME || "Succulent Sphere",
      seller_add: process.env.DELHIVERY_SELLER_ADDRESS || "Bhimtal, Uttarakhand",
      seller_tin: process.env.DELHIVERY_SELLER_PAN,
      hsn_code: process.env.DELHIVERY_HSN_CODE || "060290",
      client: process.env.DELHIVERY_CLIENT_NAME || process.env.DELHIVERY_SELLER_NAME,
    }],
  }),
};

async function main() {
  const url = process.env.DELHIVERY_CREATE_URL || "https://track.delhivery.com/api/cmu/create.json";
  const body = "format=json&data=" + payload.data;
  const headers = {
    Accept: "application/json",
    Authorization: `Token ${token}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  console.log("DELHIVERY_OUTGOING_BODY:", body);
  console.log("DELHIVERY_OUTGOING_HEADERS:", { ...headers, Authorization: "Token <redacted>" });
  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
  });
  const text = await response.text();
  console.log("DELHIVERY_RAW_RESPONSE:", text);
  let result;
  try { result = JSON.parse(text); } catch { result = { raw: text }; }
  const packages = Array.isArray(result?.packages) ? result.packages : [];
  const waybills = packages.map((item) => String(item?.waybill || "").trim()).filter((value) => /^\d{10,}$/.test(value));
  console.log(JSON.stringify({
    httpStatus: response.status,
    orderReference,
    success: Boolean(result?.success) && waybills.length > 0,
    waybills,
    remarks: packages.map((item) => item?.remarks).filter(Boolean),
    response: result,
  }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exit(1); });
