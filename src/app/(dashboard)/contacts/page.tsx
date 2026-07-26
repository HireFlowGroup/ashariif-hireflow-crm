import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = {
  title: "Contacts",
};

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        description="Store hiring managers and stakeholders linked to client companies."
      />
      <EmptyState
        title="No contacts yet"
        description="Import or create contacts after your organization workspace is provisioned in Supabase."
      />
    </div>
  );
}
