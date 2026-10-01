export type ReportRange = "6_months" | "12_months" | "this_year" | "all_time";

export type DashboardSummary = {
  totalRevenue: number;
  totalVehicles: number;
  totalCustomers: number;
  totalBookings: number;
  completedBookings: number;
  activeRentals: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  averageBookingDuration: number;
  fleetStatus: {
    available: number;
    rented: number;
    maintenance: number;
    unavailable: number;
  };
};

export type BookingPerformancePoint = {
  month: string;
  bookings: number;
  completed: number;
};

export type RevenueTrendPoint = {
  month: string;
  revenue: number;
};

export type FleetStatusPoint = {
  name: string;
  value: number;
  color: string;
};

export type DashboardVehicle = {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
  status: string;
  image?: string | null;
};

export type BookingReportRow = {
  internalId: number;
  bookingId: string;
  customer: string;
  vehicle: string;
  rentalDate?: string | null;
  returnDate?: string | null;
  totalCost: number;
  status: string;
  statusKey: string;
  rentalBoundary?: {
    name: string;
    geometryType: "circle" | "polygon";
    radiusMeters: number | null;
    polygonPointCount: number;
  } | null;
};

export type DashboardActivity = {
  type: "booking" | "payment" | string;
  label: string;
  occurredAt?: string | null;
};

export type DashboardResponse = {
  summary: DashboardCalendarSummary;
  events: DashboardCalendarEvent[];
};

export type DashboardCalendarSummary = {
  monthRevenue: number;
  confirmedBookings: number;
  activeRentals: number;
  todaysPickups: number;
};

export type DashboardCalendarEvent = {
  id: number;
  bookingCode: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  vehicleName: string;
  vehiclePlate?: string | null;
  start: string;
  end: string;
  status: "confirmed" | "ongoing";
  statusLabel: string;
  rentalType: string;
  pickupLocation?: string | null;
  returnLocation?: string | null;
  totalAmount: number;
  paymentStatus: string;
  durationDays: number;
  driverName?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
};

export type RevenueTransaction = {
  id: number;
  bookingId: string;
  customer: string;
  vehicle: string;
  rentalType: string;
  paymentMethod: string;
  amount: number;
  paidDate?: string | null;
  status: string;
};

export type FleetReportRow = {
  id: string;
  vehicle: string;
  model?: string | null;
  totalBookings: number;
  revenue: number;
  utilization: number;
  maintenanceStatus: "Good" | "Due" | "Critical";
  incidents: number;
};

export type CustomerReportRow = {
  id: number;
  name: string;
  email: string;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  lastBookingDate: string;
};

export type RiskReportRow = {
  eventId: string;
  bookingId: string;
  vehicle: string;
  customer: string;
  eventType: string;
  location: string;
  timestamp?: string | null;
  severity: string;
};

export type ReportsResponse = {
  range: ReportRange;
  summary: DashboardSummary;
  revenueTrend: RevenueTrendPoint[];
  bookingPerformance: BookingPerformancePoint[];
  bookingStatusDistribution: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  revenueByRentalType: Array<{
    type: string;
    value: number;
  }>;
  revenueBreakdown: Array<{
    label: string;
    value: number;
  }>;
  revenueTransactions: RevenueTransaction[];
  bookings: BookingReportRow[];
  cancellation: {
    rate: number;
    cancelled: number;
    rejected: number;
  };
  fleet: FleetReportRow[];
  fleetHighlights: Array<{
    label: string;
    value: string;
    sub: string;
  }>;
  customers: CustomerReportRow[];
  newVsReturning: Array<{
    month: string;
    new: number;
    returning: number;
  }>;
  customerCancellationLeaders: CustomerReportRow[];
  riskEventCounts: Array<{
    type: string;
    count: number;
  }>;
  riskSummary: Array<{
    label: string;
    count: number;
    severity: string;
  }>;
  riskEvents: RiskReportRow[];
  highlights: string[];
};
