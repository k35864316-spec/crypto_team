"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  downloadWithOtp,
  errorMessage,
  getShareInfo,
  requestOtp,
  type ShareInfo,
  type VerificationResult,
} from "@/lib/service";
import { Button, Card, Check, ErrorBox, formatBytes, formatSeconds, StatusBadge, useCountdown } from "./ui";

export default function DownloadView() {
  const { id } = useParams<{ id: string }>();
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState<VerificationResult | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInfo(await getShareInfo(id));
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 상태 조회
    refresh();
  }, [refresh]);

  const otpLeft = useCountdown(info?.otpPending ? info.otpExpiresAt : null);
  const fileLeft = useCountdown(info?.expiresAt);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const allOk = verify?.checks.every((c) => c.ok);

  return (
    <div className="space-y-6">
      <Card title="🔒 암호화된 파일을 받았습니다">
        {info ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              상태 <StatusBadge status={info.status} />
            </div>
            <div>파일 크기: {formatBytes(info.size)}</div>
            {info.status === "active" && <div>자동 파기까지: {formatSeconds(fileLeft)}</div>}
          </div>
        ) : (
          <p className="text-muted text-sm">공유 ID: {id}</p>
        )}
      </Card>

      {!verify && (
        <Card title="OTP 인증">
          <ol className="text-muted mb-5 list-decimal space-y-1 pl-5 text-sm">
            <li>‘OTP 요청’을 누르면 6자리 일회용 코드가 송신자에게 전달됩니다.</li>
            <li>송신자에게 별도 경로(카카오톡·전화 등)로 코드를 받으세요. (유효시간 3분)</li>
            <li>코드를 입력하면 파일이 단 한 번 전송되고 서버에서 즉시 삭제됩니다.</li>
          </ol>
          <div className="space-y-4">
            <Button variant="ghost" disabled={busy} onClick={() => run(async () => (await requestOtp(id), refresh()))}>
              OTP 요청{info && ` (남은 발급 ${info.otpIssuesLeft}회)`}
            </Button>
            {info?.otpPending && (
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
              />
              <Button
                disabled={busy || otp.length !== 6}
                onClick={() => run(async () => setVerify(await downloadWithOtp(id, otp)))}
              >
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
            {verify.checks.map((c) => (
              <Check key={c.label} ok={c.ok} label={c.label} detail={c.detail} />
            ))}
          </ul>
          <p className="mt-4 text-sm">
            파일: <b>{verify.fileName}</b> ({formatBytes(verify.fileSize)})
          </p>
        </Card>
      )}
    </div>
  );
}
