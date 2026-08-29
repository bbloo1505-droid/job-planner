export type BookingStatus =
  | "uncontacted"
  | "contact_attempted"
  | "tentatively_booked"
  | "confirmed"
  | "unable_to_contact"
  | "complete";

export type AppointmentConstraint =
  | { type: "flexible" }
  | { type: "fixed"; time: string }
  | { type: "after"; time: string }
  | { type: "before"; time: string }
  | { type: "between"; start: string; end: string };

export type Priority = "low" | "normal" | "high" | "urgent";

/** QLD planning-board work category. Separate from priority and job type. */
export type WorkCategory =
  | "confirmed_work"
  | "proposed_work"
  | "reporting"
  | "not_available"
  | "management_locked"
  | "secondary_consultant"
  | "meeting"
  | "laboratory";

export type GeocodingStatus =
  | "unresolved"
  | "confirmed"
  | "stale"
  | "not_found"
  | "needs_confirmation";

export interface GeocodingResult {
  id: string;
  displayAddress: string;
  latitude: number;
  longitude: number;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
  provider: string;
}

export interface Job {
  id: string;
  address: string;
  suburb?: string;
  latitude?: number;
  longitude?: number;
  /** Time on site / sampling duration. Preferred over the global visit default. */
  samplingDurationMinutes?: number;
  estimatedMinutes: number;
  enteredAddress?: string;
  resolvedDisplayAddress?: string;
  geocodingProvider?: string;
  geocodedAt?: string;
  geocodingStatus?: GeocodingStatus;
  geocodeCandidates?: GeocodingResult[];
  constraint: AppointmentConstraint;
  bookingStatus: BookingStatus;
  priority?: Priority;
  dueDate?: string;
  /** Inclusive start of the allocation window. Optional so Day Route jobs remain valid. */
  earliestDate?: string;
  notes?: string;
  jobNumber?: string;
  client?: string;
  /** Job type / work title, e.g. ACM Survey. Optional so Day Route jobs remain valid. */
  title?: string;
  /** Planning-board colour language. Optional so Day Route jobs remain valid. */
  workCategory?: WorkCategory;
}

export interface Consultant {
  id: string;
  name: string;
  initials: string;
  team?: string;
  baseOffice?: string;
  displayColour: string;
  active: boolean;
}

export interface Allocation {
  id: string;
  jobId: string;
  consultantId: string;
  scheduledDate: string;
  startTime?: string;
  endTime?: string;
  order?: number;
}

export interface DayPlanSettings {
  date: string;
  startLocation: string;
  startLat?: number;
  startLng?: number;
  startTime: string;
  finishLocation?: string;
  finishLat?: number;
  finishLng?: number;
  workingHoursEnd?: string;
  visitDurationMinutes: number;
  travelBufferMinutes: number;
  roundToMinutes: 15 | 30;
}

export interface RouteStop {
  id: string;
  jobId: string;
  order: number;
  suggestedArrival?: string;
  suggestedDeparture?: string;
  /** Unrounded earliest arrival before booking-interval rounding or a later constraint. */
  earliestArrival?: string;
  travelMinutesFromPrevious?: number;
  travelMetersFromPrevious?: number;
  accessBufferMinutes?: number;
  /** Idle time when a fixed booking is later than the earliest arrival. */
  waitingMinutes?: number;
  isManuallyOrdered?: boolean;
  conflict?: StopConflict;
}

export interface DayPlan {
  id: string;
  settings: DayPlanSettings;
  stops: RouteStop[];
  unbookedPool: Job[];
  returnTravelMinutes?: number;
  returnTravelMeters?: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  address: string;
  suburb: string;
  lat: number;
  lng: number;
}

export interface GeocodingProvider {
  geocodeAddress(text: string): GeocodeResult | null;
}

export type ConflictCode =
  | "late_for_fixed"
  | "missed_before"
  | "outside_window"
  | "exceeds_working_day";

export interface StopConflict {
  jobId: string;
  code: ConflictCode;
  message: string;
}

export interface OptimiseResult {
  stops: RouteStop[];
  conflicts: StopConflict[];
  totalTravelMinutes: number;
  totalAccessMinutes: number;
  returnTravelMinutes: number;
  returnTravelMeters?: number;
  exceedsWorkingDay: boolean;
}

export interface SlotSuggestion {
  appointmentTime: string;
  routeImpactMinutes: number;
  insertionIndex: number;
  fitsWorkingHours: boolean;
  hasConflict: boolean;
}

export interface NearbyMatch {
  job: Job;
  detourMinutes: number | null;
  samplingMinutes: number;
  dayImpactMinutes: number | null;
  bestInsertionIndex: number;
}

export interface TravelImpact {
  previousMinutes: number;
  nextMinutes: number;
  deltaMinutes: number;
  exceedsWorkingDay: boolean;
  infeasible: boolean;
}
