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

function loadTypeScriptWithMocks(file, mocks) {
  const originalLoad = Module._load;
  Module._load = function mockedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return loadTypeScript(file);
  } finally {
    Module._load = originalLoad;
  }
}

const orderAmounts = loadTypeScript(
  path.join(process.cwd(), "src", "lib", "orderAmounts.ts"),
);
const shipment = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "delhivery-shipment.ts"),
  {
    "./orderAmounts": orderAmounts,
  },
);
const delhiveryTracking = loadTypeScript(
  path.join(process.cwd(), "src", "lib", "delhiveryTracking.ts"),
);
const delhiveryServer = loadTypeScriptWithMocks(
  path.join(process.cwd(), "src", "lib", "delhivery-server.ts"),
  {
    "server-only": {},
    "@/lib/delhivery-shipment": shipment,
    "@/lib/delhiveryTracking": delhiveryTracking,
  },
);

const delhiveryApi = loadTypeScript(
  path.join(process.cwd(), "src", "lib", "delhiveryApi.ts"),
);

function verifyEndpointModes() {
  const originalMode = process.env.DELHIVERY_MODE;
  const originalCreateUrl = process.env.DELHIVERY_CREATE_URL;
  try {
    delete process.env.DELHIVERY_CREATE_URL;
    process.env.DELHIVERY_MODE = "production";
    assert.equal(delhiveryServer.getDelhiveryApiMode(), "production");
    assert.equal(
      delhiveryServer.getDelhiveryCreateUrl(),
      "https://track.delhivery.com/api/cmu/create.json",
    );
    assert.equal(delhiveryServer.getDelhiveryEndpointMode(), "production");

    process.env.DELHIVERY_MODE = "staging";
    assert.equal(delhiveryServer.getDelhiveryApiMode(), "staging");
    assert.equal(
      delhiveryServer.getDelhiveryCreateUrl(),
      "https://staging-express.delhivery.com/api/cmu/create.json",
    );
    assert.equal(delhiveryServer.getDelhiveryEndpointMode(), "staging");

    process.env.DELHIVERY_MODE = "staging";
    process.env.DELHIVERY_CREATE_URL = "https://example.test/create.json";
    assert.equal(
      delhiveryServer.getDelhiveryCreateUrl(),
      "https://staging-express.delhivery.com/api/cmu/create.json",
    );
    assert.equal(delhiveryServer.getDelhiveryEndpointMode(), "staging");

    delete process.env.DELHIVERY_MODE;
    assert.equal(
      delhiveryServer.getDelhiveryCreateUrl(),
      "https://example.test/create.json",
    );
    assert.equal(delhiveryServer.getDelhiveryEndpointMode(), "production");
    process.env.DELHIVERY_MODE = "production";
    assert.equal(
      delhiveryServer.getDelhiveryEditUrl(),
      "https://track.delhivery.com/api/p/edit",
    );
    process.env.DELHIVERY_MODE = "staging";
    assert.equal(
      delhiveryServer.getDelhiveryEditUrl(),
      "https://staging-express.delhivery.com/api/p/edit",
    );
    delete process.env.DELHIVERY_MODE;
    assert.equal(
      delhiveryServer.getDelhiveryEditUrl(),
      "https://track.delhivery.com/api/p/edit",
    );
  } finally {
    if (originalMode == null) delete process.env.DELHIVERY_MODE;
    else process.env.DELHIVERY_MODE = originalMode;
    if (originalCreateUrl == null) delete process.env.DELHIVERY_CREATE_URL;
    else process.env.DELHIVERY_CREATE_URL = originalCreateUrl;
  }
}

async function verifyReadyToShipClient() {
  const originalFetch = global.fetch;
  let capturedRequest;
  try {
    global.fetch = async (url, init) => {
      capturedRequest = { url: String(url), init };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          destination: "ready_to_ship",
          waybills: ["UPL2091701343621419496"],
          trackingNumber: "UPL2091701343621419496",
          trackingUrl: "https://www.delhivery.com/track/package/UPL2091701343621419496",
        }),
      };
    };
    const result = await delhiveryApi.createReadyToShipOrder("order-1014");
    assert.equal(capturedRequest.url, "/api/admin/orders/create-shipment");
    assert.equal(capturedRequest.init.method, "POST");
    assert.deepEqual(JSON.parse(capturedRequest.init.body), {
      id: "order-1014",
      action: "ready_to_ship",
    });
    assert.equal(result.destination, "ready_to_ship");
    assert.equal(result.trackingNumber, "UPL2091701343621419496");
    assert.equal(
      result.trackingUrl,
      "https://www.delhivery.com/track/package/UPL2091701343621419496",
    );

    global.fetch = async (url, init) => {
      capturedRequest = { url: String(url), init };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          waybill: "UPL2091701343621419496",
          trackingNumber: "UPL2091701343621419496",
          trackingUrl: "https://www.delhivery.com/track/package/UPL2091701343621419496",
        }),
      };
    };
    const manifestUpdate = await delhiveryApi.updateDelhiveryManifest("order-1014");
    assert.equal(capturedRequest.url, "/api/admin/orders/create-shipment");
    assert.deepEqual(JSON.parse(capturedRequest.init.body), {
      id: "order-1014",
      action: "update_manifest",
    });
    assert.equal(manifestUpdate.waybill, "UPL2091701343621419496");

    global.fetch = async () => ({
      ok: false,
      status: 502,
      json: async () => ({
        ok: false,
        error: "Pincode is required for shipment creation.",
      }),
    });
    await assert.rejects(
      delhiveryApi.createReadyToShipOrder("order-1014"),
      (error) =>
        error instanceof delhiveryApi.DelhiveryApiError &&
        error.message === "Pincode is required for shipment creation.",
    );

    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, error: "Delhivery rejected the order." }),
    });
    await assert.rejects(
      delhiveryApi.createReadyToShipOrder("order-1014"),
      (error) =>
        error instanceof delhiveryApi.DelhiveryApiError &&
        error.message === "Delhivery rejected the order.",
    );
  } finally {
    global.fetch = originalFetch;
  }
}

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
  orderNumber: 1009,
  createdAt: "2026-09-24T10:00:00.000Z",
  total: 724,
  payableAmount: 100,
  paymentReceived: 100,
  codDepositAmount: 100,
  codBalance: 624,
  cod_balance: 624,
  paymentMode: "cod_deposit",
  customer: {
    fullName: "Harshit Pathak",
    phone: "9876543211",
    email: "harshit@example.com",
    address: "Bhimtal, near tower",
    city: "Bhimtal",
    state: "UK",
    pincode: "263136",
    country: "India",
  },
  lineItems: [
    { productId: "succulents", title: "Succulents", quantity: 10, price: { amount: "72.40" }, discountedTotalPrice: { amount: "724" } },
  ],
};

