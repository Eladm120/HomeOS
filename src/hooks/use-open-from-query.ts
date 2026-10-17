"use client";

import { useEffect } from "react";

/** Opens a sheet when the page is reached with ?new=1 (dashboard quick actions). */
export function useOpenFromQuery(open: () => void) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") !== "1") return;
    url.searchParams.delete("new");
    window.history.replaceState(null, "", url.pathname + url.search);
    open();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);
}
