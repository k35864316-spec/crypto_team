"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { ShareStatus } from "@/lib/config";
import {
  cipherHashOf,
  decryptFile,
  fingerprintOf,
  prettyFingerprint,
  readFragment,
  sha256,
  verifySignature,
} from "@/lib/client-crypto";
import { fromB64Url, toHex } from "@/lib/encoding";
import { Button, Card, Check, ErrorBox, formatBytes, formatSeconds, StatusBadge, useCountdown } from "./ui";

interface Info {
  status: ShareStatus;
  size: number;
  expiresAt: string;
  otpPending: boolean;
  otpExpiresAt: string | null;
  otpIssuesLeft: number;
  attemptsLeft: number;
}

interface Verification {
  fingerprint: boolean;
  cipherHash: boolean;
  signature: boolean;
  decrypted: boolean;
  plainHash: boolean;
  signerFp: string;
  plainHashHex: string;
  fileName: string;
  fileSize: number;
}

export default function DownloadView() {
  const { id } = useParams<{ id: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState<Verification | null>(null);
  const [frag, setFrag] = useState<{ key: string; fp: string } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/files/${id}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else setInfo(data);
  }, [id]);

  useEffect(() => {
    const f = readFragment();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fragment는 클라이언트에서만 읽을 수 있음
    setFrag({ key: f.get("k") ?? "", fp: f.get("f") ?? "" });
    // fragment가 브라우저 기록/Referer로 새지 않도록 주소창에서 지운다 (키는 메모리에만 유지)
    history.replaceState(null, "", window.location.pathname);
    refresh();
  }, [refresh]);

  const otpLeft = useCountdown(info?.otpPending ? info.otpExpiresAt : null);
  const fileLeft = useCountdown(info?.expiresAt);

  async function requestOtp() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/files/${id}/otp`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    await refresh();
    setBusy(false);
  }

  async function download() {
    if (!frag?.key) return setError("링크에 복호화 키(#k=…)가 없습니다. 링크 전체를 복사했는지 확인하세요.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${id}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.attemptsLeft !== undefined ? `${data.error} (남은 시도: ${data.attemptsLeft}회)` : data.error);
        await refresh();
        return;
      }

      const pkg = {
        iv: fromB64Url(data.iv),
        ciphertext: fromB64Url(data.ciphertext),
        metaIv: fromB64Url(data.metaIv),
        metaCiphertext: fromB64Url(data.metaCiphertext),
      };
      // ③ 무결성·서명 검증 (서버를 신뢰하지 않음)
      const signerFp = await fingerprintOf(data.signerPublicKey);
      const fingerprint = !!frag.fp && signerFp === frag.fp; // 링크에 박힌 지문과 서버가 준 공개키가 일치?
      const cipherHash = (await cipherHashOf(pkg)) === data.cipherHash;
      const signature = await verifySignature(data.signerPublicKey, data.signature, data.cipherHash, data.plainHash);

      let decrypted = false;
      let plainHash = false;
      let plainHashHex = "";
      let fileName = "";
      let fileSize = 0;
      try {
        const { plain, meta } = await decryptFile(frag.key, pkg);
        decrypted = true;
        plainHashHex = toHex(await sha256(plain));
        plainHash = plainHashHex === data.plainHash;
        fileName = meta.name;
        fileSize = meta.size;
        if (fingerprint && signature && plainHash) {
          const url = URL.createObjectURL(new Blob([plain], { type: meta.type }));
          const a = document.createElement("a");
          a.href = url;
          a.download = meta.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        }
      } catch {
        decrypted = false;
      }
      setVerify({
        fingerprint,
        cipherHash,
        signature,
        decrypted,
        plainHash,
        signerFp,
        plainHashHex,
        fileName,
        fileSize,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const allOk =
    verify && verify.fingerprint && verify.cipherHash && verify.signature && verify.decrypted && verify.plainHash;

  return (
    <div className="space-y-6">
      <Card title="🔒 암호화된 파일을 받았습니다">
        {!info && !error && <p className="text-muted">불러오는 중…</p>}
        {info && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              상태 <StatusBadge status={info.status} />
            </div>
            <div>암호문 크기: {formatBytes(info.size)}</div>
            {info.status === "active" && <div>자동 파기까지: {formatSeconds(fileLeft)}</div>}
            {frag && !frag.key && (
              <ErrorBox>링크에 복호화 키가 없습니다. 링크 전체(# 이후 포함)를 사용하세요.</ErrorBox>
            )}
          </div>
        )}
      </Card>

      {info?.status === "active" && !verify && (
        <Card title="OTP 인증">
          <ol className="text-muted mb-5 list-decimal space-y-1 pl-5 text-sm">
            <li>‘OTP 요청’을 누르면 서버가 6자리 일회용 코드를 만들어 송신자에게 전달합니다.</li>
            <li>송신자에게 카카오톡·전화 등 별도 경로로 코드를 받으세요. (유효시간 3분)</li>
            <li>코드를 입력하면 암호문이 단 한 번 전송되고 서버에서 즉시 삭제됩니다.</li>
          </ol>
          <div className="space-y-4">
            <Button variant="ghost" onClick={requestOtp} disabled={busy || info.otpIssuesLeft === 0}>
              {info.otpPending ? "OTP 재요청" : "OTP 요청"} (남은 발급 {info.otpIssuesLeft}회)
            </Button>
            {info.otpPending && (
              <div className="text-sm">
                OTP 유효시간: <span className="font-mono font-semibold">{formatSeconds(otpLeft)}</span> · 남은 시도{" "}
                {info.attemptsLeft}회
              </div>
            )}
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="border-line bg-bg w-40 rounded-lg border px-3 py-2 text-center font-mono text-lg tracking-[0.4em]"
                data-testid="otp-input"
              />
              <Button onClick={download} disabled={busy || otp.length !== 6 || !info.otpPending}>
                인증 후 다운로드
              </Button>
            </div>
          </div>
        </Card>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}

      {verify && (
        <Card title={allOk ? "✅ 검증 완료 — 파일이 저장되었습니다" : "⚠️ 위변조가 탐지되었습니다"}>
          <ul className="space-y-3">
            <Check
              ok={verify.fingerprint}
              label="송신자 공개키 지문이 링크와 일치"
              detail={prettyFingerprint(verify.signerFp)}
            />
            <Check ok={verify.cipherHash} label="암호문 SHA-256 해시 일치 (서버 저장 중 변조 없음)" />
            <Check ok={verify.signature} label="ECDSA P-256 전자서명 검증" />
            <Check ok={verify.decrypted} label="AES-256-GCM 복호화 및 인증 태그 검증" />
            <Check ok={verify.plainHash} label="원본 파일 SHA-256 해시 일치" detail={verify.plainHashHex} />
          </ul>
          {verify.decrypted && (
            <p className="mt-4 text-sm">
              파일: <b>{verify.fileName}</b> ({formatBytes(verify.fileSize)})
            </p>
          )}
          {!allOk && <p className="text-danger mt-4 text-sm">검증에 실패해 파일을 저장하지 않았습니다.</p>}
          <p className="text-muted mt-4 text-xs">
            서버의 암호문은 이미 영구 삭제되었습니다. 이 링크는 다시 사용할 수 없습니다.
          </p>
        </Card>
      )}
    </div>
  );
}