const defaultDetails = shipment.buildDelhiveryDetailsFromOrder(order, {
  boxes: [{ lengthCm: 14, widthCm: 12, heightCm: 12, weightGrams: 450 }],
  shippingMode: "Surface",
});
assert.equal(defaultDetails.confirmed, true);
assert.equal(defaultDetails.paymentMode, "COD");
assert.equal(defaultDetails.invoiceTotal, 724);
assert.equal(defaultDetails.collectableAmount, 624);
assert.equal(defaultDetails.boxes.length, 1);
assert.deepEqual(defaultDetails.items, [
  { title: "Succulents", sku: "1001", quantity: 10, unitPrice: 72.4 },
]);

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
  orderId: "order-1009",
  details,
  company,
});
assert.deepEqual(Object.keys(payload), ["shipments", "pickup_location"]);
assert.deepEqual(payload.pickup_location, {
  name: "Succulent Sphere",
});
assert.equal(payload.shipments.length, 1);
assert.deepEqual(payload.shipments[0], {
  name: "Harshit Pathak",
  add: "Bhimtal, near tower",
  pin: "263136",
  city: "Bhimtal",
  state: "UK",
  country: "India",
  phone: "9876543211",
  order: "1009",
  order_date: "2026-09-24 10:00:00",
  payment_mode: "COD",
  cod_amount: 624,
  total_amount: 724,
  commodity_value: 724,
  products_desc: "Succulents",
  quantity: "10",
  seller_name: "Succulent Sphere",
  seller_add: "Bhimtal, Bhimtal, Uttarakhand, 263136",
  seller_inv: "1009",
  hsn_code: "060290",
  shipment_length: 14,
  shipment_width: 12,
  shipment_height: 12,
  weight: "450 gm",
  package_type: "Cardboard Box",
  fragile_shipment: "false",
  shipping_mode: "Surface",
  address_type: "home",
  client: "e3ac15-SucculentSphere-do",
});

const editPayload = shipment.buildDelhiveryManifestEditPayload({
  order,
  orderId: "order-1009",
  awb: "51428210001422",
  details,
});
assert.deepEqual(editPayload, {
  waybill: "51428210001422",
  shipment_length: "14.00",
  shipment_width: "12.00",
  shipment_height: "12.00",
  cod: "624.00",
  gm: "450.00",
  name: "Harshit Pathak",
  add: "Bhimtal, near tower",
  product_details: "Succulents | Quantity: 10 | Total price: INR 724.00",
  pt: "COD",
});
for (const field of [
  "shipment_length",
  "shipment_width",
  "shipment_height",
  "cod",
  "gm",
]) {
  assert.match(
    String(editPayload[field]),
    /^\d+\.\d{2}$/,
    `${field} must be sent as a decimal string for the Delhivery Edit API`,
  );
}

const fallbackOrder = {
  id: "fallback-order-id",
  paymentMode: "Prepaid",
  totalPrice: { amount: 500 },
  customer: {
    name: "Fallback Customer",
    address: "Fallback Address",
    province: "Uttarakhand",
    zip: "263136",
    city: "Bhimtal",
  },
};
const fallbackDetails = shipment.buildDelhiveryDetailsFromOrder(fallbackOrder);
const fallbackPayload = shipment.buildDelhiveryCreatePayload({
  order: fallbackOrder,
  orderId: "unused-order-id",
  details: fallbackDetails,
});
assert.deepEqual(shipment.getConfirmedShipmentWaybills(order, {
  status: "failed",
  waybills: ["99999999999999"],
}), []);
assert.deepEqual(shipment.getConfirmedShipmentWaybills({
  tracking: [{ number: "51428210001422" }],
}, {
  status: "failed",
  waybills: ["99999999999999"],
}), ["51428210001422"]);
assert.deepEqual(shipment.getConfirmedShipmentWaybills({}, {
  status: "done",
  waybills: ["UPL2091701343621419496"],
}), ["UPL2091701343621419496"]);
assert.equal(fallbackPayload.shipments[0].name, "Customer");
assert.equal(fallbackPayload.shipments[0].add, "Fallback Address");
assert.equal(fallbackPayload.shipments[0].state, "Uttarakhand");
assert.equal(fallbackPayload.shipments[0].pin, "263136");
assert.equal(fallbackPayload.shipments[0].order, "fallback-order-id");
assert.equal(fallbackPayload.shipments[0].payment_mode, "Prepaid");
assert.equal(fallbackPayload.shipments[0].cod_amount, 0);

