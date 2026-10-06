"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { setRefCookie } from "@/lib/referral";
import { api } from "@/lib/api";

/** Reads ?ref=CODE from any URL, stores it in a cookie and counts the click. */
export function RefCapture() {
  const params = useSearchParams();
  const ref = params.get("ref");
  useEffect(() => {
    if (!ref) return;
    setRefCookie(ref);
    api.recordRefClick(ref);
    toast(`Referral ${ref.toUpperCase()} attached`, {
      description: "Your buys on this device will be attributed to this link for 30 days.",
    });
  }, [ref]);
  return null;
}
