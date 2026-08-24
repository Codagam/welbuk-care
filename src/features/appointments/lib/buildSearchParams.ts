/**
 * Port of Practice AppointmentList `buildQueryParams` date / filter / sort rules.
 * @see practice/Welbuk_/components/appointments/list.tsx
 */

import type {
  AppointmentListFilters,
  AppointmentSearchParams,
} from "../types";

export function localCalendarYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → DD/MM/YYYY (web filter display). */
export function ymdToDdMmYyyy(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** DD/MM/YYYY or YYYY-MM-DD → local Date at midnight, or null. */
export function parseFilterDate(value: string): Date | null {
  const dateStr = value.trim();
  if (!dateStr) return null;
  try {
    let selected: Date;
    if (dateStr.includes("/")) {
      const [day, month, year] = dateStr.split("/").map(Number);
      if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) {
        return null;
      }
      selected = new Date(year, month - 1, day);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split("-").map(Number);
      selected = new Date(y, m - 1, d);
    } else {
      selected = new Date(dateStr);
    }
    if (isNaN(selected.getTime())) return null;
    selected.setHours(0, 0, 0, 0);
    return selected;
  } catch {
    return null;
  }
}

export function todayBoundsIso(): { startDate: string; endDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  return {
    startDate: today.toISOString(),
    endDate: endOfToday.toISOString(),
  };
}

export interface BuildSearchParamsInput {
  facilityId: string;
  doctorId?: string;
  page: number;
  pageSize: number;
  search: string;
  filters: AppointmentListFilters;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  /** Force today window (dashboard-style). */
  todayOnly?: boolean;
  followUpOnly?: boolean;
  hideTentativeFromList?: boolean;
}

/**
 * Builds POST /api/facility/appointment-search body.
 * Web default: startTime **desc**, pageSize 10, today when date filter = today.
 */
export function buildSearchParams(
  input: BuildSearchParamsInput
): AppointmentSearchParams {
  const {
    facilityId,
    doctorId,
    page,
    pageSize,
    search,
    filters,
    sortBy = "startTime",
    sortOrder = "desc",
    todayOnly = false,
    followUpOnly = false,
    hideTentativeFromList = false,
  } = input;

  const queryParams: AppointmentSearchParams = {
    facilityId,
    page,
    pageSize,
    sortBy: sortBy === "time" ? "startTime" : sortBy,
    sortOrder,
  };

  if (doctorId) queryParams.doctorId = doctorId;
  if (followUpOnly) queryParams.followUpOnly = true;
  if (hideTentativeFromList && !followUpOnly) {
    queryParams.hideTentativeFromList = true;
  }

  const statusFilter = filters.status?.trim() || "";
  const dateValue = filters.date?.trim() || "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Status filter active → skip all date restrictions (web parity)
  if (statusFilter) {
    // no start/end
  } else if (todayOnly) {
    const bounds = todayBoundsIso();
    queryParams.startDate = bounds.startDate;
    queryParams.endDate = bounds.endDate;
  } else if (filters.filtersCleared) {
    // Clear All: today + future (Care spec — not unbounded history)
    queryParams.startDate = todayISO;
  } else if (dateValue) {
    const selectedDate = parseFilterDate(dateValue);
    if (selectedDate) {
      const isToday = selectedDate.toDateString() === today.toDateString();
      if (isToday) {
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
        queryParams.startDate = selectedDate.toISOString();
        queryParams.endDate = endOfToday.toISOString();
      } else {
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        queryParams.startDate = selectedDate.toISOString();
        queryParams.endDate = nextDay.toISOString();
      }
    } else {
      const bounds = todayBoundsIso();
      queryParams.startDate = bounds.startDate;
      queryParams.endDate = bounds.endDate;
    }
  } else {
    // Empty date (manual clear of date only): today + future (no endDate)
    // Initial load uses date = today so this branch is for cleared date field.
    queryParams.startDate = todayISO;
    if (followUpOnly) {
      // follow-up mode: today + future — no endDate
    }
    // no endDate = today onward
  }

  const searchTerm = search.trim();
  if (searchTerm) queryParams.search = searchTerm;

  const columnFilters: Record<string, string> = {};
  if (statusFilter) columnFilters.status = statusFilter;
  if (filters.patient.trim()) columnFilters.patient = filters.patient.trim();
  if (filters.doctor.trim()) columnFilters.doctor = filters.doctor.trim();
  if (filters.reason.trim()) columnFilters.reason = filters.reason.trim();
  if (Object.keys(columnFilters).length > 0) {
    queryParams.filters = columnFilters;
  }

  return queryParams;
}

/** Default filter state: today only (web Appointment page). */
export function defaultListFilters(): AppointmentListFilters {
  return {
    date: localCalendarYmd(),
    patient: "",
    doctor: "",
    reason: "",
    status: "",
    filtersCleared: false,
  };
}
