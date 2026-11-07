import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/forms/auth/LoginForm";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-background px-4 py-20">
      <Link
        href="/"
        aria-label="Back to home"
        className="absolute left-4 top-4 inline-flex size-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:left-8 sm:top-8"
      >
        <ChevronLeft size={24} aria-hidden="true" />
      </Link>
      <Card className="w-full max-w-md gap-0 py-0">
        <CardContent className="flex flex-col items-center p-6 sm:p-8">
        <div className="mb-2 flex items-center gap-2">
          <Image
            src="/JamJadeLogo-solid.png"
            alt=""
            width={48}
            height={48}
            sizes="48px"
            className="size-12 shrink-0 object-contain"
          />
          <p className="text-lg font-semibold leading-tight text-primary sm:text-xl">
            JAMJADE CAR RENTAL
          </p>
        </div>
        <p className="text-sm mb-6">Enter your credentials to continue </p>
        <LoginForm/>
        </CardContent>
      </Card>
    </div>
  );
}
