"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { ShareStatus } from "@/lib/config";
import { openSealedOtp, readFragment } from "@/lib/client-crypto";
import { Button, Card, ErrorBox, formatBytes, formatSeconds, StatusBadge, useCountdown } from "./ui";

interface ManageInfo {
  status: ShareStatus;
  size: number;
  createdAt: string;
  expiresAt: string;
  finishedAt: string | null;
  otp: { sealed: { epk: string; iv: string; ct: string }; expiresAt: string } | null;
  otpIssueCount: number;
  maxOtpIssues: number;
  failedAttempts: number;
  maxFailedAttempts: number;
  plainHash: string;
}

const STORAGE_PREFIX = "ots.manage.";

export default function ManageView() {
  const { id } = useParams<{ id: string }>();
  const [creds, setCreds] = useState<{ token: string; notifyKey: string } | null>(null);
  const [info, setInfo] = useState<ManageInfo | null>(null);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSealed = useRef<string>("");

  useEffect(() => {
    // fragment에서 관리 토큰과 OTP 복호화 키를 읽고, 새로고침 대비 sessionStorage에 보관 후 주소창에서 제거
    const f = readFragment();
    let token = f.get("t") ?? "";
    let notifyKey = f.get("n") ?? "";
    try {
      if (token && notifyKey) sessionStorage.setItem(STORAGE_PREFIX + id, JSON.stringify({ token, notifyKey }));
      else ({ token = "", notifyKey = "" } = JSON.parse(sessionStorage.getItem(STORAGE_PREFIX + id) ?? "{}"));
    } catch {}
    history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fragment 1회 읽기
    if (token && notifyKey) setCreds({ token, notifyKey });
    else setError("관리 링크가 올바르지 않습니다. 업로드 직후 받은 링크 전체를 사용하세요.");
  }, [id]);

  const poll = useCallback(async () => {
    if (!creds) return;
    const res = await fetch(`/api/files/${id}/manage`, {
      headers: { Authorization: `Bearer ${creds.token}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setInfo(data);
    const sealedKey = data.otp ? data.otp.sealed.ct : "";
    if (sealedKey !== lastSealed.current) {
      lastSealed.current = sealedKey;
      setOtpCode(data.otp ? await openSealedOtp(creds.notifyKey, data.otp.sealed) : null);
    }
  }, [creds, id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 즉시 1회 조회 후 주기적 폴링
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [poll]);

  const otpLeft = useCountdown(info?.otp?.expiresAt);
  const fileLeft = useCountdown(info?.expiresAt);

  async function destroy() {
    if (!creds || !confirm("파일을 지금 영구 파기할까요? 되돌릴 수 없습니다.")) return;
    await fetch(`/api/files/${id}/manage`, { method: "DELETE", headers: { Authorization: `Bearer ${creds.token}` } });
    await poll();
  }

  return (
    <div className="space-y-6">
      {error && <ErrorBox>{error}</ErrorBox>}
      {info && (
        <>
          <Card title="송신자 관리 페이지">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-3">
                상태 <StatusBadge status={info.status} />
              </div>
              <div>암호문 크기: {formatBytes(info.size)}</div>
              <div>업로드: {new Date(info.createdAt).toLocaleString("ko-KR")}</div>
              {info.status === "active" ? (
                <div>자동 파기까지: {formatSeconds(fileLeft)}</div>
              ) : (
                info.finishedAt && <div>파기 시각: {new Date(info.finishedAt).toLocaleString("ko-KR")}</div>
              )}
              <div>
                OTP 발급 {info.otpIssueCount}/{info.maxOtpIssues} · 실패 {info.failedAttempts}/{info.maxFailedAttempts}
              </div>
              <div className="text-muted text-xs break-all">원본 SHA-256: {info.plainHash}</div>
            </div>
          </Card>

          {info.status === "active" && (
            <Card title="수신자 OTP">
              {otpCode && info.otp ? (
                <div className="space-y-3 text-center">
                  <div className="font-mono text-5xl font-bold tracking-[0.3em]" data-testid="otp-code">
                    {otpCode}
                  </div>
                  <div className="text-muted text-sm">
                    유효시간 {formatSeconds(otpLeft)} — 카카오톡·전화 등 별도 경로로 수신자에게 알려 주세요.
                  </div>
                </div>
              ) : (
                <p className="text-muted text-sm">
                  수신자가 아직 OTP를 요청하지 않았습니다. 이 페이지를 열어 두면 3초마다 자동으로 확인합니다.
                </p>
              )}
              <p className="text-muted mt-4 text-xs">
                OTP는 서버에서 내 ECDH 공개키로 봉인되어 저장되며, 이 브라우저에 있는 개인키로만 열 수 있습니다.
              </p>
            </Card>
          )}

          {info.status === "active" && (
            <Button variant="danger" onClick={destroy}>
              지금 즉시 파기
            </Button>
          )}
        </>
      )}
    </div>
  );
}