const amountCases = [
  {
    name: "partial COD deposit",
    order: { total: 724, paymentMode: "cod_deposit", paymentReceived: 100 },
    expected: { paymentMode: "COD", invoiceTotal: 724, collectableAmount: 624, paidAmount: 100, depositAmount: 100 },
  },
  {
    name: "legacy COD deposit without explicit amount",
    order: { total: 724, paymentMode: "cod_deposit" },
    expected: { paymentMode: "COD", invoiceTotal: 724, collectableAmount: 624, paidAmount: 100, depositAmount: 100 },
  },
  {
    name: "full COD",
    order: { total: 500, paymentMode: "COD" },
    expected: { paymentMode: "COD", invoiceTotal: 500, collectableAmount: 500, paidAmount: 0 },
  },
  {
    name: "cash on delivery",
    order: { total: 500, paymentMode: "Cash on Delivery" },
    expected: { paymentMode: "COD", invoiceTotal: 500, collectableAmount: 500, paidAmount: 0 },
  },
  {
    name: "prepaid",
    order: { total: 500, paymentMode: "Prepaid", paymentReceived: 500 },
    expected: { paymentMode: "Prepaid", invoiceTotal: 500, collectableAmount: 0, paidAmount: 500 },
  },
  {
    name: "explicit remaining COD balance",
    order: { total: 724, paymentMode: "cod_deposit", codBalance: 600, codDepositAmount: 100 },
    expected: { paymentMode: "COD", invoiceTotal: 724, collectableAmount: 600, paidAmount: 124, depositAmount: 100 },
  },
  {
    name: "partial COD deposit plus wallet",
    order: {
      total: 724,
      paymentMode: "cod_deposit",
      codDepositAmount: 100,
      walletAmountUsed: 50,
    },
    expected: { paymentMode: "COD", invoiceTotal: 724, collectableAmount: 574, paidAmount: 150, depositAmount: 100 },
  },
  {
    name: "fully paid COD deposit becomes Prepaid for carrier",
    order: {
      total: 100,
      paymentMode: "cod_deposit",
      paymentReceived: 100,
      codBalance: 0,
    },
    expected: { paymentMode: "Prepaid", invoiceTotal: 100, collectableAmount: 0, paidAmount: 100, depositAmount: 100 },
  },
  {
    name: "legacy zero total uses current total",
    order: {
      total: 0,
      currentTotalPrice: { amount: 724 },
      paymentMode: "cod_deposit",
      paymentReceived: 100,
    },
    expected: { paymentMode: "COD", invoiceTotal: 724, collectableAmount: 624, paidAmount: 100, depositAmount: 100 },
  },
  {
    name: "composed subtotal includes COD fee",
    order: {
      total: 0,
      subtotal: 674,
      codFee: 50,
      paymentMode: "cod_deposit",
      paymentReceived: 100,
    },
    expected: { paymentMode: "COD", invoiceTotal: 724, collectableAmount: 624, paidAmount: 100, depositAmount: 100 },
  },
  {
    name: "explicit prepaid wins over stale COD metadata",
    order: {
      total: 500,
      paymentMode: "Prepaid",
      codBalance: 100,
    },
    expected: { paymentMode: "Prepaid", invoiceTotal: 500, collectableAmount: 0, paidAmount: 500 },
  },
  {
    name: "line-item total fallback",
    order: {
      paymentMode: "Prepaid",
      lineItems: [{ quantity: 2, price: { amount: "250" } }],
    },
    expected: { paymentMode: "Prepaid", invoiceTotal: 500, collectableAmount: 0, paidAmount: 500 },
  },
];
for (const amountCase of amountCases) {
  assert.deepEqual(
    shipment.getDelhiveryOrderAmounts(amountCase.order),
    {
      ...amountCase.expected,
      depositAmount: amountCase.expected.depositAmount ?? 0,
    },
    amountCase.name,
  );
}

