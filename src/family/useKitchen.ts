import { useEffect, useSyncExternalStore } from "react";
import { kitchen } from "./store";
export function useKitchen() {
  const state = useSyncExternalStore(kitchen.subscribe, kitchen.getSnapshot);
  useEffect(() => {
    void kitchen.start();
  }, []);
  return state;
}
