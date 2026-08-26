// macOS isn't a supported download target on this site, so a Mac visitor
// falls back to "win" as the default primary CTA — Linux is the only other
// first-class platform.
export function detectOS() {
  if (typeof navigator === "undefined") return "win";
  const ua = navigator.userAgent;
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "win";
}
