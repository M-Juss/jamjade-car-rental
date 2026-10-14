import { Activity, Car, Route, ShieldCheck, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const insightFeatures = [
  {
    title: "Driving-event insights",
    description: "AI classification helps make sense of vehicle movement.",
    icon: Activity,
    phoneLabel: "Driving events",
  },
  {
    title: "Journey context",
    description: "Understand significant events alongside the rental journey.",
    icon: Route,
    phoneLabel: "Journey context",
  },
  {
    title: "Clear consent",
    description: "Understand what is collected before monitoring begins.",
    icon: ShieldCheck,
    phoneLabel: "Consent & setup",
  },
];

const insightSteps = [
  {
    title: "Prepare your phone",
    description:
      "Review what information is collected and give your consent. Our staff guide you through phone checks, mounting, and calibration before vehicle release.",
  },
  {
    title: "Start your journey",
    description:
      "After staff release the vehicle, location and movement data provide context for your self-drive rental journey.",
  },
  {
    title: "Understand driving events",
    description:
      "AI driving-event classification helps our team review significant events with journey context.",
  },
];

export default function DrivingInsights() {
  return (
    <div className="mx-auto w-full">
      <div className="grid items-center gap-8 md:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-7 text-foreground">
            How it works
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Designed for self-drive rentals.
          </p>
          <ol className="mt-5 space-y-6 border-l border-border pl-5">
            {insightSteps.map((step, index) => (
              <li key={step.title}>
                <h4 className="text-sm font-semibold text-foreground">
                  {index + 1}. {step.title}
                </h4>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div
          role="img"
          aria-label="JamJade phone illustration connecting vehicle movement with driving events, journey context, and consent"
          className="flex min-w-0 items-center justify-center md:justify-end"
        >
          <div className="w-full max-w-64 rounded-3xl border-[6px] border-foreground bg-surface px-5 pb-8 pt-5 shadow-sm">
            <div className="mx-auto mb-7 h-1 w-12 rounded-full bg-foreground" />
            <p className="text-sm font-semibold leading-6 text-foreground">
              JamJade Driving Insights
            </p>
            <div className="flex items-center justify-center gap-3 py-9 text-primary" aria-hidden="true">
              <Car className="size-6 shrink-0" />
              <span className="h-px flex-1 bg-border" />
              <Smartphone className="size-6 shrink-0" />
              <span className="h-px flex-1 bg-border" />
              <Activity className="size-6 shrink-0" />
            </div>
            {insightFeatures.map(({ phoneLabel, icon: Icon }) => (
              <div key={phoneLabel} className="flex items-center gap-3 border-t border-border py-5 text-xs text-foreground">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{phoneLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {insightFeatures.map((feature) => (
          <Card key={feature.title} className="gap-0 rounded-2xl border border-border bg-surface py-0 shadow-sm ring-0">
            <CardContent className="px-5 py-5 lg:px-6 lg:py-6">
              <h3 className="mb-2 text-lg font-semibold leading-7 text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
