import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { buildDelhiveryManualHandoff } from "@/lib/delhivery-shipment";
import {
  checkAndQuoteShipment,
  getShipmentJob,
  getShipmentWorkspace,
  prepareManualShipment,
  processShipmentJob,
  retryShipment,
  saveShipmentDetails,
} from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorStatus(error: unknown) {
  const code = String((error as Error & { code?: string })?.code || "");
  if (code === "INVALID_SHIPMENT_DETAILS") return 400;
  if (code === "NOT_SERVICEABLE" || code === "SHIPMENT_ALREADY_CREATED") return 409;
  if (code === "CARRIER_NOT_CONFIGURED") return 503;
  return 502;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const id = String(new URL(req.url).searchParams.get("id") || "").trim();
    if (!id) return NextResponse.json({ error: "Order id required" }, { status: 400 });
    return NextResponse.json({ ok: true, workspace: await getShipmentWorkspace(id) });
  } catch (error) {
    return NextResponse.json(
      { error: String((error as Error).message || error) },
      { status: String((error as Error).message) === "ADMIN_REQUIRED" ? 404 : 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const id = String(body?.id || "").trim();
    const action = String(body?.action || "create").trim();
    if (!id) return NextResponse.json({ error: "Order id required" }, { status: 400 });

    if (action === "save") {
      return NextResponse.json({ ok: true, workspace: await saveShipmentDetails(id, body?.details) });
    }
    if (action === "check") {
      return NextResponse.json({ ok: true, workspace: await checkAndQuoteShipment(id, body?.details) });
    }
    if (action === "manual") {
      const workspace = await prepareManualShipment(id, body?.details);
      return NextResponse.json({
        ok: true,
        workspace,
        manualHandoff: buildDelhiveryManualHandoff({
          company: workspace.company,
          details: workspace.details,
          order: workspace.order,
        }),
        dashboardUrl: workspace.integration.dashboardUrl,
      });
    }
    if (action === "retry") {
      const result = await retryShipment(id);
      return NextResponse.json({
        ok: Boolean(result.ok),
        result,
        waybills: result.waybills || [],
        job: await getShipmentJob(id),
        workspace: await getShipmentWorkspace(id),
      }, { status: result.ok ? 200 : 502 });
    }

    await saveShipmentDetails(id, body?.details);
    await checkAndQuoteShipment(id, body?.details);
    const result = await processShipmentJob(id);
    const waybills = Array.isArray(result.waybills) ? result.waybills : [];
    return NextResponse.json({
      ok: Boolean(result.ok),
      result,
      waybills,
      trackingNumber: waybills[0] || "",
      trackingUrl: waybills[0]
        ? `https://www.delhivery.com/track/package/${encodeURIComponent(waybills[0])}`
        : "",
      job: await getShipmentJob(id),
      workspace: await getShipmentWorkspace(id),
    }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = String((error as Error).message || error);
    return NextResponse.json(
      { error: message },
      {
        status:
          message === "ADMIN_REQUIRED" || message === "UNAUTHENTICATED"
            ? 404
            : errorStatus(error),
      },
    );
  }
}
