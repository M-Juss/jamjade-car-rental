"use client";

import { useMemo, useState } from "react";
import { appToast as sonnerToast } from "@/lib/toast";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Car,
  ChevronLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileSearch,
  FileVideo,
  FileX,
  Gauge,
  History,
  MapPin,
  PlayCircle,
  Save,
  Search,
  ShieldCheck,
  Upload,
  User,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  flaggedVideoAuditEvents,
  videoAuditDecisions,
  videoAuditEventTypes,
  videoAuditSeverities,
  videoAuditStatuses,
  videoStatuses,
  type AuditDecision,
  type AuditStatus,
  type Severity,
  type VideoAuditEvent,
  type VideoAuditEventType,
  type VideoStatus,
} from "@/lib/mock_video_auditing";

type FilterValue<T extends string> = "all" | T;

type FilterState = {
  eventType: FilterValue<VideoAuditEventType>;
  auditStatus: FilterValue<AuditStatus>;
  videoStatus: FilterValue<VideoStatus>;
  severity: FilterValue<Severity>;
};

type AuditFormState = {
  auditStatus: AuditStatus;
  decision: AuditDecision;
  remarks: string;
};

const initialFilters: FilterState = {
  eventType: "all",
  auditStatus: "all",
  videoStatus: "all",
  severity: "all",
};

const severityMeta: Record<Severity, { badge: string; dot: string }> = {
  Low: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  Medium: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  High: {
    badge: "border-orange-200 bg-orange-50 text-orange-700",
    dot: "bg-orange-500",
  },
  Critical: {
    badge: "border-rose-200 bg-rose-50 text-rose-600",
    dot: "bg-rose-500",
  },
};

const videoStatusMeta: Record<VideoStatus, { badge: string; icon: typeof FileVideo }> = {
  "No Video Uploaded": {
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    icon: FileVideo,
  },
  "Video Uploaded": {
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Upload,
  },
  "Video Linked": {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  "Video Missing": {
    badge: "border-rose-200 bg-rose-50 text-rose-600",
    icon: FileX,
  },
};

const auditStatusMeta: Record<AuditStatus, { badge: string; icon: typeof Clock }> = {
  "Pending Review": {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock,
  },
  "Under Review": {
    badge: "border-blue-200 bg-blue-50 text-blue-700",
    icon: FileSearch,
  },
  "Confirmed Violation": {
    badge: "border-rose-200 bg-rose-50 text-rose-600",
    icon: AlertTriangle,
  },
  "False Alarm": {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: XCircle,
  },
  "Needs More Evidence": {
    badge: "border-orange-200 bg-orange-50 text-orange-700",
    icon: FileSearch,
  },
  Resolved: {
    badge: "border-slate-200 bg-slate-50 text-slate-600",
    icon: BadgeCheck,
  },
};

function StatusBadge({
  label,
  className,
  icon: Icon,
}: {
  label: string;
  className: string;
  icon?: typeof Clock;
}) {
  return (
    <Badge variant="outline" className={`h-auto min-h-6 max-w-full whitespace-normal rounded-lg px-2 text-center text-[10px] font-semibold leading-tight ${className}`}>
      {Icon ? <Icon size={12} /> : null}
      {label}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant="outline" className={`h-auto min-h-6 rounded-lg px-2 text-[10px] font-semibold ${severityMeta[severity].badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${severityMeta[severity].dot}`} />
      {severity}
    </Badge>
  );
}

function VideoStatusBadge({ status }: { status: VideoStatus }) {
  const meta = videoStatusMeta[status];
  return <StatusBadge label={status} className={meta.badge} icon={meta.icon} />;
}

function AuditStatusBadge({ status }: { status: AuditStatus }) {
  const meta = auditStatusMeta[status];
  return <StatusBadge label={status} className={meta.badge} icon={meta.icon} />;
}

function DetailItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | number;
  icon?: typeof User;
}) {
  return (
    <div className="rounded-xl bg-background px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">
        {Icon ? <Icon size={11} /> : null}
        {label}
      </div>
      <p className="mt-0.5 break-words text-[12.5px] font-semibold text-foreground">{value || "Not provided"}</p>
    </div>
  );
}

function FilterSelect<T extends string>({
  value,
  options,
  allLabel,
  onValueChange,
}: {
  value: FilterValue<T>;
  options: T[];
  allLabel: string;
  onValueChange: (value: FilterValue<T>) => void;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as FilterValue<T>)}>
      <SelectTrigger className="h-9 w-full rounded-xl border-border bg-background text-[12.5px] sm:w-[178px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const nowLabel = "June 3, 2026 3:35 PM";

