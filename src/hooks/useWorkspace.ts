import { useCallback, useEffect, useRef, useState } from "react";
import type { Workspace } from "../types/app";
import { loadWorkspace, subscribeToWorkspace } from "../services/workspace";

export type SyncStatus = "syncing" | "synced" | "offline" | "error";

export function useWorkspace(userId: string) {
  const [workspaceState, setWorkspaceState] = useState<{
    userId: string;
    workspace: Workspace;
  } | null>(null);
  const [status, setStatus] = useState<SyncStatus>("syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const activeUserId = useRef(userId);
  const latestRefresh = useRef<() => Promise<void>>(async () => undefined);
  activeUserId.current = userId;

  const refresh = useCallback(async () => {
    if (!userId) return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    if (running.current) return;
    running.current = true;
    setStatus("syncing");
    try {
      const next = await loadWorkspace(userId);
      if (activeUserId.current === userId) {
        setWorkspaceState({ userId, workspace: next });
        setError(null);
        setStatus("synced");
        setLastSyncedAt(new Date());
      }
    } catch (reason) {
      if (activeUserId.current === userId) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Impossible de charger les données de la famille.",
        );
        setStatus("error");
      }
    } finally {
      running.current = false;
      if (activeUserId.current !== userId) {
        void latestRefresh.current();
      }
    }
  }, [userId]);
  latestRefresh.current = refresh;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void refresh();
    const channel = subscribeToWorkspace(() => {
      if (active) void refresh();
    });
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onOnline = () => void refresh();
    const onOffline = () => setStatus("offline");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      void channel.unsubscribe();
    };
  }, [refresh]);

  const workspace =
    workspaceState?.userId === userId ? workspaceState.workspace : null;

  return { workspace, status, lastSyncedAt, error, refresh };
}
