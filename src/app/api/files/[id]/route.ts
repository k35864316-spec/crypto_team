import { MAX_FAILED_ATTEMPTS, MAX_OTP_ISSUES } from "@/lib/config";
import { isValidId, json, jsonError, loadShare } from "@/lib/shares";

/** 수신자용 공개 상태 조회 — 민감 정보(해시, 공개키)는 OTP 검증 전에는 주지 않는다. */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (!isValidId(id)) return jsonError(404, "존재하지 않는 링크입니다.");
  const share = await loadShare(id);
  if (!share) return jsonError(404, "존재하지 않거나 이미 삭제된 링크입니다.");
  return json({
    status: share.status,
    size: share.size,
    expiresAt: share.expiresAt.toISOString(),
    otpPending: !!share.otp && !share.otp.used && share.otp.expiresAt.getTime() > Date.now(),
    otpExpiresAt: share.otp?.expiresAt.toISOString() ?? null,
    otpIssuesLeft: Math.max(0, MAX_OTP_ISSUES - share.otpIssueCount),
    attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - share.failedAttempts),
  });
}
