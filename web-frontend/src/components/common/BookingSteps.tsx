import { bookingSteps } from "@/lib/site-content";

export default function BookingSteps() {
  const pairs = bookingSteps.slice(0, 4);
  const last  = bookingSteps[4];

  return (
    <div className="grid grid-cols-2 gap-x-10 gap-y-10">
      {/* Steps 1–4: two per row */}
      {pairs.map((step) => (
        <div key={step.number} className="flex flex-col items-center text-center">
          <div className="text-white font-semibold text-lg bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] rounded-md p-4 w-14 h-14 flex items-center justify-center mb-4">
            {step.number}
          </div>
          <p className="text-lg font-medium">{step.title}</p>
          <p className="text-sm text-gray-600 max-w-92">{step.description}</p>
        </div>
      ))}

      {/* Step 5: spans both columns, centered */}
      {last && (
        <div className="col-span-2 flex justify-center">
          <div className="flex flex-col items-center text-center">
            <div className="text-white font-semibold text-lg bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] rounded-md p-4 w-14 h-14 flex items-center justify-center mb-4">
              {last.number}
            </div>
            <p className="text-lg font-medium">{last.title}</p>
            <p className="text-sm text-gray-600 max-w-92">{last.description}</p>
          </div>
        </div>
      )}
    </div>
  );
} 