const paymentSummaryCases = [
  {
    name: "legacy order 1009 partial COD",
    order: { total: 724, paymentMode: "cod_deposit" },
    expected: { paymentMode: "COD", grandTotal: 724, paidAmount: 100, depositAmount: 100, codBalance: 624, walletAmount: 0 },
  },
  {
    name: "prepaid ignores stale COD metadata",
    order: { total: 500, paymentMode: "Prepaid", codBalance: 100 },
    expected: { paymentMode: "Prepaid", grandTotal: 500, paidAmount: 500, depositAmount: 0, codBalance: 0, walletAmount: 0 },
  },
  {
    name: "COD with wallet payment",
    order: { total: 724, paymentMode: "cod_deposit", codDepositAmount: 100, walletAmountUsed: 50 },
    expected: { paymentMode: "COD", grandTotal: 724, paidAmount: 150, depositAmount: 100, codBalance: 574, walletAmount: 50 },
  },
  {
    name: "zero legacy total uses current total",
    order: { total: 0, currentTotalPrice: { amount: 724 }, paymentMode: "cod_deposit" },
    expected: { paymentMode: "COD", grandTotal: 724, paidAmount: 100, depositAmount: 100, codBalance: 624, walletAmount: 0 },
  },
];
for (const paymentCase of paymentSummaryCases) {
  assert.deepEqual(
    orderAmounts.getOrderPaymentSummary(paymentCase.order),
    paymentCase.expected,
    paymentCase.name,
  );
}

const handoff = shipment.buildDelhiveryManualHandoff({ company, details, order });
assert.equal(handoff["Order details — Order ID/reference"], "1009");
assert.match(String(handoff["Product & box details — Box 1"]), /14 × 12 × 12 cm/);

async function verifyExistingAwbShortCircuit() {
  const existingOrderId = "existing-awb-order";
  const existingAwb = "51428210001422";
  const documents = {
    [existingOrderId]: {
      order: {
        orderId: existingOrderId,
        orderNumber: 1009,
        tracking: [{ number: existingAwb, company: "Delhivery" }],
        fulfillmentStatus: "SHIPPED",
      },
      shipment: {
        orderId: existingOrderId,
        orderNumber: 1009,
        status: "failed",
        attempts: 18,
        lastError: "An internal Error has occurred",
        waybills: [existingAwb],
        completedAt: "2026-09-24T11:51:38.628Z",
      },
    },
  };
  let createCalls = 0;
  let serviceabilityCalls = 0;
  const documentRef = (collectionName, id) => {
    const kind = collectionName === "orders" ? "order" : "shipment";
    return {
      id,
      get: async () => ({
        exists: Boolean(documents[id]?.[kind]),
        data: () => documents[id]?.[kind] || null,
      }),
      set: async (value) => {
        documents[id][kind] = { ...(documents[id][kind] || {}), ...value };
      },
    };
  };
  const fakeDb = {
    collection: (name) => ({ doc: (id) => documentRef(name, id) }),
  };
  const shipping = loadTypeScriptWithMocks(
    path.join(process.cwd(), "src", "lib", "shipping.ts"),
    {
      "server-only": {},
      "@/lib/firebase-admin": { getFirebaseDb: () => fakeDb },
      "@/lib/delhivery-shipment": shipment,
      "@/lib/delhivery-server": {
        checkDelhiveryServiceability: async () => {
          serviceabilityCalls += 1;
          throw new Error("Serviceability must not run for an existing AWB.");
        },
        createDelhiveryShipment: async () => {
          createCalls += 1;
          throw new Error("Delhivery must not be called for an existing AWB.");
        },
        editDelhiveryShipment: async () => {
          throw new Error("Manifest editing must not run during create short-circuit.");
        },
        getDelhiveryAdminConfig: () => ({}),
        getDelhiveryCompanyDetails: () => ({}),
        getDelhiveryRateQuote: async () => [],
        isDelhiveryApiConfigured: () => true,
      },
      "@/lib/order-email": { sendTrackingEmail: async () => undefined },
      "@/lib/delhiveryTracking": delhiveryTracking,
    },
  );

  const result = await shipping.processShipmentJob(existingOrderId);
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "already_created");
  assert.deepEqual(result.waybills, [existingAwb]);
  assert.equal(createCalls, 0);
  assert.equal(serviceabilityCalls, 0);
  assert.equal(documents[existingOrderId].shipment.status, "done");
  assert.equal(documents[existingOrderId].shipment.lastError, null);
  assert.equal(documents[existingOrderId].shipment.attempts, 18);
  assert.equal(
    documents[existingOrderId].shipment.completedAt,
    "2026-09-24T11:51:38.628Z",
  );
}

