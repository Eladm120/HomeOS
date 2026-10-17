"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

/**
 * "לפני שעה" — rendered on the client after mount, so server and device
 * clocks can never disagree during hydration.
 */
export function RelativeTime({ value, prefix = "" }: { value: string; prefix?: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(timeAgo(value));
    const t = setInterval(() => setText(timeAgo(value)), 60_000);
    return () => clearInterval(t);
  }, [value]);
  return (
    <time dateTime={value} suppressHydrationWarning>
      {text === null ? "" : `${prefix}${text}`}
    </time>
  );
}
