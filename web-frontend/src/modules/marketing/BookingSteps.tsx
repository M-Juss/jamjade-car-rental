import { bookingSteps } from "@/lib/site-content";
import { Card, CardContent } from "@/components/ui/card";
import styles from "./BookingSteps.module.css";

export default function BookingSteps() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-5 lg:gap-x-2 lg:gap-y-0">
      {bookingSteps.map((step, index) => (
        <div
          key={step.number}
          className={`flex h-full flex-col items-center text-center ${index === 4 ? "col-span-2 lg:col-span-1" : ""}`}
        >
          <div
            className={`mb-4 flex size-14 items-center justify-center rounded-md text-lg font-semibold text-primary-foreground lg:h-16 lg:w-full lg:rounded-none lg:text-xl lg:tracking-wide ${index % 2 === 0 ? "bg-primary" : "bg-foreground"} ${styles.arrow}`}
          >
            <span className="lg:hidden">{step.number}</span>
            <span className="hidden lg:inline">STEP {step.number}</span>
          </div>
          <Card className="w-full flex-1 gap-0 rounded-2xl border border-border bg-surface py-0 shadow-sm ring-0">
            <CardContent className="flex h-full flex-col items-center px-3 py-5 sm:px-5 lg:px-4 lg:py-6 xl:px-6">
              <h3 className="flex w-full flex-col items-center border-b border-border pb-4 text-lg font-semibold leading-7 text-foreground lg:text-xl">
                {step.titleLines.map((line) => <span key={line}>{line}</span>)}
              </h3>
              <p className="pt-4 text-sm leading-6 text-muted-foreground">
                {step.description}
              </p>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
