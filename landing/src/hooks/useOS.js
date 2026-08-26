export function detectOS() {
  if (typeof navigator === "undefined") return "win";
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return "mac";
  if (/Win/i.test(ua)) return "win";
  if (/Linux/i.test(ua)) return "linux";
  return "win";
}
