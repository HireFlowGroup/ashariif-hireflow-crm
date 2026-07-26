import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { PageLoadingSkeleton } from "@/components/shared/page-loading-skeleton";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}
