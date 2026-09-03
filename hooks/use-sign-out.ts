"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign-out for the layout chrome (top bar, sidebar, navbar menus).
 *
 * Has no effect and makes no auth call on mount: those components already
 * receive `user` from the server layout, the only thing they need from the
 * browser client is the ability to end the session.
 */
export function useSignOut() {
  const router = useRouter();

  return useCallback(async () => {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);
}
