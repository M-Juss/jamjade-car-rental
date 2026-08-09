"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { appToast as sonnerToast } from "@/lib/toast";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Mail,
  Phone,
  RotateCcw,
  RotateCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableActionMenu } from "@/components/common/TableActionMenu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  approveVerification,
  getVerificationRecords,
  rejectVerification,
  type DocumentType,
  type FileType,
  type VerificationRecord,
  type VerificationStatus,
} from "@/services/verification";
import {
  GENERIC_ERROR_MESSAGE,
  GENERIC_SUCCESS_MESSAGE,
} from "@/services/http";

type SortOrder = "newest" | "oldest";
type FilterStatus = "all" | VerificationStatus;
type FilterDocumentType = "all" | DocumentType;

interface DocumentPreviewSelection {
  title: string;
  url: string;
  fileType: FileType;
  alt: string;
}

const DOCUMENT_TYPES: DocumentType[] = [
  "Valid ID",
  "Passport",
  "Meralco Bill",
  "Driver's License",
];
const statusMeta: Record<
  VerificationStatus,
  { label: string; badge: string; icon: typeof Clock }
> = {
  pending: {
    label: "Pending",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    badge: "bg-rose-50 text-rose-600 border-rose-200",
    icon: XCircle,
  },
};

const quickReasons = [
  "Blurry or unreadable document",
  "Expired document",
  "Name does not match account",
  "Wrong document type uploaded",
  "Suspected fake or altered document",
  "Missing required information",
];

