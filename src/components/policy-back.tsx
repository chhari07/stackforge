"use client";

import { useRouter } from "next/navigation";
import { BackIcon } from "./icons";
import { canGoBack } from "@/lib/nav";

// Back to Settings or Account when the policy was opened inside Stack;
// home when someone landed here straight from a link.
export function PolicyBack() {
  const router = useRouter();
  return (
    <button
      aria-label="Back"
      onClick={() => (canGoBack() ? router.back() : router.push("/"))}
      className="-ml-2.5 flex size-11 items-center justify-center"
    >
      <BackIcon size={22} />
    </button>
  );
}
