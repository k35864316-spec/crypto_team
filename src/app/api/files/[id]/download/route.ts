import { MAX_FAILED_ATTEMPTS } from "@/lib/config";
import { toB64Url } from "@/lib/encoding";
import { getDb } from "@/lib/mongodb";
import { hashOtp, safeEqualHex } from "@/lib/server-crypto";
import { destroyShare, isValidId, json, jsonError, loadShare } from "@/lib/shares";

/**
 * OTP 검증 후 암호문 1회 전송 + 즉시 파기.
 * findOneAndUpdate / findOneAndDelete 의 원자성으로 같은 OTP를 두 세션이 동시에 써도
 * 단 한 세션만 파일을 받는다 (재전송·재사용 공격 방지).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/files/[id]/download">) {
  const { id } = await ctx.params;
  if (!isValidId(id)) return jsonError(404, "존재하지 않는 링크입니다.");

  const body = (await request.json().catch(() => null)) as { otp?: unknown } | null;
  const code = typeof body?.otp === "string" ? body.otp.trim() : "";
  if (!/^\d{6}$/.test(code)) return jsonError(400, "6자리 숫자 OTP를 입력하세요.");

  const share = await loadShare(id);
  if (!share) return jsonError(404, "존재하지 않거나 이미 삭제된 링크입니다.");
  if (share.status !== "active") return jsonError(410, "이미 파기된 파일입니다.", { status: share.status });
  if (!share.otp || share.otp.used) return jsonError(400, "먼저 OTP를 요청하세요.");
  if (share.otp.expiresAt.getTime() <= Date.now()) return jsonError(400, "OTP가 만료되었습니다. 새로 요청하세요.");

  const { files, shares } = await getDb();
  const submitted = hashOtp(id, code);

  if (!safeEqualHex(submitted, share.otp.hash)) {
    const updated = await shares.findOneAndUpdate(
      { _id: id, status: "active" },
      { $inc: { failedAttempts: 1 } },
      { returnDocument: "after" },
    );
    const failed = updated?.failedAttempts ?? MAX_FAILED_ATTEMPTS;
    if (failed >= MAX_FAILED_ATTEMPTS) {
      // 무차별 대입 방어: 실패 한도 초과 시 파일을 잠그고 즉시 파기
      await destroyShare(id, "locked");
      return jsonError(423, "OTP를 너무 많이 틀려 파일이 잠기고 파기되었습니다.", { status: "locked" });
    }
    return jsonError(401, "OTP가 올바르지 않습니다.", { attemptsLeft: MAX_FAILED_ATTEMPTS - failed });
  }

  // OTP 소비: 해시·미사용·미만료 조건이 모두 맞을 때만 상태를 바꾼다 (원자적)
  const claimed = await shares.findOneAndUpdate(
    { _id: id, status: "active", "otp.hash": share.otp.hash, "otp.used": false, "otp.expiresAt": { $gt: new Date() } },
    { $set: { "otp.used": true, status: "downloaded" } },
  );
  if (!claimed) return jsonError(409, "이미 다른 세션에서 사용된 OTP입니다.");

  const file = await files.findOneAndDelete({ _id: id });
  await destroyShare(id, "downloaded", false);
  if (!file) return jsonError(410, "파일이 이미 삭제되었습니다.");

  return json({
    ciphertext: toB64Url(file.ciphertext.buffer),
    iv: toB64Url(file.iv.buffer),
    metaIv: toB64Url(file.metaIv.buffer),
    metaCiphertext: toB64Url(file.metaCiphertext.buffer),
    signature: share.signature,
    signerPublicKey: share.signerPublicKey,
    plainHash: share.plainHash,
    cipherHash: share.cipherHash,
  });
}
