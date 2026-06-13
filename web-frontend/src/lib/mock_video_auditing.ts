export type VideoAuditEventType =
  | "Sudden Braking"
  | "Harsh Acceleration"
  | "Sharp Turn"
  | "Geofence Violation"
  | "Overspeeding"
  | "Possible Accident";

export type VideoStatus =
  | "No Video Uploaded"
  | "Video Uploaded"
  | "Video Linked"
  | "Video Missing";

export type AuditStatus =
  | "Pending Review"
  | "Under Review"
  | "Confirmed Violation"
  | "False Alarm"
  | "Needs More Evidence"
  | "Resolved";

export type Severity = "Low" | "Medium" | "High" | "Critical";

export type AuditDecision =
  | "Confirmed Violation"
  | "False Alarm"
  | "Unclear Video"
  | "Wrong Video Uploaded"
  | "No Evidence Found"
  | "Needs Further Review";

export interface VideoEvidence {
  fileName: string;
  uploadedBy: string;
  uploadedDate: string;
}

export interface AuditHistoryItem {
  id: string;
  label: string;
}

export interface VideoAuditEvent {
  id: string;
  bookingId: string;
  customerName: string;
  vehicleName: string;
  eventType: VideoAuditEventType;
  timestamp: string;
  location: string;
  severity: Severity;
  videoStatus: VideoStatus;
  auditStatus: AuditStatus;
  speed: string;
  sensorSummary: string;
  latitude: number;
  longitude: number;
  evidence?: VideoEvidence;
  decision?: AuditDecision;
  remarks?: string;
  auditHistory: AuditHistoryItem[];
}

export const videoAuditEventTypes: VideoAuditEventType[] = [
  "Sudden Braking",
  "Harsh Acceleration",
  "Sharp Turn",
  "Geofence Violation",
  "Overspeeding",
  "Possible Accident",
];

export const videoAuditStatuses: AuditStatus[] = [
  "Pending Review",
  "Under Review",
  "Confirmed Violation",
  "False Alarm",
  "Needs More Evidence",
  "Resolved",
];

export const videoStatuses: VideoStatus[] = [
  "No Video Uploaded",
  "Video Uploaded",
  "Video Linked",
  "Video Missing",
];

export const videoAuditSeverities: Severity[] = ["Low", "Medium", "High", "Critical"];

export const videoAuditDecisions: AuditDecision[] = [
  "Confirmed Violation",
  "False Alarm",
  "Unclear Video",
  "Wrong Video Uploaded",
  "No Evidence Found",
  "Needs Further Review",
];

