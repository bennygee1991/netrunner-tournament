"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches server data every `seconds` while an event is live, so phones in the room stay current. */
export function LiveRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