const getAuditFormState = (event: VideoAuditEvent): AuditFormState => ({
  auditStatus: event.auditStatus,
  decision: event.decision ?? "Needs Further Review",
  remarks: event.remarks ?? "",
});

export default function VideoEvidenceAuditing() {
  const [events, setEvents] = useState<VideoAuditEvent[]>(flaggedVideoAuditEvents);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [auditForm, setAuditForm] = useState<AuditFormState>(() => getAuditFormState(flaggedVideoAuditEvents[0]));

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const counts = useMemo(
    () => ({
      pendingAudit: events.filter((event) => event.auditStatus === "Pending Review").length,
      videoUploaded: events.filter((event) => ["Video Uploaded", "Video Linked"].includes(event.videoStatus)).length,
      confirmedViolations: events.filter((event) => event.auditStatus === "Confirmed Violation").length,
      falseAlarms: events.filter((event) => event.auditStatus === "False Alarm").length,
    }),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const query = search.toLowerCase();

    return events.filter((event) => {
      const haystack = [
        event.id,
        event.bookingId,
        event.customerName,
        event.vehicleName,
        event.eventType,
        event.location,
      ]
        .join(" ")
        .toLowerCase();

      return (
        haystack.includes(query) &&
        (filters.eventType === "all" || event.eventType === filters.eventType) &&
        (filters.auditStatus === "all" || event.auditStatus === filters.auditStatus) &&
        (filters.videoStatus === "all" || event.videoStatus === filters.videoStatus) &&
        (filters.severity === "all" || event.severity === filters.severity)
      );
    });
  }, [events, filters, search]);

  const clearFilters = () => {
    setSearch("");
    setFilters(initialFilters);
  };

  const openAudit = (event: VideoAuditEvent) => {
    setAuditForm(getAuditFormState(event));
    setSelectedEventId(event.id);
  };

  const updateEvent = (eventId: string, updater: (event: VideoAuditEvent) => VideoAuditEvent) => {
    setEvents((current) => current.map((event) => (event.id === eventId ? updater(event) : event)));
  };

  const handleVideoSelected = (file: File | null) => {
    if (!selectedEvent || !file) return;

    updateEvent(selectedEvent.id, (event) => ({
      ...event,
      videoStatus: "Video Uploaded",
      auditStatus: event.auditStatus === "Pending Review" ? "Under Review" : event.auditStatus,
      evidence: {
        fileName: file.name,
        uploadedBy: "Admin",
        uploadedDate: nowLabel,
      },
      auditHistory: [
        ...event.auditHistory,
        { id: `${event.id}-upload-${Date.now()}`, label: `${nowLabel} - Selected ${file.name} for manual video evidence review` },
      ],
    }));

    setAuditForm((current) => ({
      ...current,
      auditStatus: current.auditStatus === "Pending Review" ? "Under Review" : current.auditStatus,
    }));

    sonnerToast.success("Video evidence selected and linked locally.");
  };

  const markMissingVideo = (event: VideoAuditEvent) => {
    const missingRemarks = event.remarks || "Matching dashcam video was not available.";

    updateEvent(event.id, (current) => ({
      ...current,
      videoStatus: "Video Missing",
      auditStatus: "Needs More Evidence",
      decision: "No Evidence Found",
      remarks: current.remarks || missingRemarks,
      auditHistory: [
        ...current.auditHistory,
        { id: `${current.id}-missing-${Date.now()}`, label: `${nowLabel} - Marked as Video Missing; more evidence required` },
      ],
    }));

    if (selectedEventId === event.id) {
      setAuditForm({
        auditStatus: "Needs More Evidence",
        decision: "No Evidence Found",
        remarks: missingRemarks,
      });
    }

    sonnerToast.warning("Event marked as Video Missing.");
  };

  const saveAudit = () => {
    if (!selectedEvent) return;

    updateEvent(selectedEvent.id, (event) => ({
      ...event,
      auditStatus: auditForm.auditStatus,
      decision: auditForm.decision,
      remarks: auditForm.remarks.trim(),
      auditHistory: [
        ...event.auditHistory,
        { id: `${event.id}-audit-${Date.now()}`, label: `${nowLabel} - Audit saved as ${auditForm.auditStatus}` },
      ],
    }));

    sonnerToast.success("Audit decision saved locally.");
  };

  const hasFilters =
    Boolean(search) ||
    filters.eventType !== "all" ||
    filters.auditStatus !== "all" ||
    filters.videoStatus !== "all" ||
    filters.severity !== "all";

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Video Evidence Auditing</h1>
              <Badge variant="outline" className="h-6 rounded-lg border-blue-200 bg-blue-50 px-2.5 text-[10.5px] font-semibold text-blue-700">
                Mock data
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Review flagged driving events and attach dashcam video evidence for manual audit.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: "Pending Audit", value: counts.pendingAudit, icon: Clock, bg: "bg-amber-50", color: "text-amber-600" },
            { label: "Video Uploaded", value: counts.videoUploaded, icon: FileVideo, bg: "bg-blue-50", color: "text-blue-600" },
            { label: "Confirmed Violations", value: counts.confirmedViolations, icon: ShieldCheck, bg: "bg-rose-50", color: "text-rose-500" },
            { label: "False Alarms", value: counts.falseAlarms, icon: CheckCircle2, bg: "bg-emerald-50", color: "text-emerald-600" },
          ].map(({ label, value, icon: Icon, bg, color }) => (
            <Card key={label} className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(52,110,246,0.1)]">
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                  <Icon size={17} className={color} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[22px] font-bold leading-none text-foreground">{value}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[240px] flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by event ID, booking ID, customer, vehicle, or location..."
                  className="h-9 rounded-xl border-border bg-background pl-8 text-[12.5px] focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <FilterSelect
                value={filters.eventType}
                options={videoAuditEventTypes}
                allLabel="All Event Types"
                onValueChange={(value) => setFilters((current) => ({ ...current, eventType: value }))}
              />
              <FilterSelect
                value={filters.auditStatus}
                options={videoAuditStatuses}
                allLabel="All Audit Status"
                onValueChange={(value) => setFilters((current) => ({ ...current, auditStatus: value }))}
              />
              <FilterSelect
                value={filters.videoStatus}
                options={videoStatuses}
                allLabel="All Video Status"
                onValueChange={(value) => setFilters((current) => ({ ...current, videoStatus: value }))}
              />
              <FilterSelect
                value={filters.severity}
                options={videoAuditSeverities}
                allLabel="All Severity"
                onValueChange={(value) => setFilters((current) => ({ ...current, severity: value }))}
              />

              {hasFilters && (
                <Button variant="outline" onClick={clearFilters} className="h-9 rounded-xl border-border px-3 text-[12px] text-muted-foreground hover:bg-background">
                  <X size={12} className="mr-1.5" />
                  Clear
                </Button>
              )}

              <div className="ml-auto flex items-center gap-1.5 text-[11px] text-subtle-foreground">
                <FileSearch size={11} />
                {filteredEvents.length} result{filteredEvents.length !== 1 ? "s" : ""}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <Table className="w-full table-fixed">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[13%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-border bg-background hover:bg-background">
                {[
                  "Event ID",
                  "Booking ID",
                  "Customer",
                  "Vehicle",
                  "Event Type",
                  "Severity",
                  "Video Status",
                  "Audit Status",
                  "Actions",
                ].map((heading) => (
                  <TableHead key={heading} className="whitespace-normal px-2 py-2 text-[9.5px] font-semibold uppercase leading-tight tracking-wide text-subtle-foreground">
                    {heading}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                        <Video size={21} className="text-primary" />
                      </div>
                      <p className="text-[13px] font-semibold text-muted-foreground">No flagged events found.</p>
                      <p className="text-[11.5px] text-subtle-foreground">Try a different search term or filter.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((event) => (
                  <TableRow key={event.id} className="border-b border-background transition-colors duration-100 hover:bg-background">
                    <TableCell className="whitespace-normal break-words px-2 py-2 align-top font-mono text-[11px] font-semibold text-primary">{event.id}</TableCell>
                    <TableCell className="whitespace-normal break-words px-2 py-2 align-top font-mono text-[11px] text-muted-foreground">{event.bookingId}</TableCell>
                    <TableCell className="max-w-[150px] whitespace-normal break-words px-2 py-2 align-top text-[11.5px] font-semibold text-foreground">{event.customerName}</TableCell>
                    <TableCell className="max-w-[150px] whitespace-normal break-words px-2 py-2 align-top text-[11px] text-muted-foreground">{event.vehicleName}</TableCell>
                    <TableCell className="max-w-[140px] whitespace-normal break-words px-2 py-2 align-top text-[11px] font-semibold text-foreground">{event.eventType}</TableCell>
                    <TableCell className="whitespace-normal px-2 py-2 align-top">
                      <SeverityBadge severity={event.severity} />
                    </TableCell>
                    <TableCell className="whitespace-normal px-2 py-2 align-top">
                      <VideoStatusBadge status={event.videoStatus} />
                    </TableCell>
                    <TableCell className="whitespace-normal px-2 py-2 align-top">
                      <AuditStatusBadge status={event.auditStatus} />
                    </TableCell>
                    <TableCell className="whitespace-normal px-2 py-2 align-top">
                      <Button
                        variant="outline"
                        onClick={() => openAudit(event)}
                        className="h-8 rounded-lg border-border px-2.5 text-[11.5px] font-semibold text-primary hover:bg-muted"
                      >
                        <Eye size={12} className="mr-1.5" />
                        Audit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Sheet open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEventId(null)}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="!left-[var(--sidebar-w)] !right-0 !w-[calc(100vw-var(--sidebar-w))] !max-w-none gap-0 overflow-hidden border-l border-border bg-background p-0 max-md:!left-0 max-md:!w-screen"
        >
          <SheetHeader className="shrink-0 border-b border-border bg-white px-5 pb-4 pt-5 md:px-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedEventId(null)}
                  className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors duration-150 hover:text-primary"
                >
                  <ChevronLeft size={15} />
                  Video Evidence Auditing
                </button>
                <SheetTitle className="text-xl font-bold tracking-tight text-foreground">Video Audit Review</SheetTitle>
                <SheetDescription className="sr-only">
                  Review flagged event details, attach dashcam evidence, and save an audit decision.
                </SheetDescription>
                <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">{selectedEvent?.id}</p>
              </div>
              {selectedEvent ? <AuditStatusBadge status={selectedEvent.auditStatus} /> : null}
            </div>
          </SheetHeader>

          {selectedEvent ? (
            <ScrollArea className="h-[calc(100vh-96px)]">
              <div className="mx-auto max-w-[1500px] space-y-5 px-5 py-5 md:px-8 md:py-6">
                <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold text-foreground">{selectedEvent.eventType}</h2>
                          <SeverityBadge severity={selectedEvent.severity} />
                        </div>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">
                          {selectedEvent.bookingId} - {selectedEvent.customerName} - {selectedEvent.vehicleName}
                        </p>
                        <p className="mt-3 text-[13px] font-medium leading-6 text-muted-foreground">{selectedEvent.sensorSummary}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <VideoStatusBadge status={selectedEvent.videoStatus} />
                        <AuditStatusBadge status={selectedEvent.auditStatus} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                  <CardContent className="p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-[13px] font-bold text-foreground">Video Evidence</p>
                      <VideoStatusBadge status={selectedEvent.videoStatus} />
                    </div>

                    {selectedEvent.evidence ? (
                      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl bg-[#101828] p-6 text-center text-white">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/12">
                          <PlayCircle size={34} />
                        </div>
                        <p className="mt-4 text-[15px] font-bold">Mock dashcam video preview</p>
                        <p className="mt-1 max-w-md text-[12px] leading-relaxed text-white/65">
                          This placeholder represents the manually retrieved dashcam file linked to the selected flagged event.
                        </p>
                      </div>
                    ) : (
                      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-background p-6 text-center">
                        <FileVideo size={42} className="text-primary" />
                        <p className="mt-3 text-[14px] font-bold text-foreground">No video evidence uploaded yet</p>
                        <p className="mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">
                          Attach the matching dashcam clip after retrieving it from SD card, Wi-Fi file access, or local storage.
                        </p>
                      </div>
                    )}

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <DetailItem label="File Name" value={selectedEvent.evidence?.fileName} icon={FileVideo} />
                      <DetailItem label="Uploaded By" value={selectedEvent.evidence?.uploadedBy} icon={User} />
                      <DetailItem label="Uploaded Date" value={selectedEvent.evidence?.uploadedDate} icon={CalendarClock} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Label
                        htmlFor="video-evidence-input"
                        className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-primary px-4 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(52,110,246,0.28)] hover:bg-primary-hover"
                      >
                        <Upload size={14} className="mr-2" />
                        {selectedEvent.evidence ? "Replace Video" : "Upload Video"}
                      </Label>
                      <Input
                        id="video-evidence-input"
                        type="file"
                        accept="video/mp4,video/quicktime,video/x-msvideo,.mp4,.mov,.avi"
                        onChange={(event) => handleVideoSelected(event.target.files?.[0] ?? null)}
                        className="sr-only"
                      />
                      <Button
                        variant="outline"
                        onClick={() => markMissingVideo(selectedEvent)}
                        className="h-10 rounded-xl border-orange-200 px-4 text-[13px] font-semibold text-orange-600 hover:bg-orange-50"
                      >
                        <FileX size={14} className="mr-2" />
                        Mark as Missing Video
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                  <CardContent className="p-5">
                    <p className="mb-4 text-[13px] font-bold text-foreground">Event Details</p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <DetailItem label="Event ID" value={selectedEvent.id} icon={FileSearch} />
                      <DetailItem label="Booking ID" value={selectedEvent.bookingId} icon={BadgeCheck} />
                      <DetailItem label="Customer" value={selectedEvent.customerName} icon={User} />
                      <DetailItem label="Vehicle" value={selectedEvent.vehicleName} icon={Car} />
                      <DetailItem label="Event Type" value={selectedEvent.eventType} icon={AlertTriangle} />
                      <DetailItem label="Timestamp" value={selectedEvent.timestamp} icon={CalendarClock} />
                      <DetailItem label="Speed" value={selectedEvent.speed} icon={Gauge} />
                      <div className="sm:col-span-2 xl:col-span-4">
                        <DetailItem label="Location" value={selectedEvent.location} icon={MapPin} />
                      </div>
                      <DetailItem label="Severity" value={selectedEvent.severity} icon={AlertTriangle} />
                      <DetailItem label="Coordinates" value={`${selectedEvent.latitude}, ${selectedEvent.longitude}`} icon={MapPin} />
                      <div className="sm:col-span-2 xl:col-span-4">
                        <DetailItem label="Sensor Summary" value={selectedEvent.sensorSummary} icon={FileSearch} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.6fr)]">
                  <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                    <CardContent className="p-5">
                      <p className="mb-4 text-[13px] font-bold text-foreground">Audit Decision</p>
                      <div className="space-y-3">
                        <div>
                          <Label className="mb-2 text-[12px] font-semibold text-muted-foreground">Audit Status</Label>
                          <Select
                            value={auditForm.auditStatus}
                            onValueChange={(value) =>
                              setAuditForm((current) => ({
                                ...current,
                                auditStatus: value as AuditStatus,
                              }))
                            }
                          >
                            <SelectTrigger className="h-10 rounded-xl border-border bg-background text-[12.5px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {videoAuditStatuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="mb-2 text-[12px] font-semibold text-muted-foreground">Decision</Label>
                          <Select
                            value={auditForm.decision}
                            onValueChange={(value) =>
                              setAuditForm((current) => ({
                                ...current,
                                decision: value as AuditDecision,
                              }))
                            }
                          >
                            <SelectTrigger className="h-10 rounded-xl border-border bg-background text-[12.5px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {videoAuditDecisions.map((item) => (
                                <SelectItem key={item} value={item}>
                                  {item}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="audit-remarks" className="mb-2 text-[12px] font-semibold text-muted-foreground">
                            Remarks
                          </Label>
                          <Textarea
                            id="audit-remarks"
                            value={auditForm.remarks}
                            onChange={(event) =>
                              setAuditForm((current) => ({
                                ...current,
                                remarks: event.target.value,
                              }))
                            }
                            placeholder="Write audit notes based on the uploaded dashcam evidence..."
                            className="min-h-32 rounded-xl border-border bg-background text-[12.5px] focus-visible:ring-1 focus-visible:ring-primary"
                          />
                        </div>

                        <Button onClick={saveAudit} className="h-10 w-full rounded-xl bg-primary text-[13px] font-semibold text-white hover:bg-primary-hover">
                          <Save size={14} className="mr-2" />
                          Save Audit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
                    <CardContent className="p-5">
                      <p className="mb-4 text-[13px] font-bold text-foreground">Audit History</p>
                      <div className="space-y-2">
                        {selectedEvent.auditHistory.map((item) => (
                          <div key={item.id} className="flex gap-2 rounded-xl bg-background px-3 py-2 text-[12px] font-medium leading-relaxed text-muted-foreground">
                            <History size={13} className="mt-0.5 shrink-0 text-primary" />
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
