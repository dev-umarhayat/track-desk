import { useEffect, useState } from "react";

/** Tracks real-time internet connectivity by listening to the browser's
 * online/offline events. `navigator.onLine` is the initial value; the state
 * updates immediately when the network state changes. */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  return { isOnline };
}
