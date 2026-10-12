import { MAX_OTP_ISSUES, OTP_COOLDOWN_SECONDS, OTP_TTL_SECONDS } from "@/lib/config";
import { getDb } from "@/lib/mongodb";
import { hashOtp, newOtpCode, sealForSender } from "@/lib/server-crypto";
import { isValidId, json, jsonError, loadShare } from "@/lib/shares";

/**
 * ② OTP 발급: 6자리 난수를 만들고
 *  - DB에는 HMAC 해시만 저장 (평문 저장 X)
 *  - 송신자 ECDH 공개키로 봉인한 사본을 저장 → 송신자 관리 화면에서만 열람 가능
 * 이전 OTP는 즉시 무효화된다.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/files/[id]/otp">) {
  const { id } = await ctx.params;
  if (!isValidId(id)) return jsonError(404, "존재하지 않는 링크입니다.");
  const share = await loadShare(id);
  if (!share) return jsonError(404, "존재하지 않거나 이미 삭제된 링크입니다.");
  if (share.status !== "active") return jsonError(410, "이미 파기된 파일입니다.", { status: share.status });
  if (share.otpIssueCount >= MAX_OTP_ISSUES) return jsonError(429, "OTP 발급 횟수를 모두 사용했습니다.");

  const now = Date.now();
  if (share.lastOtpAt && now - share.lastOtpAt.getTime() < OTP_COOLDOWN_SECONDS * 1000) {
    const wait = Math.ceil((OTP_COOLDOWN_SECONDS * 1000 - (now - share.lastOtpAt.getTime())) / 1000);
    return jsonError(429, `${wait}초 후에 다시 요청할 수 있습니다.`, { retryAfter: wait });
  }

  const code = newOtpCode();
  const expiresAt = new Date(now + OTP_TTL_SECONDS * 1000);
  const sealed = await sealForSender(share.notifyPublicKey, code);

  const { shares } = await getDb();
  // 조건부 업데이트로 동시 요청 시 발급 횟수 제한을 우회하지 못하게 한다.
  const res = await shares.updateOne(
    { _id: id, status: "active", otpIssueCount: share.otpIssueCount },
    {
      $set: { otp: { hash: hashOtp(id, code), expiresAt, used: false, sealed }, lastOtpAt: new Date(now) },
      $inc: { otpIssueCount: 1 },
    },
  );
  if (res.modifiedCount !== 1) return jsonError(409, "동시에 다른 요청이 처리되었습니다. 다시 시도하세요.");

  return json({ expiresAt: expiresAt.toISOString(), otpIssuesLeft: MAX_OTP_ISSUES - share.otpIssueCount - 1 });
}
