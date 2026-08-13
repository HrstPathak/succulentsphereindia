export type ShippingProgressInput = {
  fulfillmentStatus?: string;
  fulfillmentOrderStatuses?: string[];
  hasTracking?: boolean;
  tags?: string[];
  fulfillmentEvents?: string[];
};

export const SHIPPING_STEP_TITLES = [
  "Order Confirmed",
  "In Process",
  "Shipped",
  "Out for Delivery",
  "Delivered",
] as const;

export type ShippingPresentation = {
  step: number;
  label: string;
  trackerCaption: string;
  isDelivered: boolean;
  isOnHold: boolean;
  hasShipmentActivity: boolean;
};

function normalizeStatus(value: string | undefined | null): string {
  const cleaned = String(value || "")
    .trim()
    .replace(/\([^)]*\)/g, "");
  return cleaned
    .replace(/[0-9]+/g, "")
    .replace(/[^A-Za-z_ ]+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function normalizeList(values: Array<string | undefined | null> | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const flattened: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) continue;
    flattened.push(...parts);
  }
  return flattened.map((value) => normalizeStatus(value)).filter(Boolean);
}

function hasAny(set: Set<string>, ...candidates: string[]): boolean {
  return candidates.some((candidate) => set.has(candidate));
}

function hasMatch(list: string[], ...needles: string[]): boolean {
  return list.some((value) => needles.some((needle) => value.includes(needle)));
}

