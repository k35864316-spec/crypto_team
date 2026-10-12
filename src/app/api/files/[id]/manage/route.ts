import { MAX_FAILED_ATTEMPTS, MAX_OTP_ISSUES } from "@/lib/config";
import { safeEqualHex, sha256Hex } from "@/lib/server-crypto";
import { destroyShare, isValidId, json, jsonError, loadShare } from "@/lib/shares";

async function authorize(request: Request, id: string) {
  if (!isValidId(id)) return { error: jsonError(404, "존재하지 않는 링크입니다.") };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const share = await loadShare(id);
  if (!share) return { error: jsonError(404, "존재하지 않거나 기록이 만료된 공유입니다.") };
  if (!token || !safeEqualHex(sha256Hex(token), share.manageTokenHash))
    return { error: jsonError(403, "관리 토큰이 올바르지 않습니다.") };
  return { share };
}

/** 송신자 관리 화면: 상태 + (있다면) 봉인된 OTP. 봉인은 송신자 브라우저의 ECDH 개인키로만 열 수 있다. */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[id]/manage">) {
  const { id } = await ctx.params;
  const { share, error } = await authorize(request, id);
  if (error) return error;
  const otpLive = share.otp && !share.otp.used && share.otp.expiresAt.getTime() > Date.now();
  return json({
    status: share.status,
    size: share.size,
    createdAt: share.createdAt.toISOString(),
    expiresAt: share.expiresAt.toISOString(),
    finishedAt: share.finishedAt?.toISOString() ?? null,
    otp: otpLive ? { sealed: share.otp!.sealed, expiresAt: share.otp!.expiresAt.toISOString() } : null,
    otpIssueCount: share.otpIssueCount,
    maxOtpIssues: MAX_OTP_ISSUES,
    failedAttempts: share.failedAttempts,
    maxFailedAttempts: MAX_FAILED_ATTEMPTS,
    plainHash: share.plainHash,
  });
}

/** 송신자가 수동으로 즉시 파기 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/files/[id]/manage">) {
  const { id } = await ctx.params;
  const { share, error } = await authorize(request, id);
  if (error) return error;
  if (share.status === "active") await destroyShare(id, "destroyed");
  return json({ ok: true });
}
