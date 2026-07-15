export type {
  Appointment,
  AppointmentListFilters,
  AppointmentSearchParams,
  AppointmentSearchResult,
} from "./types";
export { AppointmentListScreen } from "./components/AppointmentListScreen";
export { AppointmentCard } from "./components/AppointmentCard";
export {
  useAppointmentList,
  useAppointmentListState,
  useOpenConsult,
} from "./hooks/useAppointmentList";
export { buildSearchParams, defaultListFilters } from "./lib/buildSearchParams";
export {
  canOpenConsultFromMenu,
  isAppointmentFollowUp,
  isFollowUpAwaitingTimeSlot,
} from "./lib/appointmentGates";
