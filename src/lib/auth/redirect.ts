/** Only allow same-site relative redirects after login (blocks `//evil.com`, `/\evil.com`, absolute URLs). */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  return value;
}
