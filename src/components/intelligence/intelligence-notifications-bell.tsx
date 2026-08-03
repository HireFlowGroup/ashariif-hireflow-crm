"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type IntelligenceNotification = {
  id: string;
  companyId: string;
  notificationType: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  return new Date(iso).toLocaleDateString("nl-NL");
}

export function IntelligenceNotificationsBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<IntelligenceNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/intelligence/notifications?limit=15");
      if (!response.ok) return;
      const data = (await response.json()) as {
        notifications: IntelligenceNotification[];
        unreadCount: number;
      };
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.readAt).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setMarking(true);
    try {
      await fetch("/api/intelligence/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds: unreadIds }),
      });
      await load();
    } finally {
      setMarking(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label="Notificaties" />}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Hiring Intelligence</span>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={marking}
              onClick={() => void markAllRead()}
            >
              {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              <span className="ml-1">Alles gelezen</span>
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Laden…
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            Geen notificaties
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="cursor-pointer flex-col items-start gap-1 p-3"
              onClick={() => router.push(`/companies/${notification.companyId}`)}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="text-sm font-medium leading-tight">{notification.title}</span>
                {!notification.readAt ? (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    nieuw
                  </Badge>
                ) : null}
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
              <span className="text-[10px] text-muted-foreground">
                {formatRelativeTime(notification.createdAt)}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/intelligence/today")}>
          Today&apos;s Intelligence feed
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings/intelligence")}>
          Alle scans &amp; instellingen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