async function verifyManifestUpdateOrchestration() {
  const orderId = "manifest-update-order";
  const awb = "51428210001422";
  const documents = {
    [orderId]: {
      order: {
        ...order,
        orderId,
        awb,
        tracking: [{ number: awb, company: "Delhivery" }],
        fulfillmentStatus: "SHIPPED",
      },
      shipment: {
        orderId,
        status: "done",
        waybills: [awb],
        trackingNumber: awb,
        trackingUrl: delhiveryTracking.buildDelhiveryTrackingUrl(awb),
      },
    },
  };
  let createCalls = 0;
  let editCalls = 0;
  let serviceabilityCalls = 0;
  let editInput = null;
  const documentRef = (collectionName, id) => {
    const kind = collectionName === "orders" ? "order" : "shipment";
    return {
      id,
      get: async () => ({
        exists: Boolean(documents[id]?.[kind]),
        data: () => documents[id]?.[kind] || null,
      }),
      set: async (value) => {
        documents[id][kind] = { ...(documents[id][kind] || {}), ...value };
      },
    };
  };
  const fakeDb = {
    collection: (name) => ({ doc: (id) => documentRef(name, id) }),
  };
  const shipping = loadTypeScriptWithMocks(
    path.join(process.cwd(), "src", "lib", "shipping.ts"),
    {
      "server-only": {},
      "@/lib/firebase-admin": { getFirebaseDb: () => fakeDb },
      "@/lib/delhivery-shipment": shipment,
      "@/lib/delhiveryTracking": delhiveryTracking,
      "@/lib/delhivery-server": {
        checkDelhiveryServiceability: async () => {
          serviceabilityCalls += 1;
          throw new Error("Serviceability must not run while editing a manifest.");
        },
        createDelhiveryShipment: async () => {
          createCalls += 1;
          throw new Error("Editing a manifest must not create a shipment.");
        },
        editDelhiveryShipment: async (input) => {
          editCalls += 1;
          editInput = input;
          return {
            waybill: awb,
            orderId: "1009",
            raw: { status: true, waybill: awb, order_id: "1009" },
            payload: shipment.buildDelhiveryManifestEditPayload({
              order: input.order,
              orderId: input.orderId,
              awb: input.awb,
              details: input.details,
            }),
          };
        },
        getDelhiveryAdminConfig: () => ({}),
        getDelhiveryCompanyDetails: () => ({}),
        getDelhiveryRateQuote: async () => [],
        isDelhiveryApiConfigured: () => true,
      },
      "@/lib/order-email": { sendTrackingEmail: async () => undefined },
    },
  );

  const result = await shipping.updateDelhiveryManifest(orderId);
  assert.equal(result.ok, true);
  assert.equal(result.waybill, awb);
  assert.equal(createCalls, 0);
  assert.equal(serviceabilityCalls, 0);
  assert.equal(editCalls, 1);
  assert.equal(editInput.awb, awb);
  assert.equal(editInput.details.collectableAmount, 624);
  assert.equal(editInput.details.boxes[0].weightGrams, 450);
  assert.equal(documents[orderId].shipment.status, "done");
  assert.equal(documents[orderId].shipment.trackingNumber, awb);
  assert.ok(documents[orderId].shipment.manifestUpdatedAt);
  assert.deepEqual(documents[orderId].shipment.manifestEditResult, {
    status: true,
    waybill: awb,
    order_id: "1009",
  });
  assert.equal(documents[orderId].shipment.manifestEditPayload.cod, "624.00");
  assert.equal(documents[orderId].shipment.manifestEditPayload.gm, "450.00");
  assert.equal(
    documents[orderId].shipment.manifestEditPayload.shipment_length,
    "14.00",
  );
  assert.equal(
    documents[orderId].shipment.manifestEditPayload.shipment_width,
    "12.00",
  );
  assert.equal(
    documents[orderId].shipment.manifestEditPayload.shipment_height,
    "12.00",
  );
}

