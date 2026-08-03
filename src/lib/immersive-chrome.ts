/**
 * Tiny global store telling the app chrome (top bar) that a full-screen
 * vertical video scroller is active, so the header can go transparent.
 */
import { useEffect, useState } from "react";

let count = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function pushImmersive() {
  count += 1;
  emit();
  return () => {
    count = Math.max(0, count - 1);
    emit();
  };
}

export function useImmersiveChrome() {
  const [active, setActive] = useState(count > 0);
  useEffect(() => {
    const l = () => setActive(count > 0);
    listeners.add(l);
    l();
    return () => {
      listeners.delete(l);
    };
  }, []);
  return active;
}