const formatDate = (value?: string) => {
  if (!value) return "Not provided";
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

const getDocumentSide = (
  record: VerificationRecord,
  side: "front" | "back",
) => {
  const sideUrl =
    side === "front" ? record.documentFrontUrl : record.documentBackUrl;

  return {
    url: sideUrl || (side === "front" ? record.documentUrl : undefined),
  };
};

const canReview = (record: VerificationRecord) => record.status === "pending";
const hasBackSide = (record: VerificationRecord) =>
  record.documentType === "Valid ID" ||
  record.documentType === "Driver's License";

function StatusBadge({ status }: { status: VerificationStatus }) {
  const Icon = statusMeta[status].icon;

  return (
    <Badge
      variant="outline"
      className={`h-auto min-h-6 max-w-full whitespace-normal rounded-lg px-2 text-center text-[10px] font-semibold leading-tight ${statusMeta[status].badge}`}
    >
      <Icon size={12} />
      {statusMeta[status].label}
    </Badge>
  );
}

function DocumentSidePreview({
  record,
  side,
  label,
  onOpen,
}: {
  record: VerificationRecord;
  side: "front" | "back";
  label: string;
  onOpen: (preview: DocumentPreviewSelection) => void;
}) {
  const documentSide = getDocumentSide(record, side);
  const [imageError, setImageError] = useState(false);
  const hasPreview = Boolean(documentSide.url) && !imageError;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-white px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <Button
          variant="outline"
          aria-label={`Open ${record.documentType} ${label} preview`}
          disabled={!hasPreview}
          onClick={() => {
            if (!documentSide.url) return;

            onOpen({
              title: `${record.documentType} - ${label}`,
              url: documentSide.url,
              fileType: "image",
              alt: `${record.documentType} ${label.toLowerCase()} preview`,
            });
          }}
          className="h-7 rounded-lg border-border px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-primary"
        >
          <ExternalLink size={12} className="mr-1.5" />
          Open
        </Button>
      </div>
      {hasPreview && documentSide.url ? (
        <Image
          src={documentSide.url}
          alt={`${record.documentType} ${label.toLowerCase()} preview`}
          width={960}
          height={640}
          unoptimized
          onError={() => setImageError(true)}
          className="h-auto w-full object-cover"
        />
      ) : (
        <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
          <FileText size={34} className="text-subtle-foreground" />
          <p className="mt-3 text-[12px] font-semibold text-muted-foreground">
            No {label.toLowerCase()} image was uploaded.
          </p>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value?: string | number;
}) {
  return (
    <div className="rounded-xl bg-background px-3 py-2 w-full">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[12.5px] font-semibold text-foreground">
        {value || "Not provided"}
      </p>
    </div>
  );
}

export default function VerificationQueue() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [documentFilter, setDocumentFilter] =
    useState<FilterDocumentType>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedRecord, setSelectedRecord] =
    useState<VerificationRecord | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [actionRecord, setActionRecord] = useState<VerificationRecord | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [previewDocument, setPreviewDocument] =
    useState<DocumentPreviewSelection | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewRotation, setPreviewRotation] = useState(0);

  useEffect(() => {
    let isMounted = true;

    getVerificationRecords()
      .then((items) => {
        if (!isMounted) return;
        setRecords(items);
      })
      .catch(() => {
        if (!isMounted) return;
        setRecords([]);
        sonnerToast.error(GENERIC_ERROR_MESSAGE);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const showMessage = (tone: "success" | "error" = "success") => {
    if (tone === "success") {
      sonnerToast.success(GENERIC_SUCCESS_MESSAGE);
      return;
    }

    sonnerToast.error(GENERIC_ERROR_MESSAGE);
  };

  const openDocumentPreview = (preview: DocumentPreviewSelection) => {
    setPreviewDocument(preview);
    setPreviewZoom(1);
    setPreviewRotation(0);
  };

  const adjustPreviewZoom = (nextStep: number) => {
    setPreviewZoom((current) =>
      Math.min(2.5, Math.max(0.5, Number((current + nextStep).toFixed(2)))),
    );
  };

  const rotatePreview = (degrees: number) => {
    setPreviewRotation((current) => (current + degrees + 360) % 360);
  };

  const counts = useMemo(
    () => ({
      pending: records.filter((record) => record.status === "pending").length,
      approved: records.filter((record) => record.status === "approved").length,
      rejected: records.filter((record) => record.status === "rejected").length,
    }),
    [records],
  );

  const filteredRecords = useMemo(() => {
    return records
      .filter((record) => {
        const haystack = [
          record.id,
          record.customerName,
          record.email,
          record.contactNumber,
          record.documentType,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch = haystack.includes(search.toLowerCase());
        const matchesStatus =
          statusFilter === "all" || record.status === statusFilter;
        const matchesDocument =
          documentFilter === "all" || record.documentType === documentFilter;

        return matchesSearch && matchesStatus && matchesDocument;
      })
      .sort((a, b) => {
        const dateA = new Date(a.submittedAt).getTime();
        const dateB = new Date(b.submittedAt).getTime();
        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
      });
  }, [documentFilter, records, search, sortOrder, statusFilter]);

  const openApprove = (record: VerificationRecord) => {
    setActionRecord(record);
    setApproveOpen(true);
  };

  const openReject = (record: VerificationRecord) => {
    setActionRecord(record);
    setRejectReason(record.rejectionComment || "");
    setRejectError("");
    setRejectOpen(true);
  };

  const replaceRecord = (updatedRecord: VerificationRecord) => {
    setRecords((current) =>
      current.map((record) =>
        record.backendId === updatedRecord.backendId ? updatedRecord : record,
      ),
    );
    setSelectedRecord((current) =>
      current?.backendId === updatedRecord.backendId ? updatedRecord : current,
    );
  };

  const handleApprove = async () => {
    if (!actionRecord) return;

    setIsActionSubmitting(true);

    try {
      const updatedRecord = await approveVerification(actionRecord);
      replaceRecord(updatedRecord);
      setApproveOpen(false);
      showMessage();
    } catch {
      showMessage("error");
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!actionRecord) return;

    if (!rejectReason.trim()) {
      setRejectError("Rejection notes are required.");
      return;
    }

    setIsActionSubmitting(true);

    try {
      const updatedRecord = await rejectVerification(
        actionRecord,
        rejectReason.trim(),
      );
      replaceRecord(updatedRecord);
      setRejectOpen(false);
      setRejectReason("");
      showMessage();
    } catch {
      showMessage("error");
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDocumentFilter("all");
    setSortOrder("newest");
  };

  const appendQuickReason = (reason: string) => {
    setRejectReason((current) => {
      if (!current.trim()) return reason;
      if (current.includes(reason)) return current;
      return `${current.trim()}\n${reason}`;
    });
    setRejectError("");
  };

  const reviewReminders = selectedRecord
    ? [
        "Confirm the document is clear and readable before approving.",
        "Compare the document name against the customer account details.",
        "Check the expiry date when the submitted document has one.",
        "Watch for signs of alteration, fake IDs, or mismatched information.",
        "Confirm the uploaded file matches the required document type.",
        ...(selectedRecord.documentType === "Meralco Bill"
          ? [
              "For Meralco Bill, make sure the service address is visible and readable.",
            ]
          : []),
      ]
    : [];

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Verification Queue
              </h1>
              <Badge
                variant="outline"
                className="h-6 rounded-lg border-amber-200 bg-amber-50 px-2.5 text-[10.5px] font-semibold text-amber-700"
              >
                {counts.pending} pending
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Review customer-submitted documents for self-drive eligibility.
            </p>
          </div>
          <div className="rounded-2xl border border-[#DDE6FF] bg-muted px-4 py-3 text-[12px] font-medium text-primary shadow-[0_2px_12px_rgba(52,110,246,0.06)]">
            <ShieldCheck size={15} className="mr-2 inline-block align-[-3px]" />
            Document checks help prevent fake IDs and vehicle misuse.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              label: "Pending Review",
              value: counts.pending,
              icon: Clock,
              bg: "bg-amber-50",
              color: "text-amber-600",
            },
            {
              label: "Approved Documents",
              value: counts.approved,
              icon: BadgeCheck,
              bg: "bg-emerald-50",
              color: "text-emerald-600",
            },
            {
              label: "Rejected Documents",
              value: counts.rejected,
              icon: XCircle,
              bg: "bg-rose-50",
              color: "text-rose-500",
            },
          ].map(({ label, value, icon: Icon, bg, color }) => (
            <Card
              key={label}
              className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(52,110,246,0.1)]"
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}
                >
                  <Icon size={17} className={color} strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[22px] font-bold leading-none text-foreground">
                    {value}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                    {label}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] flex-1">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle-foreground"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, email, contact, or document type..."
                  className="h-9 rounded-xl border-border bg-background pl-8 text-[12.5px] focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as FilterStatus)
                }
              >
                <SelectTrigger className="h-9 w-full rounded-xl border-border bg-background text-[12.5px] sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(statusMeta).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={documentFilter}
                onValueChange={(value) =>
                  setDocumentFilter(value as FilterDocumentType)
                }
              >
                <SelectTrigger className="h-9 w-full rounded-xl border-border bg-background text-[12.5px] sm:w-[180px]">
                  <SelectValue placeholder="Document Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={sortOrder}
                onValueChange={(value) => setSortOrder(value as SortOrder)}
              >
                <SelectTrigger className="h-9 w-full rounded-xl border-border bg-background text-[12.5px] sm:w-[145px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>

              {(search ||
                statusFilter !== "all" ||
                documentFilter !== "all" ||
                sortOrder !== "newest") && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="h-9 rounded-xl border-border px-3 text-[12px] text-muted-foreground hover:bg-background"
                >
                  <X size={12} className="mr-1.5" />
                  Clear
                </Button>
              )}

              <div className="ml-auto flex items-center gap-1.5 text-[11px] text-subtle-foreground">
                <Filter size={11} />
                {filteredRecords.length} result
                {filteredRecords.length !== 1 ? "s" : ""}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-visible rounded-2xl border-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.05)] [&_[data-slot=table-container]]:overflow-visible">
          <Table className="w-full table-fixed">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[16%]" />
              <col className="w-[24%]" />
              <col className="w-[14%]" />
              <col className="w-[16%]" />
              <col className="w-[11%]" />
              <col className="w-[6%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-border bg-background hover:bg-background">
                {[
                  "Verification ID",
                  "Customer Name",
                  "Email / Contact",
                  "Document Type",
                  "Submitted Date",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <TableHead
                    key={heading}
                    className="whitespace-normal break-words px-2 py-2 text-[9.5px] font-semibold uppercase leading-tight tracking-wide text-subtle-foreground"
                  >
                    {heading}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index} className="border-b border-background">
                    {Array.from({ length: 7 }).map((__, cellIndex) => (
                      <TableCell
                        key={cellIndex}
                        className="whitespace-normal px-2 py-3"
                      >
                        <div className="h-4 w-full animate-pulse rounded-md bg-border" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                        <FileCheck size={21} className="text-primary" />
                      </div>
                      <p className="text-[13px] font-semibold text-muted-foreground">
                        No documents waiting for verification.
                      </p>
                      <p className="text-[11.5px] text-subtle-foreground">
                        Submitted customer documents will appear here.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRecords.map((record) => (
                  <TableRow
                    key={record.id}
                    className="border-b border-background transition-colors duration-100 hover:bg-background"
                  >
                    <TableCell className="whitespace-normal break-words px-2 py-2 align-top font-mono text-[11px] font-semibold leading-snug text-primary">
                      {record.id}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-2 py-2 align-top">
                      <span className="text-[11.5px] font-semibold leading-snug text-foreground">
                        {record.customerName}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-2 py-2 align-top">
                      <div className="space-y-0.5 text-[11px] leading-snug">
                        <p className="break-all text-muted-foreground">
                          {record.email}
                        </p>
                        <p className="text-muted-foreground">{record.contactNumber}</p>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-2 py-2 align-top text-[11px] font-semibold leading-snug text-foreground">
                      {record.documentType}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words px-2 py-2 align-top text-[11px] leading-snug text-muted-foreground">
                      {formatDate(record.submittedAt)}
                    </TableCell>
                    <TableCell className="whitespace-normal px-2 py-2 align-top">
                      <StatusBadge status={record.status} />
                    </TableCell>
                    <TableCell className="whitespace-normal px-2 py-2 align-top">
                      <TableActionMenu
                        label={`Open actions for ${record.id}`}
                        items={[
                          {
                            label: "View",
                            icon: (
                              <Eye size={13} className="mr-2 text-subtle-foreground" />
                            ),
                            onClick: () => setSelectedRecord(record),
                          },
                          {
                            label: "Approve",
                            icon: <CheckCircle2 size={13} className="mr-2" />,
                            onClick: () => openApprove(record),
                            disabled: !canReview(record) || isActionSubmitting,
                            separatorBefore: true,
                            variant: "success",
                          },
                          {
                            label: "Reject",
                            icon: <XCircle size={13} className="mr-2" />,
                            onClick: () => openReject(record),
                            disabled: !canReview(record) || isActionSubmitting,
                            variant: "danger",
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Sheet
        open={Boolean(selectedRecord)}
        onOpenChange={(open) => !open && setSelectedRecord(null)}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 border-l border-border p-0 sm:max-w-[720px]"
        >
          <SheetHeader className="border-b border-border px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-4 pr-8">
              <div>
                <SheetTitle className="text-[15px] font-bold text-foreground">
                  Document Review
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Review customer and uploaded document details before approving
                  or rejecting verification.
                </SheetDescription>
                <p className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                  {selectedRecord?.id}
                </p>
              </div>
              {selectedRecord && <StatusBadge status={selectedRecord.status} />}
            </div>
          </SheetHeader>

          {selectedRecord && (
            <ScrollArea className="h-[calc(100vh-76px)]">
              <div className="space-y-4 px-5 py-4">
                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">
                    Customer Information
                  </p>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
                      <User size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-foreground">
                        {selectedRecord.customerName}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11.5px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Mail size={11} />
                          {selectedRecord.email}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Phone size={11} />
                          {selectedRecord.contactNumber}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-3">
                    <div className="flex w-full space-x-3">
                      <DetailItem
                        label="Date of Birth"
                        value={selectedRecord.dateOfBirth}
                      />
                      <DetailItem label="Age" value={selectedRecord.age} />
                    </div>
                    <DetailItem
                      label="Address"
                      value={selectedRecord.address}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">
                      Document Preview
                    </p>
                  </div>

                  {selectedRecord.fileType === "image" ? (
                    <div
                      className={`grid gap-3 ${hasBackSide(selectedRecord) ? "lg:grid-cols-2" : ""}`}
                    >
                      <DocumentSidePreview
                        record={selectedRecord}
                        side="front"
                        label={
                          hasBackSide(selectedRecord)
                            ? "Front Side"
                            : "Document"
                        }
                        onOpen={openDocumentPreview}
                      />
                      {hasBackSide(selectedRecord) && (
                        <DocumentSidePreview
                          record={selectedRecord}
                          side="back"
                          label="Back Side"
                          onOpen={openDocumentPreview}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-background p-6 text-center">
                      <FileText size={42} className="text-primary" />
                      <p className="mt-3 text-[14px] font-bold text-foreground">
                        PDF document uploaded
                      </p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Open it in a modal preview when file storage is
                        connected.
                      </p>
                      <Button
                        onClick={() =>
                          openDocumentPreview({
                            title: `${selectedRecord.documentType} PDF`,
                            url: selectedRecord.documentUrl,
                            fileType: "pdf",
                            alt: `${selectedRecord.documentType} PDF preview`,
                          })
                        }
                        className="mt-4 rounded-xl bg-primary text-white hover:bg-primary-hover"
                      >
                        <ExternalLink size={14} className="mr-2" />
                        Open PDF
                      </Button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">
                    Document Information
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <DetailItem
                      label="Document Type"
                      value={selectedRecord.documentType}
                    />
                    <DetailItem
                      label="Submitted Date"
                      value={formatDate(selectedRecord.submittedAt)}
                    />
                    {selectedRecord.documentNumber && (
                      <DetailItem
                        label="Document Number"
                        value={selectedRecord.documentNumber}
                      />
                    )}
                    {selectedRecord.expiresAt && (
                      <DetailItem
                        label="Expiration Date"
                        value={formatDate(selectedRecord.expiresAt)}
                      />
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-subtle-foreground">
                    Verification Reminders
                  </p>
                  <ul className="list-disc space-y-1.5 pl-5 text-[12.5px] font-medium leading-relaxed text-muted-foreground">
                    {reviewReminders.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                {canReview(selectedRecord) && (
                  <div className="sticky bottom-0 -mx-5 border-t border-border bg-white/95 px-5 py-4 backdrop-blur">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        onClick={() => openReject(selectedRecord)}
                        className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        <XCircle size={14} className="mr-2" />
                        Reject
                      </Button>
                      <Button
                        onClick={() => openApprove(selectedRecord)}
                        className="rounded-xl bg-emerald-500 text-white hover:bg-emerald-600"
                      >
                        <CheckCircle2 size={14} className="mr-2" />
                        Approve Document
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={Boolean(previewDocument)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewDocument(null);
            setPreviewZoom(1);
            setPreviewRotation(0);
          }
        }}
      >
        <DialogContent className="flex h-[82vh] max-h-[760px] !w-[75vw] !max-w-[1120px] flex-col gap-0 rounded-2xl border-0 p-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)] max-md:!w-[calc(100vw-1rem)] max-md:!max-w-[calc(100vw-1rem)]">
          <DialogHeader className="shrink-0 border-b border-border px-5 pb-4 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-[15px] font-bold text-foreground">
                  {previewDocument?.title}
                </DialogTitle>
              </div>
              {previewDocument?.fileType === "image" && (
                <div className="flex items-center gap-1 rounded-xl border border-border bg-white p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Rotate document left"
                    title="Rotate left"
                    onClick={() => rotatePreview(-90)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                  >
                    <RotateCcw size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Rotate document right"
                    title="Rotate right"
                    onClick={() => rotatePreview(90)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                  >
                    <RotateCw size={15} />
                  </Button>
                  <div className="mx-1 h-5 w-px bg-border" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Zoom document out"
                    title="Zoom out"
                    disabled={previewZoom <= 0.5}
                    onClick={() => adjustPreviewZoom(-0.25)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                  >
                    <ZoomOut size={15} />
                  </Button>
                  <span className="min-w-12 text-center text-[11px] font-semibold text-muted-foreground">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Zoom document in"
                    title="Zoom in"
                    disabled={previewZoom >= 2.5}
                    onClick={() => adjustPreviewZoom(0.25)}
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"
                  >
                    <ZoomIn size={15} />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-auto bg-background p-4">
            {previewDocument?.fileType === "image" ? (
              <div className="flex min-h-full items-start justify-center p-4">
                <Image
                  src={previewDocument.url}
                  alt={previewDocument.alt}
                  width={960}
                  height={640}
                  unoptimized
                  onError={() => {
                    setPreviewDocument(null);
                    sonnerToast.error("The uploaded document image could not be loaded.");
                  }}
                  className="h-auto shrink-0 max-w-none rounded-xl border border-border bg-white object-contain shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-[width,transform] duration-200"
                  style={{
                    width: `${previewZoom * 100}%`,
                    transform: `rotate(${previewRotation}deg)`,
                    transformOrigin: "center",
                  }}
                />
              </div>
            ) : (
              <div className="flex min-h-full items-center justify-center">
                <div className="flex aspect-[3/4] min-h-[360px] w-full max-w-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-6 text-center shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                  <FileText size={46} className="text-primary" />
                  <p className="mt-3 text-[14px] font-bold text-foreground">
                    PDF preview placeholder
                  </p>
                  <p className="mt-1 max-w-xs text-[12px] text-muted-foreground">
                    Laravel file storage can replace this with an embedded PDF
                    viewer later.
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent className="max-w-[410px] rounded-2xl border-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <AlertDialogHeader>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
              <ShieldCheck size={21} className="text-emerald-500" />
            </div>
            <AlertDialogTitle className="text-[16px] font-bold text-foreground">
              Approve this document?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
              This will mark the customer document as verified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 flex gap-2">
            <AlertDialogCancel className="h-10 flex-1 rounded-xl border-border text-[13px] text-muted-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApprove}
              disabled={isActionSubmitting}
              className="h-10 flex-1 rounded-xl bg-emerald-500 text-[13px] font-semibold text-white hover:bg-emerald-600"
            >
              {isActionSubmitting ? "Approving..." : "Approve Document"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-[540px] gap-0 rounded-2xl border-0 p-0 shadow-[0_24px_64px_rgba(0,0,0,0.13)]">
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50">
                <ShieldAlert size={18} className="text-rose-500" />
              </div>
              <div>
                <DialogTitle className="text-[15px] font-bold text-foreground">
                  Reject Document
                </DialogTitle>
                <DialogDescription className="text-[11.5px] text-muted-foreground">
                  Add a clear reason so the customer can resubmit from mobile.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            <div>
              <Label className="mb-2 text-[12px] font-semibold text-muted-foreground">
                Quick reasons
              </Label>
              <div className="flex flex-wrap gap-2">
                {quickReasons.map((reason) => (
                  <Button
                    key={reason}
                    variant="outline"
                    onClick={() => appendQuickReason(reason)}
                    className="h-8 rounded-xl border-border px-2.5 text-[12px] text-muted-foreground hover:bg-muted hover:text-primary"
                  >
                    {reason}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label
                htmlFor="reject-reason"
                className="mb-2 text-[12px] font-semibold text-muted-foreground"
              >
                Rejection notes <span className="text-rose-500">*</span>
              </Label>
              <Textarea
                id="reject-reason"
                required
                value={rejectReason}
                onChange={(event) => {
                  setRejectReason(event.target.value);
                  setRejectError("");
                }}
                placeholder="Explain why this document was rejected. This message may be shown to the customer."
                className="min-h-32 rounded-xl border-border bg-background text-[12.5px] focus-visible:ring-1 focus-visible:ring-primary"
              />
              {rejectError && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-rose-600">
                  <AlertTriangle size={13} />
                  {rejectError}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border bg-background px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              className="h-10 rounded-xl border-border px-4 text-[13px] text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isActionSubmitting}
              className="h-10 rounded-xl bg-rose-500 px-4 text-[13px] font-semibold text-white hover:bg-rose-600"
            >
              {isActionSubmitting ? "Rejecting..." : "Reject Document"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
