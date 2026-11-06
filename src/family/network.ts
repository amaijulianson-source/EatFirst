const pending = new Set<AbortController>();
export function abortCloudRequests() {
  for (const controller of pending) controller.abort();
}
export async function cloudFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof navigator !== "undefined" && navigator.onLine === false)
    throw new DOMException("Offline", "AbortError");
  const controller = new AbortController();
  const source = init?.signal;
  const abort = () => controller.abort();
  if (source?.aborted) abort();
  else source?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 12000);
  pending.add(controller);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    pending.delete(controller);
    source?.removeEventListener("abort", abort);
  }
}
if (typeof window !== "undefined")
  window.addEventListener("offline", abortCloudRequests);