async function verifyAutomaticShipmentSuccess() {
  const orderId = "automatic-order-1015";
  const awb = "UPL2091701343621419501";
  const trackingUrl = `https://www.delhivery.com/track/package/${awb}`;
  const documents = {
    [orderId]: {
      order: { ...order, orderId, tracking: [] },
      shipment: null,
    },
  };
  const shipmentStatuses = [];
  const emails = [];
  let serviceabilityCalls = 0;
  let createCalls = 0;
  const documentRef = (collectionName, id) => {
    const kind = collectionName === "orders" ? "order" : "shipment";
    return {
      id,
      get: async () => ({
        exists: Boolean(documents[id]?.[kind]),
        data: () => documents[id]?.[kind] || null,
      }),
      set: async (value) => {
        if (kind === "shipment" && value.status) {
          shipmentStatuses.push(value.status);
        }
        documents[id][kind] = { ...(documents[id][kind] || {}), ...value };
      },
    };
  };
  const transaction = {
    get: async (ref) => ref.get(),
    set: async (ref, value, options) => ref.set(value, options),
  };
  const fakeDb = {
    collection: (name) => ({ doc: (id) => documentRef(name, id) }),
    runTransaction: async (callback) => callback(transaction),
  };
  const shipping = loadTypeScriptWithMocks(
    path.join(process.cwd(), "src", "lib", "shipping.ts"),
    {
      "server-only": {},
      "@/lib/firebase-admin": { getFirebaseDb: () => fakeDb },
      "@/lib/delhivery-shipment": shipment,
      "@/lib/delhiveryTracking": delhiveryTracking,
      "@/lib/delhivery-server": {
        checkDelhiveryServiceability: async () => {
          serviceabilityCalls += 1;
          return { paymentServiceable: true, message: "Serviceable" };
        },
        createDelhiveryShipment: async () => {
          createCalls += 1;
          return {
            waybills: [awb],
            packageResults: [{ waybill: awb }],
            raw: { success: true, upload_wbn: awb },
          };
        },
        getDelhiveryAdminConfig: () => ({}),
        getDelhiveryCompanyDetails: () => ({}),
        getDelhiveryRateQuote: async () => [],
        isDelhiveryApiConfigured: () => true,
      },
      "@/lib/order-email": {
        sendTrackingEmail: async (input) => {
          emails.push(input);
          return { sent: true, skipped: false };
        },
      },
    },
  );

  const result = await shipping.createAutomaticShipmentForOrder(orderId, {
    orderNumber: 1015,
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "done");
  assert.deepEqual(result.waybills, [awb]);
  assert.equal(result.trackingNumber, awb);
  assert.equal(result.trackingUrl, trackingUrl);
  assert.equal(serviceabilityCalls, 1);
  assert.equal(createCalls, 1);
  assert.ok(shipmentStatuses.includes("pending"));
  assert.ok(shipmentStatuses.includes("processing"));
  assert.equal(shipmentStatuses.at(-1), "done");
  assert.equal(documents[orderId].order.awb, awb);
  assert.equal(documents[orderId].order.fulfillmentStatus, "SHIPPED");
  assert.deepEqual(documents[orderId].order.tracking, [
    { number: awb, url: trackingUrl, company: "Delhivery" },
  ]);
  assert.equal(documents[orderId].shipment.awb, awb);
  assert.equal(documents[orderId].shipment.trackingNumber, awb);
  assert.equal(documents[orderId].shipment.trackingUrl, trackingUrl);
  assert.equal(documents[orderId].shipment.status, "done");
  assert.equal(emails.length, 1);
  assert.equal(emails[0].trackingNumber, awb);
  assert.equal(emails[0].trackingUrl, trackingUrl);

  const duplicate = await shipping.createAutomaticShipmentForOrder(orderId, {
    orderNumber: 1015,
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.skipped, true);
  assert.deepEqual(duplicate.waybills, [awb]);
  assert.equal(duplicate.trackingUrl, trackingUrl);
  assert.equal(createCalls, 1);
}

async function verifyCreateRequest() {
  const originalFetch = global.fetch;
  const originalToken = process.env.DELHIVERY_API_TOKEN;
  const originalMode = process.env.DELHIVERY_MODE;
  const originalCreateUrl = process.env.DELHIVERY_CREATE_URL;
  let capturedRequest;
  process.env.DELHIVERY_API_TOKEN = "test-token";
  process.env.DELHIVERY_MODE = "production";
  delete process.env.DELHIVERY_CREATE_URL;
  global.fetch = async (url, init) => {
    capturedRequest = { url: String(url), init };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: true,
        packages: [{ waybill: "UPL2091701343621419496" }],
      }),
    };
  };

  try {
    const result = await delhiveryServer.createDelhiveryShipment({
      order,
      orderId: "order-1014",
      details,
    });
    assert.deepEqual(result.waybills, ["UPL2091701343621419496"]);
    assert.equal(capturedRequest.url, "https://track.delhivery.com/api/cmu/create.json");
    assert.equal(capturedRequest.init.headers["Content-Type"], "application/x-www-form-urlencoded");
    assert.match(capturedRequest.init.body, /^format=json&data=%7B%22shipments%22/);
    const form = new URLSearchParams(capturedRequest.init.body);
    assert.equal(form.get("format"), "json");
    const requestPayload = JSON.parse(form.get("data"));
    assert.deepEqual(requestPayload, shipment.buildDelhiveryCreatePayload({
      order,
      orderId: "order-1009",
      details,
      company: delhiveryServer.getDelhiveryCompanyDetails(),
    }));

    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: true,
        upload_wbn: "UPL2091701343621419497",
      }),
    });
    const rootWaybillResult = await delhiveryServer.createDelhiveryShipment({
      order,
      orderId: "order-1014",
      details,
    });
    assert.deepEqual(rootWaybillResult.waybills, ["UPL2091701343621419497"]);

    const originalConsoleError = console.error;
    const loggedErrors = [];
    console.error = (...args) => loggedErrors.push(args);
    try {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          success: false,
          rmk: "Pincode is required for shipment creation.",
        }),
      });
      await assert.rejects(
        delhiveryServer.createDelhiveryShipment({
          order,
          orderId: "order-1014",
          details,
        }),
        (error) => error.message === "Pincode is required for shipment creation.",
      );
      assert.deepEqual(loggedErrors, [[
        "Delhivery API Error:",
        { success: false, rmk: "Pincode is required for shipment creation." },
      ]]);

      global.fetch = async () => ({
        ok: false,
        status: 422,
        text: async () => JSON.stringify({
          success: false,
          rmk: "Recipient phone is invalid.",
        }),
      });
      await assert.rejects(
        delhiveryServer.createDelhiveryShipment({
          order,
          orderId: "order-1014",
          details,
        }),
        (error) => error.message === "Recipient phone is invalid.",
      );
      assert.deepEqual(loggedErrors[1], [
        "Delhivery API Error:",
        { success: false, rmk: "Recipient phone is invalid." },
      ]);
    } finally {
      console.error = originalConsoleError;
    }
  } finally {
    global.fetch = originalFetch;
    if (originalToken == null) delete process.env.DELHIVERY_API_TOKEN;
    else process.env.DELHIVERY_API_TOKEN = originalToken;
    if (originalMode == null) delete process.env.DELHIVERY_MODE;
    else process.env.DELHIVERY_MODE = originalMode;
    if (originalCreateUrl == null) delete process.env.DELHIVERY_CREATE_URL;
    else process.env.DELHIVERY_CREATE_URL = originalCreateUrl;
  }
}

