"use client";

import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { useManagementSession } from "@/modules/management/shell/context/ManagementSessionProvider";

import { ManagementTable as Table, ManagementTableCell as TableCell, TableCard } from "@/components/common/tables/ManagementTable";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CheckCircle2, Eye, FileCheck, Pencil, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormDialogContent, FormDialogFooter, FormDialogHeader } from "@/components/common/forms/FormDialogLayout";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { FilterSelect } from "@/components/common/forms/FilterSelect";
import { SearchInput } from "@/components/common/forms/SearchInput";
import { TableActionMenu } from "@/components/common/tables/TableActionMenu";
import { TablePagination } from "@/components/common/tables/TablePagination";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { appToast } from "@/lib/toast";
import { RejectDocumentDialog } from "@/forms/verification/RejectDocumentDialog";
import { approveVerification, getSelfDriveCustomer, getSelfDriveCustomers, type SelfDriveCustomer, type SelfDriveCustomerPage, type SelfDriveReviewStatus, type VerificationRecord } from "@/services/verification";
import { VerificationDocumentSidePreview, type DocumentPreviewSelection } from "./components/VerificationDocumentSidePreview";
import { VerificationStatusBadge } from "./components/VerificationStatusBadge";

type EligibilityFilter = "all" | "eligible" | "not_eligible";

const reviewStatus: Record<SelfDriveReviewStatus, { label: string; className: string }> = {
  eligible: { label: "Eligible", className: "border-success-border bg-success-surface text-success" },
  pending_review: { label: "Pending", className: "border-warning-border bg-warning-surface text-warning" },
  needs_correction: { label: "Needs correction", className: "border-destructive-border bg-destructive-surface text-destructive" },
  documents_required: { label: "No documents", className: "border-border bg-background text-muted-foreground" },
  age_ineligible: { label: "Age requirement not met", className: "border-destructive-border bg-destructive-surface text-destructive" },
  emergency_contact_required: { label: "Emergency contact required", className: "border-warning-border bg-warning-surface text-warning" },
};

const documentLabels: Record<string, string> = {
  drivers_license: "Driver's License",
  proof_of_billing: "Proof of Address",
};

function ReviewStatusBadge({ customer }: { customer: SelfDriveCustomer }) {
  const meta = reviewStatus[customer.reviewStatus];
  const isIncomplete = customer.reviewStatus === "documents_required" && customer.documentCounts.missing < customer.requiredDocumentCount;
  const label = isIncomplete ? "Incomplete" : meta.label;
  const className = isIncomplete ? reviewStatus.pending_review.className : meta.className;
  return <Badge variant="outline" className={`h-auto min-h-6 max-w-full whitespace-normal rounded-lg px-2.5 py-1 text-center text-xs font-semibold [overflow-wrap:anywhere] ${className}`}>{label}</Badge>;
}

function formatDate(value?: string | null) {
  if (!value) return "Not provided";
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(new Date(value));
}

