// 브라우저 전용 암호 모듈 — Web Crypto API만 사용한다. 키는 절대 서버로 전송되지 않는다.
import { concatBytes, fromB64Url, OTP_SEAL_INFO, signaturePayload, toB64Url, toHex } from "./encoding";

const subtle = () => {
  if (!globalThis.crypto?.subtle)
    throw new Error("이 브라우저는 Web Crypto API를 지원하지 않습니다 (HTTPS 또는 localhost 필요).");
  return globalThis.crypto.subtle;
};

export const sha256 = async (data: Uint8Array<ArrayBuffer>) => new Uint8Array(await subtle().digest("SHA-256", data));

export interface FileMeta {
  name: string;
  type: string;
  size: number;
}

export interface EncryptedPackage {
  ciphertext: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  metaIv: Uint8Array<ArrayBuffer>;
  metaCiphertext: Uint8Array<ArrayBuffer>;
  keyB64: string; // URL fragment(#)로만 전달되는 AES 키
  plainHash: string;
  cipherHash: string;
}

export const cipherHashOf = async (p: {
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
  metaIv: Uint8Array<ArrayBuffer>;
  metaCiphertext: Uint8Array<ArrayBuffer>;
}) => toHex(await sha256(concatBytes(p.iv, p.ciphertext, p.metaIv, p.metaCiphertext)));

/** ① 클라이언트 측 AES-256-GCM 암호화 */
export async function encryptFile(file: File): Promise<EncryptedPackage> {
  const plain = new Uint8Array(await file.arrayBuffer());
  const key = await subtle().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const metaIv = crypto.getRandomValues(new Uint8Array(12));
  const meta: FileMeta = { name: file.name, type: file.type || "application/octet-stream", size: file.size };

  const ciphertext = new Uint8Array(await subtle().encrypt({ name: "AES-GCM", iv }, key, plain));
  const metaCiphertext = new Uint8Array(
    await subtle().encrypt({ name: "AES-GCM", iv: metaIv }, key, new TextEncoder().encode(JSON.stringify(meta))),
  );
  const keyB64 = toB64Url(await subtle().exportKey("raw", key));
  const plainHash = toHex(await sha256(plain));
  const cipherHash = await cipherHashOf({ iv, ciphertext, metaIv, metaCiphertext });
  return { ciphertext, iv, metaIv, metaCiphertext, keyB64, plainHash, cipherHash };
}

export async function decryptFile(
  keyB64: string,
  p: {
    iv: Uint8Array<ArrayBuffer>;
    ciphertext: Uint8Array<ArrayBuffer>;
    metaIv: Uint8Array<ArrayBuffer>;
    metaCiphertext: Uint8Array<ArrayBuffer>;
  },
): Promise<{ plain: Uint8Array<ArrayBuffer>; meta: FileMeta }> {
  const key = await subtle().importKey("raw", fromB64Url(keyB64), "AES-GCM", false, ["decrypt"]);
  // GCM 인증 태그 검증에 실패하면 여기서 예외가 발생한다 (변조 탐지)
  const plain = new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv: p.iv }, key, p.ciphertext));
  const metaBytes = await subtle().decrypt({ name: "AES-GCM", iv: p.metaIv }, key, p.metaCiphertext);
  return { plain, meta: JSON.parse(new TextDecoder().decode(metaBytes)) as FileMeta };
}

/* ───────── ③ 전자서명 (ECDSA P-256 / SHA-256) ───────── */

const IDENTITY_KEY = "ots.signingIdentity.v1";

export interface SigningIdentity {
  privateKey: CryptoKey;
  publicKeyB64: string;
  fingerprint: string;
}

/** 공개키 지문 = SHA-256(raw 공개키)의 앞 16바이트 (base64url) */
export const fingerprintOf = async (publicKeyB64: string) =>
  toB64Url((await sha256(fromB64Url(publicKeyB64))).subarray(0, 16));

/** 지문을 사람이 비교하기 쉽게 4자씩 끊어 표시 */
export const prettyFingerprint = (fp: string) => fp.match(/.{1,4}/g)?.join(" ") ?? fp;

/** 송신자 서명 키를 localStorage에 보관해 여러 번 공유해도 같은 지문을 유지한다. */
export async function loadOrCreateIdentity(): Promise<SigningIdentity> {
  try {
    const saved = localStorage.getItem(IDENTITY_KEY);
    if (saved) {
      const { privateJwk, publicKeyB64 } = JSON.parse(saved) as { privateJwk: JsonWebKey; publicKeyB64: string };
      const privateKey = await subtle().importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
        "sign",
      ]);
      return { privateKey, publicKeyB64, fingerprint: await fingerprintOf(publicKeyB64) };
    }
  } catch {
    // 손상된 값이면 새로 만든다
  }
  const pair = await subtle().generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicKeyB64 = toB64Url(await subtle().exportKey("raw", pair.publicKey));
  const privateJwk = await subtle().exportKey("jwk", pair.privateKey);
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify({ privateJwk, publicKeyB64 }));
  } catch {
    // 저장 불가(시크릿 모드 등)해도 이번 업로드는 계속 진행
  }
  return { privateKey: pair.privateKey, publicKeyB64, fingerprint: await fingerprintOf(publicKeyB64) };
}

export function resetIdentity() {
  try {
    localStorage.removeItem(IDENTITY_KEY);
  } catch {}
}

export async function signHashes(privateKey: CryptoKey, cipherHash: string, plainHash: string) {
  const sig = await subtle().sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    signaturePayload(cipherHash, plainHash),
  );
  return toB64Url(sig);
}

export async function verifySignature(
  publicKeyB64: string,
  signatureB64: string,
  cipherHash: string,
  plainHash: string,
) {
  const pub = await subtle().importKey("raw", fromB64Url(publicKeyB64), { name: "ECDSA", namedCurve: "P-256" }, false, [
    "verify",
  ]);
  return subtle().verify(
    { name: "ECDSA", hash: "SHA-256" },
    pub,
    fromB64Url(signatureB64),
    signaturePayload(cipherHash, plainHash),
  );
}

/* ───────── ② OTP 수신용 ECDH 키 (송신자 브라우저에서만 복호화) ───────── */

export async function generateNotifyKeyPair() {
  const pair = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  return {
    publicKeyB64: toB64Url(await subtle().exportKey("raw", pair.publicKey)),
    privateKeyB64: toB64Url(await subtle().exportKey("pkcs8", pair.privateKey)),
  };
}

export async function openSealedOtp(privateKeyB64: string, sealed: { epk: string; iv: string; ct: string }) {
  const priv = await subtle().importKey(
    "pkcs8",
    fromB64Url(privateKeyB64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
  const epk = await subtle().importKey("raw", fromB64Url(sealed.epk), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = await subtle().deriveBits({ name: "ECDH", public: epk }, priv, 256);
  const hkdfKey = await subtle().importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  const aesKey = await subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode(OTP_SEAL_INFO) },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plain = await subtle().decrypt({ name: "AES-GCM", iv: fromB64Url(sealed.iv) }, aesKey, fromB64Url(sealed.ct));
  return new TextDecoder().decode(plain);
}

/** URL fragment(# 뒤) 파싱 — fragment는 HTTP 요청에 포함되지 않아 서버 로그에 남지 않는다. */
export function readFragment(): URLSearchParams {
  return new URLSearchParams(typeof window === "undefined" ? "" : window.location.hash.slice(1));
}