async function verifyEditRequest() {
  const originalFetch = global.fetch;
  const originalToken = process.env.DELHIVERY_API_TOKEN;
  const originalMode = process.env.DELHIVERY_MODE;
  let capturedRequest;
  process.env.DELHIVERY_API_TOKEN = "test-token";
  process.env.DELHIVERY_MODE = "production";
  try {
    global.fetch = async (url, init) => {
      capturedRequest = { url: String(url), init };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          status: true,
          waybill: "51428210001422",
          order_id: "1009",
        }),
      };
    };
    const result = await delhiveryServer.editDelhiveryShipment({
      order,
      orderId: "order-1009",
      awb: "51428210001422",
      details,
    });
    assert.equal(capturedRequest.url, "https://track.delhivery.com/api/p/edit");
    assert.equal(capturedRequest.init.method, "POST");
    assert.equal(capturedRequest.init.headers["Content-Type"], "application/json");
    assert.equal(capturedRequest.init.headers.Authorization, "Token test-token");
    assert.deepEqual(JSON.parse(capturedRequest.init.body), editPayload);
    assert.equal(result.waybill, "51428210001422");
    assert.equal(result.orderId, "1009");

    const originalConsoleError = console.error;
    const loggedErrors = [];
    console.error = (...args) => loggedErrors.push(args);
    try {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          status: "Failure",
          waybill: "51428210001422",
          order_id: "1009",
          error: "Shipment data cannot be changed as Current status is Picked Up",
        }),
      });
      await assert.rejects(
        delhiveryServer.editDelhiveryShipment({
          order,
          orderId: "order-1009",
          awb: "51428210001422",
          details,
        }),
        (error) => error.message === "Shipment data cannot be changed as Current status is Picked Up",
      );
      assert.deepEqual(loggedErrors, [[
        "Delhivery API Error:",
        {
          status: "Failure",
          waybill: "51428210001422",
          order_id: "1009",
          error: "Shipment data cannot be changed as Current status is Picked Up",
        },
      ]]);
    } finally {
      console.error = originalConsoleError;
    }
  } finally {
    global.fetch = originalFetch;
    if (originalToken == null) delete process.env.DELHIVERY_API_TOKEN;
    else process.env.DELHIVERY_API_TOKEN = originalToken;
    if (originalMode == null) delete process.env.DELHIVERY_MODE;
    else process.env.DELHIVERY_MODE = originalMode;
  }
}

function verifyStateNameResolution() {
  // Delhivery's pin-code API returns a state code, not a name, for most
  // pincodes. The manifest needs the full name, so codes must be expanded.
  assert.equal(
    delhiveryTracking.resolveDelhiveryStateName("UK"),
    "Uttarakhand",
  );
  assert.equal(delhiveryTracking.resolveDelhiveryStateName("DL"), "Delhi");
  assert.equal(
    delhiveryTracking.resolveDelhiveryStateName("MH"),
    "Maharashtra",
  );
  assert.equal(
    delhiveryTracking.resolveDelhiveryStateName("ka"),
    "Karnataka",
  );
  // Lowercase and already-full names pass through unchanged.
  assert.equal(
    delhiveryTracking.resolveDelhiveryStateName("Uttarakhand"),
    "Uttarakhand",
  );
  assert.equal(
    delhiveryTracking.resolveDelhiveryStateName("California"),
    "California",
  );
  // An unknown code is returned as-is rather than blanked out.
  assert.equal(delhiveryTracking.resolveDelhiveryStateName("ZZ"), "ZZ");
  assert.equal(delhiveryTracking.resolveDelhiveryStateName(""), "");
  assert.equal(delhiveryTracking.resolveDelhiveryStateName(null), "");
}

function verifyOrderReferenceSequencing() {
  // Sequence 1 keeps the plain order number so existing behaviour is unchanged.
  assert.equal(delhiveryTracking.buildDelhiveryOrderReference("1009", 1), "1009");
  assert.equal(delhiveryTracking.buildDelhiveryOrderReference("1009", 2), "1009(2)");
  assert.equal(delhiveryTracking.buildDelhiveryOrderReference("1009", 3), "1009(3)");
  assert.equal(delhiveryTracking.buildDelhiveryOrderReference("SS-1", 2), "SS-1(2)");
  assert.equal(delhiveryTracking.buildDelhiveryOrderReference("1009", 0), "1009");
  assert.equal(delhiveryTracking.buildDelhiveryOrderReference("", 3), "");

  // The next sequence always continues past what has already been used.
  assert.equal(delhiveryTracking.nextDelhiverySequence("1009", []), 2);
  assert.equal(delhiveryTracking.nextDelhiverySequence("1009", ["1009"]), 2);
  assert.equal(
    delhiveryTracking.nextDelhiverySequence("1009", ["1009", "1009(2)"]),
    3,
  );
  assert.equal(
    delhiveryTracking.nextDelhiverySequence("1009", [
      "1009",
      "1009(2)",
      "1009(3)",
    ]),
    4,
  );
  // A gap must not cause a collision with an existing reference.
  assert.equal(
    delhiveryTracking.nextDelhiverySequence("1009", ["1009", "1009(3)"]),
    4,
  );
  // Unrelated references are ignored.
  assert.equal(
    delhiveryTracking.nextDelhiverySequence("1009", ["2009", "2009(2)"]),
    2,
  );
}

