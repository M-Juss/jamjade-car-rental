"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle, Database, Upload } from "lucide-react";
import { KpiCard } from "@/components/common/data-display/KpiCard";
import { Button } from "@/components/ui/button";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { getTechnicalDashboard, type TechnicalDashboardData } from "@/services/report/technical.service";

export function TechnicalDashboard() {
  const [data, setData] = useState<TechnicalDashboardData | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    getTechnicalDashboard().then(result => { if (active) setData(result); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [revision]);

  return <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
    <ManagementPageHeading title="Dashboard" description="Review research uploads and rental monitoring status." />
    {error ? <div role="alert" className="space-y-3 text-sm text-destructive"><p>Dashboard could not be loaded.</p><Button variant="outline" onClick={() => { setError(false); setRevision(value => value + 1); }}>Retry</Button></div>
      : !data ? <p role="status" className="text-sm text-muted-foreground">Loading dashboard…</p>
        : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Your research uploads", value: data.recordings, icon: Database },
            { label: "Verified uploads", value: data.verifiedRecordings, icon: CheckCircle },
            { label: "Unverified uploads", value: data.pendingRecordings, icon: Upload },
            { label: "Active monitoring trips", value: data.activeMonitoringTrips, icon: Activity },
          ].map(item => <KpiCard key={item.label} {...item} />)}
        </div>}
  </div>;
}