export const flaggedVideoAuditEvents: VideoAuditEvent[] = [
  {
    id: "EVT-1001",
    bookingId: "BK-00001",
    customerName: "Juan Dela Cruz",
    vehicleName: "Toyota Vios 2022",
    eventType: "Sudden Braking",
    timestamp: "June 3, 2026 2:35 PM",
    location: "Quezon Avenue, Quezon City",
    severity: "High",
    videoStatus: "No Video Uploaded",
    auditStatus: "Pending Review",
    speed: "48 km/h",
    sensorSummary: "Strong forward deceleration detected",
    latitude: 14.6417,
    longitude: 121.0291,
    auditHistory: [
      { id: "H-1001-1", label: "June 3, 2026 2:35 PM - Flagged event saved from mobile telemetry" },
      { id: "H-1001-2", label: "June 3, 2026 2:42 PM - Added to pending video audit queue" },
    ],
  },
  {
    id: "EVT-1002",
    bookingId: "BK-00002",
    customerName: "Maria Santos",
    vehicleName: "Mitsubishi Mirage 2021",
    eventType: "Geofence Violation",
    timestamp: "June 3, 2026 4:12 PM",
    location: "Outside allowed Manila boundary",
    severity: "Critical",
    videoStatus: "Video Uploaded",
    auditStatus: "Under Review",
    speed: "35 km/h",
    sensorSummary: "Vehicle moved outside allowed geofence",
    latitude: 14.5995,
    longitude: 120.9842,
    evidence: {
      fileName: "BK-00002-geofence-20260603-1612.mp4",
      uploadedBy: "Admin",
      uploadedDate: "June 3, 2026 4:55 PM",
    },
    decision: "Needs Further Review",
    remarks: "Video is queued for location and timestamp matching.",
    auditHistory: [
      { id: "H-1002-1", label: "June 3, 2026 4:12 PM - Geofence violation detected" },
      { id: "H-1002-2", label: "June 3, 2026 4:55 PM - Video uploaded by Admin" },
      { id: "H-1002-3", label: "June 3, 2026 5:02 PM - Marked as Under Review" },
    ],
  },
  {
    id: "EVT-1003",
    bookingId: "BK-00003",
    customerName: "Carlo Reyes",
    vehicleName: "Honda City 2020",
    eventType: "Harsh Acceleration",
    timestamp: "June 4, 2026 10:18 AM",
    location: "EDSA Northbound",
    severity: "Medium",
    videoStatus: "Video Linked",
    auditStatus: "Confirmed Violation",
    speed: "62 km/h",
    sensorSummary: "Rapid acceleration spike detected",
    latitude: 14.6542,
    longitude: 121.0321,
    evidence: {
      fileName: "BK-00003-front-cam-20260604-1018.mov",
      uploadedBy: "Owner",
      uploadedDate: "June 4, 2026 11:04 AM",
    },
    decision: "Confirmed Violation",
    remarks: "Dashcam clip matches the acceleration spike and timestamp.",
    auditHistory: [
      { id: "H-1003-1", label: "June 4, 2026 10:18 AM - Harsh acceleration event saved" },
      { id: "H-1003-2", label: "June 4, 2026 11:04 AM - Video linked by Owner" },
      { id: "H-1003-3", label: "June 4, 2026 11:20 AM - Confirmed violation after video review" },
    ],
  },
  {
    id: "EVT-1004",
    bookingId: "BK-00004",
    customerName: "Angela Lim",
    vehicleName: "Toyota Innova 2023",
    eventType: "Sharp Turn",
    timestamp: "June 4, 2026 1:47 PM",
    location: "BGC Taguig",
    severity: "Low",
    videoStatus: "Video Missing",
    auditStatus: "Needs More Evidence",
    speed: "28 km/h",
    sensorSummary: "Lateral movement detected but video unavailable",
    latitude: 14.5547,
    longitude: 121.0244,
    decision: "No Evidence Found",
    remarks: "Matching dashcam segment was unavailable due to loop recording overwrite.",
    auditHistory: [
      { id: "H-1004-1", label: "June 4, 2026 1:47 PM - Sharp turn event saved" },
      { id: "H-1004-2", label: "June 4, 2026 3:10 PM - Dashcam file checked by Admin" },
      { id: "H-1004-3", label: "June 4, 2026 3:15 PM - Marked as Video Missing" },
    ],
  },
  {
    id: "EVT-1005",
    bookingId: "BK-00005",
    customerName: "Mark Villanueva",
    vehicleName: "Suzuki Ertiga 2022",
    eventType: "Overspeeding",
    timestamp: "June 5, 2026 8:05 AM",
    location: "C5 Road",
    severity: "High",
    videoStatus: "Video Uploaded",
    auditStatus: "False Alarm",
    speed: "72 km/h",
    sensorSummary: "Speed threshold exceeded but verified as safe road condition",
    latitude: 14.5601,
    longitude: 121.0633,
    evidence: {
      fileName: "BK-00005-c5-road-overspeed-review.mp4",
      uploadedBy: "Admin",
      uploadedDate: "June 5, 2026 9:18 AM",
    },
    decision: "False Alarm",
    remarks: "Road segment and traffic condition were verified as safe for the detected speed.",
    auditHistory: [
      { id: "H-1005-1", label: "June 5, 2026 8:05 AM - Overspeeding event detected" },
      { id: "H-1005-2", label: "June 5, 2026 9:18 AM - Video uploaded by Admin" },
      { id: "H-1005-3", label: "June 5, 2026 9:35 AM - Marked as False Alarm" },
    ],
  },
];
