"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Eye, FileCheck, FileText, ShieldCheck, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { appToast } from "@/lib/toast";
import { RejectDocumentDialog } from "@/forms/verification/RejectDocumentDialog";
import { approveVerification, getSelfDriveCustomer, getSelfDriveCustomers, type SelfDriveCustomer, type SelfDriveCustomerPage, type SelfDriveReviewStatus, type VerificationRecord } from "@/services/verification";
import { VerificationDocumentSidePreview, type DocumentPreviewSelection } from "./components/VerificationDocumentSidePreview";
import { VerificationStatusBadge } from "./components/VerificationStatusBadge";

type EligibilityFilter = "all" | "eligible" | "not_eligible";

const reviewStatus: Record<SelfDriveReviewStatus, { label: string; className: string }> = {
  eligible: { label: "Eligible", className: "border-success-border bg-success-surface text-success" },
  pending_review: { label: "Pending review", className: "border-warning-border bg-warning-surface text-warning" },
  needs_correction: { label: "Needs correction", className: "border-destructive-border bg-destructive-surface text-destructive" },
  documents_required: { label: "Documents required", className: "border-border bg-background text-muted-foreground" },
  age_ineligible: { label: "Age requirement not met", className: "border-destructive-border bg-destructive-surface text-destructive" },
};

const documentLabels: Record<string, string> = {
  drivers_license: "Driver's License",
  proof_of_billing: "Meralco Bill",
  passport: "Passport",
};

function ReviewStatusBadge({ status }: { status: SelfDriveReviewStatus }) {
  const meta = reviewStatus[status];
  return <Badge variant="outline" className={`h-auto min-h-6 whitespace-normal rounded-lg px-2 text-center text-[10px] font-semibold ${meta.className}`}>{meta.label}</Badge>;
}

