import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";
import { ManeuverComparisonPanel } from "./components/ManeuverComparisonPanel";

export function ModelExplorerModule() {
  return <section className="space-y-5 p-4 sm:p-6 lg:p-8">
    <ManagementPageHeading title="Model Explorer" description="Compare measured results from reviewed driving recordings." />
    <ManeuverComparisonPanel />
  </section>;
}