function verifyManualOrderParser() {
  // The exact shape from the admin's WhatsApp workflow.
  const pasted = delhiveryTracking.parseManualOrderText(
    [
      "SS-1",
      "harshit pathak",
      "9087654321",
      "hpathak1238@gmail.com",
      "bhimgola, bhimtal, uttarakhand",
      "263136",
    ].join("\n"),
  );
  assert.equal(pasted.orderId, "SS-1");
  assert.equal(pasted.name, "harshit pathak");
  assert.equal(pasted.phone, "9087654321");
  assert.equal(pasted.email, "hpathak1238@gmail.com");
  assert.equal(pasted.address, "bhimgola, bhimtal, uttarakhand");
  assert.equal(pasted.pincode, "263136");
  assert.equal(pasted.city, "bhimtal");
  assert.equal(pasted.state, "uttarakhand");

  // Labelled input routes each value to the right field.
  const labelled = delhiveryTracking.parseManualOrderText(
    [
      "Name: Rajesh Kumar",
      "Address: 12 Gandhi Road, Almora, Uttarakhand",
      "Phone: +91 98765 43210",
      "Email: Rk@Test.com",
      "Pincode: 263601",
      "Total: Rs. 1450",
    ].join("\n"),
  );
  assert.equal(labelled.name, "Rajesh Kumar");
  assert.equal(labelled.address, "12 Gandhi Road, Almora, Uttarakhand");
  assert.equal(labelled.phone, "9876543210", "leading +91 should be stripped");
  assert.equal(labelled.email, "rk@test.com", "email should be lower-cased");
  assert.equal(labelled.pincode, "263601");
  assert.equal(labelled.amount, "1450");
  assert.equal(labelled.city, "Almora");
  assert.equal(labelled.state, "Uttarakhand");

  // Country-code and spaced phone numbers normalise to 10 digits.
  const spaced = delhiveryTracking.parseManualOrderText(
    "SS-7\nAnita Sharma\n+91 98123 45678\n263001",
  );
  assert.equal(spaced.orderId, "SS-7");
  assert.equal(spaced.name, "Anita Sharma");
  assert.equal(spaced.phone, "9812345678");
  assert.equal(spaced.pincode, "263001");
  assert.equal(spaced.email, "", "email is optional");

  // A pure-numeric order id is still detected.
  const numeric = delhiveryTracking.parseManualOrderText(
    "1009\nKiran Malhotra\n9998887776\n263145",
  );
  assert.equal(numeric.orderId, "1009");
  assert.equal(numeric.name, "Kiran Malhotra");

  // Empty input must not throw and must return a blank draft.
  const empty = delhiveryTracking.parseManualOrderText("");
  assert.equal(empty.orderId, "");
  assert.equal(empty.phone, "");
  assert.equal(empty.paymentMode, "COD");
}

function verifyAdditionalShipmentReference() {
  const order = {
    orderNumber: "1009",
    customer: {
      fullName: "Harshit Pathak",
      phone: "9087654321",
      address1: "Bhimgola, Bhimtal",
      pincode: "263136",
      city: "Bhimtal",
      state: "Uttarakhand",
    },
    lineItems: [{ title: "Succulents", quantity: 2, price: 500 }],
    total: 1000,
    paymentMode: "COD",
    cod_balance: 1000,
  };
  const details = shipment.buildDelhiveryDetailsFromOrder(order);

  const first = shipment.buildDelhiveryCreatePayload({
    order,
    orderId: "order-1009",
    details,
  });
  assert.equal(first.shipments[0].order, "1009");

  // An additional shipment must send a distinct `order` reference, otherwise
  // Delhivery rejects it as a duplicate.
  const second = shipment.buildDelhiveryCreatePayload({
    order,
    orderId: "order-1009",
    details,
    orderReference: "1009(2)",
  });
  assert.equal(second.shipments[0].order, "1009(2)");
  assert.equal(second.shipments[0].seller_inv, "1009(2)");

  // Every other manifest field must be identical between the two shipments;
  // only the two reference fields (`order` and `seller_inv`) may differ.
  const { order: _o1, seller_inv: _i1, ...firstRest } = first.shipments[0];
  const { order: _o2, seller_inv: _i2, ...secondRest } = second.shipments[0];
  assert.deepEqual(firstRest, secondRest);
  assert.equal(second.shipments[0].shipment_length, 14);
  assert.equal(second.shipments[0].shipment_width, 12);
  assert.equal(second.shipments[0].shipment_height, 12);
  assert.equal(second.shipments[0].weight, "450 gm");
  assert.equal(second.shipments[0].products_desc, "Succulents");
  assert.equal(second.shipments[0].payment_mode, "COD");
  assert.equal(second.shipments[0].cod_amount, 1000);
  assert.equal(second.pickup_location.name, "Succulent Sphere");
  assert.equal(second.shipments[0].client, "e3ac15-SucculentSphere-do");
}

async function runSmokeTests() {
  verifyEndpointModes();
  verifyStateNameResolution();
  verifyOrderReferenceSequencing();
  verifyManualOrderParser();
  verifyAdditionalShipmentReference();
  await verifyExistingAwbShortCircuit();
  await verifyManifestUpdateOrchestration();
  await verifyAutomaticShipmentSuccess();
  await verifyCreateRequest();
  await verifyEditRequest();
  await verifyReadyToShipClient();
}

runSmokeTests()
  .then(() => console.log("Delhivery shipment smoke test passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
