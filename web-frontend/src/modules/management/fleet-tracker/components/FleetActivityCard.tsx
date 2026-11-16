import type { ReactNode } from "react";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function FleetActivityCard({ title, description, onRefresh, children }: {
  title: string;
  description: string;
  onRefresh: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="min-h-14 border-b border-border pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon" aria-label={`Refresh ${title.toLowerCase()}`} onClick={onRefresh}>
            <RefreshCcw />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}
