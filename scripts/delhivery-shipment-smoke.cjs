const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");

function loadTypeScript(file) {
  const source = fs.readFileSync(file, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.paths = Module._nodeModulePaths(path.dirname(file));
  loaded._compile(output, file);
  return loaded.exports;
}

const shipment = loadTypeScript(
  path.join(process.cwd(), "src", "lib", "delhivery-shipment.ts"),
);

const company = {
  name: "Succulent Sphere",
  gstin: "",
  pan: "GHSPP4043R",
  address: "Bhimtal",
  city: "Bhimtal",
  state: "Uttarakhand",
  pincode: "263136",
  country: "India",
  contactName: "Harshit Pathak",
  phone: "9458321209",
  email: "succulentsphere@gmail.com",
  packagesPerMonth: 200,
  pickupLocation: "Registered Test Warehouse",
  pickupPincode: "263136",
  logoUrl: "",
  hsnCode: "060290",
};

const order = {
  orderNumber: 1014,
  createdAt: "2026-09-24T10:00:00.000Z",
  total: 654,
  payableAmount: 100,
  paymentMode: "cod_deposit",
  customer: {
    fullName: "Rose Maria",
    phone: "9876543210",
    email: "rose@example.com",
    address1: "Bhimtal",
    city: "Bhimtal",
    state: "Uttarakhand",
    pincode: "263136",
    country: "India",
  },
  lineItems: [
    { productId: "sku-1", title: "Succulents", quantity: 1, price: { amount: "654" } },
  ],
};

const defaultDetails = shipment.buildDelhiveryDetailsFromOrder(order, {
  boxes: [{ lengthCm: 14, widthCm: 12, heightCm: 12, weightGrams: 450 }],
  shippingMode: "Surface",
});
assert.equal(defaultDetails.confirmed, true);
assert.equal(defaultDetails.paymentMode, "COD");
assert.equal(defaultDetails.collectableAmount, 554);
assert.equal(defaultDetails.boxes.length, 1);

const details = shipment.normalizeDelhiveryDetails({
  ...defaultDetails,
  confirmed: true,
});

const metrics = shipment.calculateDelhiveryPackageMetrics(details.boxes);
assert.equal(metrics.actualWeightGrams, 450);
assert.equal(metrics.volumetricWeightGrams, 403);
assert.equal(metrics.chargeableWeightGrams, 450);

const errors = shipment.validateDelhiveryDetails({
  order,
  company,
  details,
  requireCompanyDetails: true,
});
assert.deepEqual(errors, []);

const payload = shipment.buildDelhiveryCreatePayload({
  order,
  company,
  clientName: "Registered Client",
  details,
});
assert.equal(payload.client, "Registered Client");
assert.equal(payload.pickup_location.name, "Registered Test Warehouse");
assert.equal(payload.shipments.length, 1);
assert.equal(payload.shipments[0].weight, "450 gm");
assert.equal(payload.shipments[0].shipment_length, 14);
assert.equal(payload.shipments[0].client, "Registered Client");
assert.equal("seller_gst_tin" in payload.shipments[0], false);
assert.equal(payload.shipments[0].hsn_code, "060290");

const multi = shipment.normalizeDelhiveryDetails({
  ...details,
  boxes: [
    details.boxes[0],
    { ...details.boxes[0], weightGrams: 500 },
  ],
});
const multiPayload = shipment.buildDelhiveryCreatePayload({
  order,
  company,
  clientName: "Registered Client",
  details: multi,
  waybills: ["123456789012", "123456789013"],
});
assert.equal(multiPayload.shipments.length, 2);
assert.equal(multiPayload.shipments[0].waybill, "123456789012");
assert.notEqual(multiPayload.shipments[0].order, multiPayload.shipments[1].order);
assert.equal(
  multiPayload.shipments.reduce((sum, shipment) => sum + Number(shipment.total_amount), 0),
  details.invoiceTotal,
);
assert.equal(
  multiPayload.shipments.reduce((sum, shipment) => sum + Number(shipment.cod_amount), 0),
  details.collectableAmount,
);

const handoff = shipment.buildDelhiveryManualHandoff({ company, details, order });
assert.equal(handoff["Order details — Order ID/reference"], "1014");
assert.match(String(handoff["Product & box details — Box 1"]), /14 × 12 × 12 cm/);

console.log("Delhivery shipment smoke test passed");
