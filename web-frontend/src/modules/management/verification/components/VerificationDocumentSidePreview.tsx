"use client";

import Image from "next/image";
import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileType, VerificationRecord } from "@/services/verification";

export type DocumentPreviewSelection = {
  title: string;
  url: string;
  fileType: FileType;
  alt: string;
};

function getDocumentSide(record: VerificationRecord, side: "front" | "back") {
  const sideUrl = side === "front" ? record.documentFrontUrl : record.documentBackUrl;

  return { url: sideUrl || (side === "front" ? record.documentUrl : undefined) };
}

export function VerificationDocumentSidePreview({
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
  const isPdf = Boolean(documentSide.url && /\.pdf(?:[?#]|$)/i.test(documentSide.url));
  const hasPreview = Boolean(documentSide.url) && !imageError;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-white px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <Button
          variant="outline"
          aria-label={`Open ${record.documentType} ${label} preview`}
          disabled={!hasPreview}
          onClick={() => {
            if (!documentSide.url) return;

            onOpen({
              title: `${record.documentType} - ${label}`,
              url: documentSide.url,
              fileType: isPdf ? "pdf" : "image",
              alt: `${record.documentType} ${label.toLowerCase()} preview`,
            });
          }}
          className="h-7 rounded-lg border-border px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-primary"
        >
          <ExternalLink size={12} className="mr-1.5" />
          Open
        </Button>
      </div>
      {hasPreview && isPdf ? (
        <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
          <FileText size={34} className="text-subtle-foreground" />
          <p className="mt-3 text-[12px] font-semibold text-muted-foreground">PDF document. Select Open to preview.</p>
        </div>
      ) : hasPreview && documentSide.url ? (
        <Image
          src={documentSide.url}
          alt={`${record.documentType} ${label.toLowerCase()} preview`}
          width={960}
          height={640}
          unoptimized
          onError={() => setImageError(true)}
          className="h-64 w-full object-contain p-3 sm:h-72"
        />
      ) : (
        <div className="flex min-h-52 flex-col items-center justify-center p-6 text-center">
          <FileText size={34} className="text-subtle-foreground" />
          <p className="mt-3 text-[12px] font-semibold text-muted-foreground">No {label.toLowerCase()} image was uploaded.</p>
        </div>
      )}
    </div>
  );
}
