import { useCallback, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

import { useAuthUser } from "@/lib/auth/store";

function storageKey(userId: string): string {
  return `notifPanelCollapsed_${userId.replace(/[^A-Za-z0-9._-]/g, "")}`;
}

/**
 * Whether this person keeps the docked notifications panel collapsed. Stored
 * per user so a shared desk tablet keeps each login's choice.
 */
export function useNotificationPanelCollapsed(): [boolean, (v: boolean) => void] {
  const userId = useAuthUser()?.id ?? null;
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    SecureStore.getItemAsync(storageKey(userId))
      .then((v) => {
        if (alive) setCollapsedState(v === "1");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId]);

  const setCollapsed = useCallback(
    (v: boolean) => {
      setCollapsedState(v);
      if (userId) {
        SecureStore.setItemAsync(storageKey(userId), v ? "1" : "0").catch(
          () => {}
        );
      }
    },
    [userId]
  );

  return [collapsed, setCollapsed];
}
