import { NextResponse } from "next/server";

import { SupabaseIntelligenceNotificationsRepository } from "@/features/daily-intelligence/repositories/supabase-intelligence-notifications.repository";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  const client = await createClient();
  const repository = new SupabaseIntelligenceNotificationsRepository(client);

  try {
    const [notifications, unreadCount] = await Promise.all([
      unreadOnly
        ? repository.listUnread(context.organizationId, limit)
        : repository.listRecent(context.organizationId, limit),
      repository.countUnread(context.organizationId),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/permission denied|PGRST205|42501|Notificaties/i.test(message)) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }
    console.error("[intelligence/notifications] GET failed", error);
    return NextResponse.json({ error: "Notificaties laden mislukt." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const body = (await request.json()) as { notificationIds?: string[] };
  const notificationIds = body.notificationIds ?? [];

  if (notificationIds.length === 0) {
    return NextResponse.json({ error: "notificationIds is verplicht." }, { status: 400 });
  }

  const client = await createClient();
  const repository = new SupabaseIntelligenceNotificationsRepository(client);
  const marked = await repository.markRead(context.organizationId, notificationIds);

  return NextResponse.json({ marked });
}
