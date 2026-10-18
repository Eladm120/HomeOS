"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Settings2 } from "lucide-react";
import type { AlertItem } from "@/lib/alerts";
import { markNotificationsRead } from "@/server/actions/intelligence";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { AlertList } from "@/components/alerts/alert-list";
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

/**
 * One place for everything that needs attention. The live list is computed
 * from the house itself (stock, bills, rent, chores…); past notifications sit
 * underneath as a short history.
 */
export function NotificationsView({ alerts, notifications, preview }: { alerts: AlertItem[]; notifications: NotificationView[]; preview?: boolean }) {
  const router = useRouter();
  const [showHistory, setShowHistory] = useState(false);
  const unread = notifications.filter((n) => !n.read_at);

  useEffect(() => {
    if (preview || !unread.length) return;
    const t = setTimeout(() => void markNotificationsRead(unread.map((n) => n.id)).then(() => router.refresh()), 2500);
    return () => clearTimeout(t);
  }, [unread, router, preview]);

  const now = alerts.filter((a) => a.urgency === "now" && !a.handled);
  const soon = alerts.filter((a) => a.urgency === "soon" && !a.handled);
  const handled = alerts.filter((a) => a.handled);
  const open = now.length + soon.length;

  return (
    <>
      <PageHeader
        title="התראות"
        subtitle={open ? `${open} דברים מחכים לך` : "הכל מטופל"}
        actions={
          <Link href="/settings/notifications" className="pressable grid size-10 place-items-center rounded-full bg-surface shadow-[var(--card-shadow)]" aria-label="הגדרות התראות">
            <Settings2 className="size-[18px]" />
          </Link>
        }
      />

      <div className="space-y-7 pb-6">
        {open === 0 && (
          <div className="card flex flex-col items-center px-6 py-10 text-center">
            <span className="mb-3 text-[48px] leading-none" aria-hidden>
              🛋️
            </span>
            <p className="title-2">אפשר לנוח</p>
            <p className="mt-1 max-w-xs text-[15px] text-muted">אין חוסרים, תשלומים או משימות פתוחות. כשמשהו יירד מתחת למינימום או יתקרב תשלום — זה יופיע כאן.</p>
          </div>
        )}

        {now.length > 0 && (
          <Group title="עכשיו" dot="bg-terracotta">
            <AlertList alerts={now} preview={preview} />
          </Group>
        )}
        {soon.length > 0 && (
          <Group title="בימים הקרובים" dot="bg-honey">
            <AlertList alerts={soon} preview={preview} />
          </Group>
        )}
        {handled.length > 0 && (
          <Group title="טופל אוטומטית" dot="bg-sage">
            <AlertList alerts={handled} preview={preview} />
          </Group>
        )}

        {notifications.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
              className="mb-2.5 flex items-center gap-1.5 px-1 text-[15px] font-semibold text-muted"
            >
              עדכונים אחרונים
              {unread.length > 0 && <span className="num rounded-full bg-terracotta px-1.5 text-[11px] font-bold text-white">{unread.length}</span>}
              <ChevronDown className={cn("size-4 transition-transform", showHistory && "rotate-180")} />
            </button>
            {showHistory && (
              <ul className="card animate-fade-up overflow-hidden [&>*+*]:border-t [&>*+*]:border-border">
                {notifications.slice(0, 30).map((n) => {
                  const kind = SUGGESTION_KIND[n.category] ?? SUGGESTION_KIND.reminder;
                  const body = (
                    <>
                      <span aria-hidden className="text-[20px]">
                        {kind.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-[15px]", !n.read_at && "font-semibold")}>{n.title}</span>
                        <span className="footnote block text-muted">{timeAgo(n.created_at)}</span>
                      </span>
                      {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-terracotta" aria-label="חדש" />}
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link href={n.href} className="flex items-center gap-3 px-4 py-3 active:bg-fill">
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-4 py-3">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function Group({ title, dot, children }: { title: string; dot: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-[19px] font-semibold [font-family:var(--font-display)]">
        <span className={cn("size-2.5 rounded-full", dot)} aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  );
}
