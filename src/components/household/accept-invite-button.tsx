"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptInvitation } from "@/server/actions/household";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function accept() {
    setLoading(true);
    const res = await acceptInvitation(token);
    setLoading(false);
    if (!res.ok) return setError(res.error);
    toast.success("הצטרפת למשק הבית!");
    router.replace("/onboarding");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button size="lg" className="w-full" onClick={accept} loading={loading}>
        הצטרפות למשק הבית
      </Button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
