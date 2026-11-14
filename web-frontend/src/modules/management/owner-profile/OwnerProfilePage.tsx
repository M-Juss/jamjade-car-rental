"use client";

import { OwnerProfileForms } from "@/forms/owner-profile/OwnerProfileForms";
import { ManagementPageHeading } from "@/modules/management/shell/components/ManagementPageHeading";

export function OwnerProfilePage() {
  return (
    <div className="min-h-screen space-y-5 bg-background p-4 md:p-6 lg:p-8">
      <ManagementPageHeading title="Profile" description="Manage your account email and password." />
      <OwnerProfileForms />
    </div>
  );
}
