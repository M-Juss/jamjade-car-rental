import { steps } from "@/lib/mock_data";

export default function BookingSteps() {
  return (
    <div className="flex flex-col gap-6">
      {steps.map((step) => (
        <div key={step.number} className="flex items-center space-x-5">
          <div className="text-white font-semibold text-lg bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] rounded-md py-2 w-11 text-center">
            {step.number}
          </div>
          <div className="flex flex-col">
            <p className="text-lg font-medium mt-2">{step.title}</p>
            <p className="text-sm text-gray-600 max-w-130">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