export default function SelfDriveVerificationModule() {
  const { portal } = useManagementSession();
  const [editing, setEditing] = useState(false);
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

  const openCustomer = (id: number, edit = false) => {
    setEditing(edit);
    setCustomer(null);
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
        <ManagementPageHeading title="Self-Drive Verification" description="Review customer documents for self-drive approval." />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {[
            { label: "Customers", value: result?.summary.total ?? "—", icon: ShieldCheck },
            { label: "Eligible for self-drive", value: result?.summary.eligible ?? "—", icon: CheckCircle2 },
            { label: "Not eligible", value: result?.summary.notEligible ?? "—", icon: XCircle },
          ].map((item) => <KpiCard key={item.label} {...item} />)}
        </div>

        <TableCard>
          <CardContent className="flex flex-wrap items-center gap-2.5 border-b border-border p-4">
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
            <div className="grid divide-y divide-border md:hidden">
              {isLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Loading customers...</p>
              ) : loadError ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Customers could not be loaded. <Button variant="outline" onClick={refresh}>Retry</Button></div>
              ) : !result?.customers.length ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No customers found. Try a different search or eligibility filter.</p>
              ) : result.customers.map((item) => (
                <div key={item.id} className="min-w-0 bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-sm font-semibold text-foreground">{item.name}</p>
                    <ReviewStatusBadge customer={item} />
                  </div>
                  <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                    {[["Email", item.email], ["Phone Number", item.contactNumber || "No phone number"]].map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-3">
                        <dt className="shrink-0 text-muted-foreground">{label}</dt>
                        <dd className="min-w-0 text-right font-medium text-foreground [overflow-wrap:anywhere]">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-2 flex justify-end">
                    <TableActionMenu label={`Open actions for ${item.name}`} items={[{ label: "View customer", icon: <Eye size={13} className="mr-2" />, onClick: () => openCustomer(item.id) }, ...(portal === "admin" && item.documentCounts.approved > 0 ? [{ label: "Edit verification", icon: <Pencil size={13} className="mr-2" />, onClick: () => openCustomer(item.id, true) }] : [])]} />
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <Table className="table-fixed [&_td]:whitespace-normal [&_td]:[overflow-wrap:anywhere]">
                <colgroup>
                  <col className="w-[24%]" />
                  <col />
                  <col className="w-[16%]" />
                  <col className="w-[20%]" />
                  <col className="w-12" />
                </colgroup>
                <TableHeader>
                  <TableRow className="border-b border-border bg-background hover:bg-background">
                    {["Customer", "Email", "Phone Number", "Review Status", ""].map((heading) => (
                      <TableHead key={heading} className="whitespace-normal break-words px-2 py-3 text-xs font-semibold normal-case tracking-normal text-subtle-foreground">{heading || <span className="sr-only">Actions</span>}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>{Array.from({ length: 5 }).map((__, cell) => (
                      <TableCell key={cell} className="px-2 py-3"><div className="h-4 animate-pulse rounded-md bg-border" /></TableCell>
                    ))}</TableRow>
                  )) : loadError ? (
                    <TableRow><TableCell colSpan={5} className="py-12 text-center text-sm text-destructive">
                      Customers could not be loaded. <Button variant="outline" onClick={refresh} className="ml-2">Retry</Button>
                    </TableCell></TableRow>
                  ) : !result?.customers.length ? (
                    <TableRow><TableCell colSpan={5} className="py-16 text-center">
                      <FileCheck className="mx-auto mb-2 size-6 text-primary" />
                      <p className="text-sm font-semibold text-muted-foreground">No customers found.</p>
                      <p className="text-xs text-subtle-foreground">Try a different search or eligibility filter.</p>
                    </TableCell></TableRow>
                  ) : result.customers.map((item) => (
                    <TableRow key={item.id} className="border-b border-background transition-colors hover:bg-background">
                      <TableCell className="px-2 py-3 text-sm font-semibold text-foreground">{item.name}</TableCell>
                      <TableCell className="px-2 py-3 text-sm text-muted-foreground">{item.email}</TableCell>
                      <TableCell className="px-2 py-3 text-sm text-muted-foreground">{item.contactNumber || "No phone number"}</TableCell>
                      <TableCell className="px-2 py-3"><ReviewStatusBadge customer={item} /></TableCell>
                      <TableCell className="px-2 py-3">
                        <TableActionMenu label={`Open actions for ${item.name}`} items={[{
                          label: "View customer", icon: <Eye size={13} className="mr-2" />, onClick: () => openCustomer(item.id),
                        }, ...(portal === "admin" && item.documentCounts.approved > 0 ? [{ label: "Edit verification", icon: <Pencil size={13} className="mr-2" />, onClick: () => openCustomer(item.id, true) }] : [])]} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          {result && result.total > 0 && !loadError && !isLoading && (
            <div className="border-t border-border px-4 py-3 [&>div]:mt-0"><TablePagination total={result.total} page={result.currentPage} lastPage={result.lastPage} onPageChange={(nextPage) => { setIsLoading(true); setLoadError(false); setPage(nextPage); }} /></div>
          )}
        </TableCard>
      </div>

      <Dialog open={selectedId !== null} onOpenChange={(open) => { if (!open) { setSelectedId(null); setCustomer(null); } }}>
        <FormDialogContent width="wide">
          <FormDialogHeader
            title={customer?.name ?? result?.customers.find((item) => item.id === selectedId)?.name ?? "Customer"}
            icon={ShieldCheck}
            endContent={customer ? <ReviewStatusBadge customer={customer} /> : undefined}
            onClose={() => { setSelectedId(null); setCustomer(null); }}
            closeLabel="Close customer verification"
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {detailLoading && !customer ? <p role="status" className="p-5 text-sm text-muted-foreground">Loading customer...</p>
              : detailError ? <div role="alert" className="space-y-3 p-5 text-sm text-destructive"><p>Customer details could not be loaded.</p><Button variant="outline" onClick={refresh}>Retry</Button></div>
              : customer && (
                <div className="space-y-5 p-4 sm:p-6">
                  <section aria-label="Emergency contacts" className="space-y-3 rounded-xl border border-border p-4">
                    <h2 className="text-sm font-semibold text-foreground">Emergency contact</h2>
                    {customer.emergencyContacts?.length ? customer.emergencyContacts.map((contact, index) => (
                      <dl key={index} className="grid gap-3 text-sm sm:grid-cols-3">
                        <div><dt className="text-muted-foreground">Name</dt><dd className="break-words">{contact.name}</dd></div>
                        <div><dt className="text-muted-foreground">Relationship</dt><dd>{contact.relationship}</dd></div>
                        <div><dt className="text-muted-foreground">Contact number</dt><dd>{contact.phoneNumber}</dd></div>
                      </dl>
                    )) : <p className="text-sm text-muted-foreground">Not provided</p>}
                  </section>
                  {customer.documents?.map(({ type, document }) => (
                    <section key={type} aria-label={documentLabels[type] ?? type} className="space-y-4 rounded-xl border border-border p-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h2 className="text-sm font-semibold text-foreground">{documentLabels[type] ?? type}</h2>
                          {document ? <VerificationStatusBadge status={document.status} /> : <Badge variant="outline">Missing</Badge>}
                        </div>
                        {document ? (
                          <dl className="grid grid-cols-1 gap-x-5 gap-y-2 text-xs sm:grid-cols-3">
                            <div><dt className="text-muted-foreground">Submitted</dt><dd className="mt-1 text-foreground">{formatDate(document.submittedAt)}</dd></div>
                            {document.documentNumber && <div><dt className="text-muted-foreground">Document number</dt><dd className="mt-1 break-words text-foreground">{document.documentNumber}</dd></div>}
                            {document.expiresAt && <div><dt className="text-muted-foreground">Expires</dt><dd className="mt-1 text-foreground">{formatDate(document.expiresAt)}</dd></div>}
                            {document.reviewedBy && <><div><dt className="text-muted-foreground">Reviewed by</dt><dd className="mt-1 break-words text-foreground">{document.reviewedBy}</dd></div><div><dt className="text-muted-foreground">Reviewed</dt><dd className="mt-1 text-foreground">{formatDate(document.reviewedAt)}</dd></div></>}
                            {document.rejectionComment && <div className="sm:col-span-3"><dt className="text-muted-foreground">Rejection reason</dt><dd className="mt-1 break-words text-destructive">{document.rejectionComment}</dd></div>}
                          </dl>
                        ) : <p className="text-xs text-muted-foreground">Not submitted</p>}
                      </div>
                      {document && (
                        <>
                          <div className={`grid gap-3 ${document.documentType === "Driver's License" || document.documentBackUrl ? "sm:grid-cols-2" : ""}`}>
                            <VerificationDocumentSidePreview key={`${document.id}-front`} record={document} side="front" label={document.documentType === "Driver's License" ? "Front Side" : "Document"} onOpen={setPreview} />
                            {(document.documentType === "Driver's License" || document.documentBackUrl) && (
                              <VerificationDocumentSidePreview key={`${document.id}-back`} record={document} side="back" label="Back Side" onOpen={setPreview} />
                            )}
                          </div>
                          {(editing || document.status === "pending") && (
                            <div className="grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
                              <Button variant="outline" disabled={document.status === "rejected"} onClick={() => setRejectRecord(document)}><XCircle size={14} className="mr-2" />{document.status === "approved" ? "Unverify" : "Reject"}</Button>
                              <Button disabled={document.status === "approved"} onClick={() => setApproveRecord(document)}><CheckCircle2 size={14} className="mr-2" /> Verify document</Button>
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  ))}
                </div>
              )}
          </div>
          <FormDialogFooter>
            <Button type="button" variant="outline" onClick={() => { setSelectedId(null); setCustomer(null); }}>Close</Button>
          </FormDialogFooter>
        </FormDialogContent>
      </Dialog>

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
