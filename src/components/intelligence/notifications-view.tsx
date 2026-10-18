"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Settings2 } from "lucide-react";
import { markNotificationsRead } from "@/server/actions/intelligence";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { SUGGESTION_KIND } from "./suggestions-view";

export interface NotificationView {
  id: string;
  category: string;
  title: string;
  body: string | null;
  href: string | null;
  important: boolean;
  read_at: string | null;
  created_at: string;
}

export function NotificationsView({ notifications }: { notifications: NotificationView[] }) {
  const router = useRouter();
  const unread = notifications.filter((n) => !n.read_at);

  // Seeing the list marks it read (after a moment, so the unread dots are visible first).
  useEffect(() => {
    if (!unread.length) return;
    const t = setTimeout(() => void markNotificationsRead(unread.map((n) => n.id)).then(() => router.refresh()), 2500);
    return () => clearTimeout(t);
  }, [unread, router]);

  return (
    <>
      <PageHeader
        title="התראות"
        subtitle={unread.length ? `${unread.length} חדשות` : "הכל נקרא"}
        actions={
          <Link href="/settings/notifications" className="pressable grid size-8 place-items-center rounded-full bg-fill" aria-label="הגדרות התראות">
            <Settings2 className="size-[17px]" />
          </Link>
        }
      />
      {notifications.length === 0 ? (
        <EmptyState icon={<Bell />} title="אין התראות" description="רק דברים חשובים יגיעו לכאן: מה שנגמר, משימות שלך, אחריות שמסתיימת וחשבונות." />
      ) : (
        <>
          <Panel>
            {notifications.map((n) => {
              const kind = SUGGESTION_KIND[n.category] ?? SUGGESTION_KIND.reminder;
              const body = (
                <>
                  <span aria-hidden className="cat-tint grid size-10 shrink-0 place-items-center rounded-[12px] text-[20px]" style={{ "--h": kind.hue } as React.CSSProperties}>
                    {kind.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block", !n.read_at && "font-semibold")}>{n.title}</span>
                    {n.body && <span className="footnote block text-muted">{n.body}</span>}
                    <span className="footnote block text-muted">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label="חדש" />}
                </>
              );
              return n.href ? (
                <Link key={n.id} href={n.href} className="flex items-center gap-3 px-4 py-3 active:bg-fill">
                  {body}
                </Link>
              ) : (
                <div key={n.id} className="flex items-center gap-3 px-4 py-3">
                  {body}
                </div>
              );
            })}
          </Panel>
          {unread.length > 0 && (
            <Button variant="ghost" className="mt-3 w-full" onClick={() => markNotificationsRead("all").then(() => router.refresh())}>
              סימון הכל כנקרא
            </Button>
          )}
        </>
      )}
    </>
  );
}
