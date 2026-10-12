import { Binary } from "mongodb";
import { MAX_FILE_BYTES, RECEIPT_RETENTION_HOURS, TTL_OPTIONS_MINUTES } from "@/lib/config";
import { getDb } from "@/lib/mongodb";
import { isValidP256PublicKey, newManageToken, newShareId, sha256Hex } from "@/lib/server-crypto";
import { json, jsonError } from "@/lib/shares";

const HEX64 = /^[0-9a-f]{64}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;

async function bytesOf(form: FormData, name: string, maxBytes: number) {
  const v = form.get(name);
  if (!(v instanceof Blob) || v.size === 0 || v.size > maxBytes) return null;
  return new Uint8Array(await v.arrayBuffer());
}

/** 업로드: 브라우저가 이미 암호화한 암호문과 서명만 받는다. 키는 받지 않는다. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "multipart/form-data 형식이어야 합니다.");
  }

  const ciphertext = await bytesOf(form, "ciphertext", MAX_FILE_BYTES + 16);
  const iv = await bytesOf(form, "iv", 12);
  const metaIv = await bytesOf(form, "metaIv", 12);
  const metaCiphertext = await bytesOf(form, "metaCiphertext", 4096);
  if (!ciphertext) return jsonError(413, `파일은 1바이트 이상 ${MAX_FILE_BYTES / 1024 / 1024}MB 이하여야 합니다.`);
  if (!iv || iv.length !== 12 || !metaIv || metaIv.length !== 12 || !metaCiphertext)
    return jsonError(400, "암호화 파라미터가 올바르지 않습니다.");

  const str = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string) : "");
  const plainHash = str("plainHash");
  const cipherHash = str("cipherHash");
  const signature = str("signature");
  const signerPublicKey = str("signerPublicKey");
  const notifyPublicKey = str("notifyPublicKey");
  const ttlMinutes = Number(str("ttlMinutes"));

  if (!HEX64.test(plainHash) || !HEX64.test(cipherHash)) return jsonError(400, "해시 형식이 올바르지 않습니다.");
  if (!B64URL.test(signature) || signature.length > 200) return jsonError(400, "서명 형식이 올바르지 않습니다.");
  if (!(TTL_OPTIONS_MINUTES as readonly number[]).includes(ttlMinutes))
    return jsonError(400, "보관 시간이 올바르지 않습니다.");
  if (!(await isValidP256PublicKey(signerPublicKey, "ECDSA")) || !(await isValidP256PublicKey(notifyPublicKey, "ECDH")))
    return jsonError(400, "공개키 형식이 올바르지 않습니다.");

  // 서버도 암호문 해시를 다시 계산해 전송 중 손상을 검사한다 (서명 검증은 수신자 브라우저가 수행).
  const serverCipherHash = sha256Hex(Buffer.concat([iv, ciphertext, metaIv, metaCiphertext]));
  if (serverCipherHash !== cipherHash) return jsonError(400, "암호문 해시가 일치하지 않습니다 (전송 중 손상).");

  const id = newShareId();
  const manageToken = newManageToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
  const { files, shares } = await getDb();

  await files.insertOne({
    _id: id,
    ciphertext: new Binary(ciphertext),
    iv: new Binary(iv),
    metaIv: new Binary(metaIv),
    metaCiphertext: new Binary(metaCiphertext),
    expiresAt,
  });
  await shares.insertOne({
    _id: id,
    status: "active",
    manageTokenHash: sha256Hex(manageToken),
    notifyPublicKey,
    signerPublicKey,
    signature,
    plainHash,
    cipherHash,
    size: ciphertext.length,
    createdAt: now,
    expiresAt,
    purgeAt: new Date(expiresAt.getTime() + RECEIPT_RETENTION_HOURS * 3600_000),
    otp: null,
    otpIssueCount: 0,
    lastOtpAt: null,
    failedAttempts: 0,
    finishedAt: null,
  });

  return json({ id, manageToken, expiresAt: expiresAt.toISOString() }, 201);
}
