"use client";

import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "explore-tracks-subscriptions";

export interface CameraSubscription {
  cameraId: string;
  cameraName: string;
  subscribedAt: number;
}

/**
 * Manages browser notification subscriptions for cameras.
 * Checks every ~2 minutes if a subscribed camera should be "popular"
 * (simulated based on time of day) and fires a browser notification.
 */
export function useCameraNotifications() {
  const [subscriptions, setSubscriptions] = useState<Map<string, CameraSubscription>>(new Map());
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load subscriptions from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr: CameraSubscription[] = JSON.parse(raw);
        setSubscriptions(new Map(arr.map((s) => [s.cameraId, s])));
      }
    } catch {}

    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
  }, []);

  const persist = useCallback((map: Map<string, CameraSubscription>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...map.values()]));
    } catch {}
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "denied" as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const subscribe = useCallback(
    async (cameraId: string, cameraName: string) => {
      let perm = permission;
      if (perm !== "granted") {
        perm = await requestPermission();
      }
      if (perm !== "granted") return false;

      setSubscriptions((prev) => {
        const next = new Map(prev);
        next.set(cameraId, { cameraId, cameraName, subscribedAt: Date.now() });
        persist(next);
        return next;
      });
      return true;
    },
    [permission, requestPermission, persist],
  );

  const unsubscribe = useCallback(
    (cameraId: string) => {
      setSubscriptions((prev) => {
        const next = new Map(prev);
        next.delete(cameraId);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isSubscribed = useCallback(
    (cameraId: string) => subscriptions.has(cameraId),
    [subscriptions],
  );

  // Simulate checking for popular activity every 2 minutes
  useEffect(() => {
    if (subscriptions.size === 0 || permission !== "granted") return;

    checkIntervalRef.current = setInterval(() => {
      const h = new Date().getHours();
      // "Peak" hours: 6-10 morning, 17-21 evening
      const isPeak = (h >= 6 && h <= 10) || (h >= 17 && h <= 21);

      subscriptions.forEach((sub) => {
        // Fire notification with 30% chance during peak hours, 5% otherwise
        const roll = Math.random();
        if ((isPeak && roll < 0.3) || (!isPeak && roll < 0.05)) {
          try {
            new Notification(`Activity spotted — ${sub.cameraName}`, {
              body: "Something is happening on this camera right now!",
              icon: "/favicon.ico",
              tag: `explore-tracks-${sub.cameraId}`,
            });
          } catch {}
        }
      });
    }, 2 * 60 * 1000); // Every 2 minutes

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [subscriptions, permission]);

  return {
    subscriptions,
    permission,
    subscribe,
    unsubscribe,
    isSubscribed,
    requestPermission,
  };
}