function formatDate(value?: string | null) {
  if (!value) return "Not provided";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function SelfDriveVerificationModule() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [eligibility, setEligibility] = useState<EligibilityFilter>("all");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SelfDriveCustomerPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [customer, setCustomer] = useState<SelfDriveCustomer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentPreviewSelection | null>(null);
  const [approveRecord, setApproveRecord] = useState<VerificationRecord | null>(null);
  const [rejectRecord, setRejectRecord] = useState<VerificationRecord | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim() !== search) {
        setIsLoading(true);
        setLoadError(false);
        setPage(1);
        setSearch(searchInput.trim());
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    let live = true;
    getSelfDriveCustomers({ search, eligibility, page })
      .then((data) => { if (live) setResult(data); })
      .catch(() => { if (live) setLoadError(true); })
      .finally(() => { if (live) setIsLoading(false); });
    return () => { live = false; };
  }, [search, eligibility, page, reloadKey]);

  useEffect(() => {
    if (selectedId === null) return;
    let live = true;
    getSelfDriveCustomer(selectedId)
      .then((data) => { if (live) setCustomer(data); })
      .catch(() => { if (live) setDetailError(true); })
      .finally(() => { if (live) setDetailLoading(false); });
    return () => { live = false; };
  }, [selectedId, reloadKey]);

  const selectedDocument = customer?.documents?.find(({ type }) => type === activeType)?.document ?? null;
  const openCustomer = (id: number) => {
    setCustomer(null);
    setActiveType(null);
    setDetailLoading(true);
    setDetailError(false);
    setSelectedId(id);
  };
  const refresh = () => {
    setIsLoading(true);
    setLoadError(false);
    if (selectedId !== null) { setCustomer(null); setDetailLoading(true); setDetailError(false); }
    setReloadKey((value) => value + 1);
  };
  const approve = async () => {
    if (!approveRecord) return;
    setIsApproving(true);
    try {
      await approveVerification(approveRecord);
      setApproveRecord(null);
      appToast.success("Document approved successfully.");
      refresh();
    } catch {
      appToast.error("The document could not be approved. Please try again.");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Self-Drive Verification</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Review customer documents and track self-drive eligibility.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard label="Customers" value={result?.summary.total ?? "—"} icon={Users} />
          <KpiCard label="Eligible for Self Drive" value={result?.summary.eligible ?? "—"} icon={ShieldCheck} />
          <KpiCard label="Not Eligible" value={result?.summary.notEligible ?? "—"} icon={Clock} />
        </div>

        <Card className="rounded-2xl border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <CardContent className="flex flex-wrap items-center gap-2.5 p-4">
            <SearchInput value={searchInput} onValueChange={setSearchInput} placeholder="Search customer name, email, or phone number..." wrapperClassName="min-w-[220px] flex-1" />
            <FilterSelect
              value={eligibility}
              onValueChange={(value) => { setIsLoading(true); setLoadError(false); setEligibility(value as EligibilityFilter); setPage(1); }}
              ariaLabel="Filter customers by self-drive eligibility"
              placeholder="Eligibility"
              className="sm:w-[210px]"
              options={[
                { value: "all", label: "All Customers" },
                { value: "eligible", label: "Eligible for Self Drive" },
                { value: "not_eligible", label: "Not Eligible" },
              ]}
            />
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden rounded-2xl border-0 bg-surface shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="border-b border-border bg-background hover:bg-background">
                {["Customer", "Email", "Phone Number", "Review Status", "Self Drive", "Actions"].map((heading) => (
                  <TableHead key={heading} className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wide text-subtle-foreground">{heading}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>{Array.from({ length: 6 }).map((__, cell) => (
                  <TableCell key={cell} className="px-3 py-3"><div className="h-4 animate-pulse rounded-md bg-border" /></TableCell>
                ))}</TableRow>
              )) : loadError ? (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-destructive">
                  Customers could not be loaded. <Button variant="outline" onClick={refresh} className="ml-2">Retry</Button>
                </TableCell></TableRow>
              ) : !result?.customers.length ? (
                <TableRow><TableCell colSpan={6} className="py-16 text-center">
                  <FileCheck className="mx-auto mb-2 size-6 text-primary" />
                  <p className="text-sm font-semibold text-muted-foreground">No customers found.</p>
                  <p className="text-xs text-subtle-foreground">Try a different search or eligibility filter.</p>
                </TableCell></TableRow>
              ) : result.customers.map((item) => (
                <TableRow key={item.id} className="border-b border-background hover:bg-background">
                  <TableCell className="px-3 py-3 text-xs font-semibold text-foreground">{item.name}</TableCell>
                  <TableCell className="break-words px-3 py-3 text-xs text-muted-foreground">{item.email}</TableCell>
                  <TableCell className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{item.contactNumber || "No phone number"}</TableCell>
                  <TableCell className="px-3 py-3"><ReviewStatusBadge status={item.reviewStatus} /></TableCell>
                  <TableCell className="px-3 py-3 text-xs font-semibold text-foreground">{item.canSelfDrive ? "Yes" : "No"}</TableCell>
                  <TableCell className="px-3 py-3">
                    <TableActionMenu label={`Open actions for ${item.name}`} items={[{
                      label: "View customer", icon: <Eye size={13} className="mr-2" />, onClick: () => openCustomer(item.id),
                    }]} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result && result.total > 0 && !loadError && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-subtle-foreground">Showing {(result.currentPage - 1) * 15 + 1}–{Math.min(result.currentPage * 15, result.total)} of {result.total} customers</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1 || isLoading} onClick={() => { setIsLoading(true); setPage((current) => current - 1); }}><ChevronLeft size={15} /></Button>
                <span className="text-xs text-muted-foreground">Page {result.currentPage} of {result.lastPage}</span>
                <Button variant="outline" size="icon" aria-label="Next page" disabled={page >= result.lastPage || isLoading} onClick={() => { setIsLoading(true); setPage((current) => current + 1); }}><ChevronRight size={15} /></Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Sheet open={selectedId !== null} onOpenChange={(open) => { if (!open) { setSelectedId(null); setCustomer(null); setActiveType(null); } }}>
        <SheetContent side="right" className="w-full gap-0 border-l border-border p-0 sm:max-w-[720px]">
          <SheetHeader className="border-b border-border px-5 pb-4 pt-5">
            <SheetTitle className="text-base font-bold text-foreground">{customer?.name ?? "Customer verification"}</SheetTitle>
            <SheetDescription>Required documents and self-drive eligibility.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100dvh-76px)]">
            {detailLoading && !customer ? <p className="p-5 text-sm text-muted-foreground">Loading customer...</p>
              : detailError ? <div className="p-5 text-sm text-destructive">Customer details could not be loaded. <Button variant="outline" onClick={refresh}>Retry</Button></div>
              : customer && (
                <div className="space-y-4 p-5">
                  <Card><CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground">Self-drive eligibility</p>
                      <ReviewStatusBadge status={customer.reviewStatus} />
                    </div>
                    <p className="text-xs text-muted-foreground">{customer.documentCounts.approved} of {customer.requiredDocumentCount} required documents approved</p>
                    <p className="text-xs text-muted-foreground">{customer.email} · {customer.contactNumber || "No contact number"}</p>
                    {!customer.ageEligible && <p className="text-xs text-destructive">Age requirement has not been met or the birthdate is missing.</p>}
                  </CardContent></Card>

                  <Card><CardContent className="space-y-3 p-4">
                    <h2 className="text-sm font-bold text-foreground">Required documents</h2>
                    {customer.documents?.map(({ type, document }) => (
                      <div key={type} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-background p-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">{documentLabels[type] ?? type}</p>
                          <p className="text-[11px] text-muted-foreground">{document ? `Submitted ${formatDate(document.submittedAt)}` : "Not submitted"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {document ? <VerificationStatusBadge status={document.status} /> : <Badge variant="outline">Missing</Badge>}
                          {document && <Button variant="outline" size="sm" onClick={() => setActiveType(type)}>View</Button>}
                        </div>
                      </div>
                    ))}
                  </CardContent></Card>

                  {selectedDocument && (
                    <Card><CardContent className="space-y-4 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-bold text-foreground">{selectedDocument.documentType}</h2>
                        <VerificationStatusBadge status={selectedDocument.status} />
                      </div>
                      {selectedDocument.fileType === "pdf" ? (
                        <Button variant="outline" disabled={!selectedDocument.documentUrl} onClick={() => setPreview({ title: selectedDocument.documentType, url: selectedDocument.documentUrl, fileType: "pdf", alt: selectedDocument.documentType })}>
                          <FileText size={14} className="mr-2" /> View PDF
                        </Button>
                      ) : (
                        <div className={`grid gap-3 ${selectedDocument.documentType === "Driver's License" ? "sm:grid-cols-2" : ""}`}>
                          <VerificationDocumentSidePreview record={selectedDocument} side="front" label={selectedDocument.documentType === "Driver's License" ? "Front Side" : "Document"} onOpen={setPreview} />
                          {selectedDocument.documentType === "Driver's License" && <VerificationDocumentSidePreview record={selectedDocument} side="back" label="Back Side" onOpen={setPreview} />}
                        </div>
                      )}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {selectedDocument.documentNumber && <p>Document number: {selectedDocument.documentNumber}</p>}
                        {selectedDocument.expiresAt && <p>Expires: {formatDate(selectedDocument.expiresAt)}</p>}
                        {selectedDocument.rejectionComment && <p>Rejection reason: {selectedDocument.rejectionComment}</p>}
                        {selectedDocument.reviewedBy && <p>Reviewed by {selectedDocument.reviewedBy} on {formatDate(selectedDocument.reviewedAt)}</p>}
                      </div>
                      {selectedDocument.status === "pending" && (
                        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                          <Button variant="outline" onClick={() => setRejectRecord(selectedDocument)}><XCircle size={14} className="mr-2" /> Reject</Button>
                          <Button onClick={() => setApproveRecord(selectedDocument)}><CheckCircle2 size={14} className="mr-2" /> Approve Document</Button>
                        </div>
                      )}
                    </CardContent></Card>
                  )}
                </div>
              )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <DialogContent className="flex h-[82dvh] w-[calc(100vw-1rem)] max-w-5xl flex-col overflow-hidden">
          <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto bg-background">
            {preview?.fileType === "pdf"
              ? <iframe title={preview.title} src={preview.url} className="h-full w-full" />
              : preview && <Image src={preview.url} alt={preview.alt} width={960} height={640} unoptimized className="mx-auto h-auto max-w-full object-contain" />}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(approveRecord)} onOpenChange={(open) => { if (!open && !isApproving) setApproveRecord(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this document?</AlertDialogTitle>
            <AlertDialogDescription>Confirm that the document is readable, authentic, matches the customer, and has not expired.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApproving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isApproving} onClick={(event) => { event.preventDefault(); void approve(); }}>
              {isApproving ? "Approving..." : "Approve Document"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RejectDocumentDialog record={rejectRecord} onClose={() => setRejectRecord(null)} onSaved={refresh} />
    </div>
  );
}
