import {
  handleAdminDashboard,
  handleAdminDashboardRecount,
} from "@/lib/api-handlers/admin/dashboard";

/** GET /api/admin/dashboard?scope=summary|products|orders|customers|reviews */
export async function GET(request: Request) {
  return handleAdminDashboard(request);
}

/** POST /api/admin/dashboard — recount the stored Command Center counters. */
export async function POST() {
  return handleAdminDashboardRecount();
}
