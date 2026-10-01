import { LoginForm } from "@/forms/auth/LoginForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-gray-100 px-4 py-20">
      <Link
        href="/"
        aria-label="Back to home"
        className="absolute left-4 top-4 inline-flex size-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-white hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:left-8 sm:top-8"
      >
        <ChevronLeft size={24} aria-hidden="true" />
      </Link>
      <div className="flex w-full max-w-lg flex-col items-center rounded-md bg-white p-8 shadow-md sm:p-12">
        <div className="flex space-x-2 ">
          <p className="text-2xl font-bold text-primary ">JAMJADE CAR RENTAL</p>
        </div>
        <p className="text-sm mb-6">Enter your credentials to continue </p>
        <LoginForm/>
      </div>
    </div>
  );
}