function prettifyStatus(value: string): string {
  const normalized = normalizeStatus(value);
  if (!normalized) return "";
  return normalized
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getShipmentStage(eventList: string[], hasTracking: boolean) {
  const events = new Set(eventList);

  if (hasAny(events, "DELIVERED") || hasMatch(eventList, "DELIVERED")) {
    return { step: 4, label: "Delivered", active: true };
  }

  if (
    hasAny(events, "OUT_FOR_DELIVERY", "ATTEMPTED_DELIVERY") ||
    hasMatch(eventList, "OUT_FOR_DELIVERY", "ATTEMPTED_DELIVERY")
  ) {
    return { step: 3, label: "Out for Delivery", active: true };
  }

  if (
    hasAny(
      events,
      "IN_TRANSIT",
      "CONFIRMED",
      "LABEL_PRINTED",
      "LABEL_PURCHASED",
      "CARRIER_PICKED_UP",
      "PICKED_UP",
      "READY_FOR_PICKUP",
      "ON_THE_WAY",
      "ON_THE_WAY_SHIPMENT",
      "PACKAGE_LOADED",
      "REACHED_DESTINATION_CITY",
      "IN_FACILITY",
      "DELAYED"
    ) ||
    hasMatch(
      eventList,
      "IN_TRANSIT",
      "CONFIRMED",
      "LABEL_PRINTED",
      "LABEL_PURCHASED",
      "CARRIER_PICKED_UP",
      "PICKED_UP",
      "READY_FOR_PICKUP",
      "ON_THE_WAY",
      "PACKAGE_LOADED",
      "REACHED_DESTINATION_CITY",
      "IN_FACILITY",
      "DELAYED"
    )
  ) {
    return { step: 2, label: "Shipped", active: true };
  }

  if (hasTracking) {
    return { step: 2, label: "Shipped", active: false };
  }

  return null;
}

function resolveWorkState(input: ShippingProgressInput) {
  const fulfillment = normalizeStatus(input.fulfillmentStatus);
  const fulfillmentOrders = new Set(normalizeList(input.fulfillmentOrderStatuses));
  const statuses = normalizeList(input.fulfillmentOrderStatuses);

  if (fulfillmentOrders.has("ON_HOLD") || fulfillment === "ON_HOLD") {
    return { key: "ON_HOLD", label: "On Hold" };
  }

  if (fulfillmentOrders.has("SCHEDULED") || fulfillment === "SCHEDULED") {
    return { key: "SCHEDULED", label: "Scheduled" };
  }

  if (
    fulfillment === "CANCELLED" ||
    fulfillment === "CANCELED" ||
    fulfillmentOrders.has("CANCELLED")
  ) {
    return { key: "CANCELLED", label: "Cancelled" };
  }

  if (
    fulfillment === "REQUEST_DECLINED" ||
    fulfillmentOrders.has("INCOMPLETE")
  ) {
    return { key: "INCOMPLETE", label: "Request Declined" };
  }

  if (
    fulfillment === "IN_PROGRESS" ||
    fulfillment === "PENDING_FULFILLMENT" ||
    fulfillmentOrders.has("IN_PROGRESS")
  ) {
    return { key: "IN_PROGRESS", label: "In Progress" };
  }

  if (
    fulfillment === "PARTIALLY_FULFILLED" ||
    fulfillment === "PARTIAL"
  ) {
    return { key: "PARTIALLY_FULFILLED", label: "Partially Fulfilled" };
  }

  if (
    fulfillment === "FULFILLED" ||
    fulfillment === "SHIPPED" ||
    fulfillment === "SUCCESS" ||
    fulfillmentOrders.has("CLOSED")
  ) {
    return { key: "FULFILLED", label: "Fulfilled" };
  }

  if (
    fulfillment === "UNFULFILLED" ||
    fulfillment === "OPEN" ||
    fulfillment === "RESTOCKED" ||
    fulfillmentOrders.has("OPEN")
  ) {
    return { key: "UNFULFILLED", label: "Unfulfilled" };
  }

  const firstKnown = statuses[0] || fulfillment;
  if (firstKnown) {
    return { key: firstKnown, label: prettifyStatus(firstKnown) };
  }

  return { key: "", label: "Order Confirmed" };
}

export function resolveShippingPresentation(input: ShippingProgressInput): ShippingPresentation {
  const hasTracking = Boolean(input.hasTracking);
  const tagList = normalizeList(input.tags);
  const eventList = [...normalizeList(input.fulfillmentEvents), ...tagList];
  const workState = resolveWorkState(input);
  const shipmentStage = getShipmentStage(eventList, hasTracking);

  if (shipmentStage) {
    return {
      step: shipmentStage.step,
      label: shipmentStage.label,
      trackerCaption:
        shipmentStage.step >= 4
          ? "Delhivery marked this shipment as delivered."
          : shipmentStage.step >= 3
            ? "Delhivery marked this shipment as out for delivery."
            : "Your order has been handed to Delhivery and is on the way.",
      isDelivered: shipmentStage.step >= 4,
      isOnHold: workState.key === "ON_HOLD",
      hasShipmentActivity: Boolean(shipmentStage.active),
    };
  }

  if (
    workState.key === "FULFILLED" ||
    workState.key === "PARTIALLY_FULFILLED" ||
    hasTracking
  ) {
    return {
      step: 2,
      label: "Shipped",
      trackerCaption: "Your order has been handed to Delhivery. Tracking updates will appear once scans come in.",
      isDelivered: false,
      isOnHold: workState.key === "ON_HOLD",
      hasShipmentActivity: false,
    };
  }

  if (workState.key === "IN_PROGRESS") {
    return {
      step: 1,
      label: "In Process",
      trackerCaption: "Your order is currently being packed.",
      isDelivered: false,
      isOnHold: false,
      hasShipmentActivity: false,
    };
  }

  return {
    step: 0,
    label: "Order Confirmed",
    trackerCaption:
      workState.key === "ON_HOLD"
        ? "Your order is confirmed and currently on hold."
        : "Your order has been confirmed and is waiting to be packed.",
    isDelivered: false,
    isOnHold: workState.key === "ON_HOLD",
    hasShipmentActivity: false,
  };
}

export function resolveShippingStep(input: ShippingProgressInput): number {
  return resolveShippingPresentation(input).step;
}

export function resolveShippingLabel(input: ShippingProgressInput): string {
  return resolveShippingPresentation(input).label;
}

export function resolveTrackingCaption(input: ShippingProgressInput): string {
  return resolveShippingPresentation(input).trackerCaption;
}

export function isDelivered(input: ShippingProgressInput): boolean {
  return resolveShippingPresentation(input).isDelivered;
}
