import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual, webcrypto } from "node:crypto";
import { fromB64Url, OTP_SEAL_INFO, toB64Url } from "./encoding";

const subtle = webcrypto.subtle;

function pepper(): string {
  const p = process.env.OTP_PEPPER;
  if (!p || p.length < 32) throw new Error("OTP_PEPPER 환경변수(32자 이상)가 필요합니다.");
  return p;
}

/** 128비트 난수 기반 공유 ID (base64url 22자) */
export const newShareId = () => toB64Url(randomBytes(16));

/** 송신자 관리 토큰 (256비트). 서버는 SHA-256 해시만 저장한다. */
export const newManageToken = () => toB64Url(randomBytes(32));

export const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");

/** CSPRNG 기반 6자리 OTP */
export const newOtpCode = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

/** OTP는 공유 ID와 묶어 HMAC 처리 후 저장 → DB가 유출돼도 평문 OTP를 알 수 없다. */
export const hashOtp = (shareId: string, code: string) =>
  createHmac("sha256", pepper()).update(`${shareId}:${code}`).digest("hex");

/** 타이밍 공격을 막기 위한 상수 시간 비교 */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * ECIES: 송신자의 ECDH P-256 공개키로 OTP를 봉인한다.
 * 임시 키쌍(ephemeral) → ECDH 공유 비밀 → HKDF-SHA256 → AES-256-GCM
 */
export async function sealForSender(recipientPubB64: string, plaintext: string) {
  const recipientPub = await subtle.importKey(
    "raw",
    fromB64Url(recipientPubB64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const eph = await subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const shared = await subtle.deriveBits({ name: "ECDH", public: recipientPub }, eph.privateKey, 256);
  const hkdfKey = await subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  const aesKey = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode(OTP_SEAL_INFO) },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const iv = randomBytes(12);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(plaintext));
  const epk = await subtle.exportKey("raw", eph.publicKey);
  return { epk: toB64Url(epk), iv: toB64Url(iv), ct: toB64Url(ct) };
}

/** 업로드 시 전달된 공개키가 올바른 P-256 점인지 검증 */
export async function isValidP256PublicKey(b64: string, alg: "ECDH" | "ECDSA"): Promise<boolean> {
  try {
    const raw = fromB64Url(b64);
    if (raw.length !== 65 || raw[0] !== 0x04) return false;
    await subtle.importKey("raw", raw, { name: alg, namedCurve: "P-256" }, false, alg === "ECDSA" ? ["verify"] : []);
    return true;
  } catch {
    return false;
  }
}
