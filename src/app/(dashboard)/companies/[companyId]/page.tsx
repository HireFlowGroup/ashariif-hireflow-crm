import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CompanyPageSkeleton } from "@/components/companies/detail/company-page-skeleton";
import { CompanyPageView } from "@/components/companies/detail/company-page-view";
import { createCompanyPageService } from "@/features/company-intelligence/create-company-page-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { authRoutes } from "@/config/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ companyId: string }>;
}): Promise<Metadata> {
  return { title: "Bedrijf Intelligence" };
}

type CompanyDetailPageProps = {
  params: Promise<{ companyId: string }>;
};

async function CompanyDetailContent({ companyId }: { companyId: string }) {
  const context = await getAuthenticatedServiceContext();
  if (!context) redirect(authRoutes.login);

  const service = await createCompanyPageService();
  const data = await service.getPageData(context, companyId);

  if (!data) notFound();

  return <CompanyPageView data={data} />;
}

export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
  const { companyId } = await params;

  return (
    <Suspense fallback={<CompanyPageSkeleton />}>
      <CompanyDetailContent companyId={companyId} />
    </Suspense>
  );
}
