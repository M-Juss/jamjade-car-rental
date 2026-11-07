import { Activity, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/services/http";
import { cn } from "@/lib/utils";

export function ResearchState({ loading, error, onRetry, className }: { loading?: boolean; error?: unknown; onRetry?: () => void; className?: string }) {
  const denied = error instanceof ApiError && error.status === 403;
  const missing = error instanceof ApiError && error.status === 404;
  const Icon = loading ? Loader2 : denied ? ShieldAlert : error ? AlertCircle : Activity;
  const title = loading ? "Loading recordings" : denied ? "Research is unavailable" : missing ? "Recording not found" : error ? "Recording could not be loaded" : "No recordings yet";
  const description = loading ? "" : denied ? "Use an active Admin account with RC Research enabled." : missing ? "This recording may have been removed or belongs to another account." : error ? "Check your connection and try again." : "Upload a recording from RC Research on your phone to inspect it here.";
  return <Card className={cn("rounded-2xl border border-border bg-surface shadow-none ring-0", className)}><CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center" role={error ? "alert" : "status"}>
    <Icon className={`size-7 text-primary ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
    <div><p className="text-sm font-semibold">{title}</p>{description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}</div>
    {Boolean(error) && onRetry && !denied && !missing && <Button type="button" variant="outline" onClick={onRetry}>Try again</Button>}
  </CardContent></Card>;
}
