import { NextResponse } from "next/server";

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "ip6-localhost",
]);

/** Strip the port (and IPv6 brackets) from a Host header value. */
function hostOnly(value: string): string {
  const v = value.trim();
  if (v.startsWith("[")) {
    const end = v.indexOf("]");
    return end >= 0 ? v.slice(0, end + 1).toLowerCase() : v.toLowerCase();
  }
  return v.split(":")[0]!.toLowerCase();
}

function isLoopbackHost(value: string): boolean {
  return LOCAL_HOSTS.has(hostOnly(value));
}

/** True for 127.0.0.0/8, ::1, and IPv4-mapped loopback (::ffff:127.0.0.1). */
function isLoopbackIp(ip: string): boolean {
  const x = ip.trim().replace(/^::ffff:/i, "").toLowerCase();
  return x === "::1" || x === "127.0.0.1" || x.startsWith("127.");
}

/**
 * Guard the local-ops endpoints so they answer only to the local machine.
 *
 * The primary protection is the launcher binding `next start` to 127.0.0.1, so
 * remote machines cannot connect at all. This adds defence-in-depth against
 * DNS-rebinding and accidental wider binding:
 *
 *   - the effective host (`x-forwarded-host`, which `next start` sets from the
 *     incoming `Host`, falling back to `Host`) must be loopback — this refuses
 *     a request whose Host is `evil.com` even if it reached 127.0.0.1;
 *   - the connecting IP (`x-forwarded-for`, set by `next start` from the socket
 *     remote address) must be loopback when present.
 *
 * Returns a 403 response to short-circuit, or null when the request is local.
 */
export function refuseIfNotLocal(request: Request): NextResponse | null {
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedFor = request.headers.get("x-forwarded-for");

  const hostOk = !!host && isLoopbackHost(host);
  const ipOk = !forwardedFor || isLoopbackIp(forwardedFor.split(",")[0]!);

  if (hostOk && ipOk) return null;

  return NextResponse.json(
    { error: "Forbidden: local-ops endpoints are reachable from localhost only." },
    { status: 403 },
  );
}
