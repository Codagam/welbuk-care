import { api } from "@/lib/api/client";

/** GET /api/permissions?facilityId= → effective permission keys for the staff user. */
export async function fetchPermissions(
  facilityId?: string | null
): Promise<string[]> {
  const data = await api<{ permissions: string[] }>({
    path: "/api/permissions",
    query: facilityId ? { facilityId } : undefined,
  });
  return data.permissions ?? [];
}
