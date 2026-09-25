import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { buildDelhiveryManualHandoff } from "@/lib/delhivery-shipment";
import { buildDelhiveryTrackingUrl } from "@/lib/delhiveryTracking";
import {
  checkAndQuoteShipment,
  createAdditionalDelhiveryShipment,
  getShipmentJob,
  getShipmentWorkspace,
  prepareManualShipment,
  processShipmentJob,
  reconcileConfirmedShipment,
  retryShipment,
  saveShipmentDetails,
  updateDelhiveryManifest,
} from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorStatus(error: unknown) {
  const code = String((error as Error & { code?: string })?.code || "");
  if (code === "INVALID_SHIPMENT_DETAILS") return 400;
  if (code === "NOT_SERVICEABLE" || code === "SHIPMENT_ALREADY_CREATED" || code === "SHIPMENT_AWB_REQUIRED") return 409;
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
      if (!result.ok) console.error("Delhivery API Error:", result);
      return NextResponse.json({
        ok: Boolean(result.ok),
        ...(!result.ok ? { error: result.error } : {}),
        result,
        waybills: result.waybills || [],
        job: await getShipmentJob(id),
        workspace: await getShipmentWorkspace(id),
      }, { status: result.ok ? 200 : 502 });
    }

    if (action === "update_manifest") {
      const result = await updateDelhiveryManifest(id);
      return NextResponse.json({
        ok: true,
        waybill: result.waybill,
        waybills: result.waybills,
        trackingNumber: result.trackingNumber,
        trackingUrl: result.trackingUrl,
        result: result.result,
        job: await getShipmentJob(id),
        workspace: await getShipmentWorkspace(id),
      });
    }

    if (action === "create-again" || action === "existing-awb") {
      const waybills = await reconcileConfirmedShipment(id);
      if (!waybills.length) {
        return NextResponse.json(
          { error: "No confirmed AWB exists. Use the normal create or retry action after verifying the order." },
          { status: 409 },
        );
      }
      return NextResponse.json({
        ok: true,
        skipped: true,
        result: { reason: "already_created", waybills },
        waybills,
        trackingNumber: waybills[0],
        trackingUrl: buildDelhiveryTrackingUrl(waybills[0]),
        job: await getShipmentJob(id),
        workspace: await getShipmentWorkspace(id),
      });
    }

    if (action === "ready_to_ship" || action === "create") {
      // "additional": true is an explicit admin confirmation from the
      // "create one more shipment?" modal, so it may bypass the single-AWB guard.
      if (body?.additional === true) {
        const result = await createAdditionalDelhiveryShipment(id);
        return NextResponse.json({
          ok: true,
          additional: true,
          destination: "ready_to_ship" as const,
          orderReference: result.orderReference,
          sequence: result.sequence,
          waybills: result.waybills,
          allWaybills: result.allWaybills,
          trackingNumber: result.trackingNumber,
          trackingUrl: result.trackingUrl,
          result: result.result,
          job: await getShipmentJob(id),
          workspace: await getShipmentWorkspace(id),
        });
      }

      const confirmedWaybills = await reconcileConfirmedShipment(id);
      if (confirmedWaybills.length) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          needsConfirmation: true,
          destination: "ready_to_ship" as const,
          result: { reason: "already_created", waybills: confirmedWaybills },
          waybills: confirmedWaybills,
          trackingNumber: confirmedWaybills[0],
          trackingUrl: buildDelhiveryTrackingUrl(confirmedWaybills[0]),
          job: await getShipmentJob(id),
          workspace: await getShipmentWorkspace(id),
        });
      }

      await saveShipmentDetails(id, body?.details);
      const result = await processShipmentJob(id);
      if (!result.ok) console.error("Delhivery API Error:", result);
      const waybills = Array.isArray(result.waybills) ? result.waybills : [];
      return NextResponse.json({
        ok: Boolean(result.ok),
        destination: "ready_to_ship" as const,
        ...(!result.ok ? { error: result.error } : {}),
        result,
        waybills,
        trackingNumber: waybills[0] || "",
        trackingUrl: buildDelhiveryTrackingUrl(waybills[0]),
        job: await getShipmentJob(id),
        workspace: await getShipmentWorkspace(id),
      }, { status: result.ok ? 200 : 502 });
    }

    return NextResponse.json(
      { error: `Unsupported shipment action: ${action || "empty"}.` },
      { status: 400 },
    );
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
