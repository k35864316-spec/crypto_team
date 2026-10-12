// 브라우저/서버 공용 인코딩 유틸리티 (외부 의존성 없음)

export function toB64Url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i += 0x8000) {
    bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** 서명 대상 메시지. 송신자와 수신자가 동일한 규칙으로 만들어야 한다. */
export function signaturePayload(cipherHashHex: string, plainHashHex: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`OTS-SIG-v1|${cipherHashHex}|${plainHashHex}`);
}

/** ECIES(ECDH + HKDF + AES-GCM)에서 쓰는 HKDF info 문자열 */
export const OTP_SEAL_INFO = "OTS-OTP-SEAL-v1";

export const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
