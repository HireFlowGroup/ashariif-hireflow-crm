import { getSessionProfile, getSessionUser } from "@/lib/supabase/server";

export type AuthenticatedServiceContext = {
  userId: string;
  organizationId: string;
};

export async function getAuthenticatedServiceContext(): Promise<AuthenticatedServiceContext | null> {
  const user = await getSessionUser();
  const profile = await getSessionProfile();

  if (!user || !profile) {
    return null;
  }

  return {
    userId: user.id,
    organizationId: profile.organization_id,
  };
}
