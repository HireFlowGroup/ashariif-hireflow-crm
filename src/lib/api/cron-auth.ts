import { timingSafeEqual } from "crypto";

export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  if (!token) return false;

  try {
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyCronOrWorkerSecret(request: Request): boolean {
  if (verifyCronSecret(request)) return true;

  const workerSecret = process.env.WORKER_SECRET?.trim();
  if (!workerSecret) return false;

  const header = request.headers.get("x-worker-secret") ?? "";
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(workerSecret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
