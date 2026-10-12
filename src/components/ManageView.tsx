"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { destroyShare, errorMessage, getManageInfo, type ManageInfo } from "@/lib/service";
import { Button, Card, ErrorBox, formatBytes, formatSeconds, StatusBadge, useCountdown } from "./ui";

export default function ManageView() {
  const { id } = useParams<{ id: string }>();
  const [info, setInfo] = useState<ManageInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      setInfo(await getManageInfo(id));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 즉시 1회 조회 후 주기적 폴링
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [poll]);

  const otpLeft = useCountdown(info?.otp?.expiresAt);
  const fileLeft = useCountdown(info?.expiresAt);

  async function destroy() {
    if (!confirm("파일을 지금 영구 파기할까요? 되돌릴 수 없습니다.")) return;
    try {
      await destroyShare(id);
      await poll();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-6">
      <Card title="송신자 관리 페이지">
        {info ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              상태 <StatusBadge status={info.status} />
            </div>
            <div>파일 크기: {formatBytes(info.size)}</div>
            <div>업로드: {new Date(info.createdAt).toLocaleString("ko-KR")}</div>
            {info.status === "active" && <div>자동 파기까지: {formatSeconds(fileLeft)}</div>}
          </div>
        ) : (
          <p className="text-muted text-sm">공유 ID: {id}</p>
        )}
      </Card>

      <Card title="수신자 OTP">
        {info?.otp ? (
          <div className="space-y-3 text-center">
            <div className="font-mono text-5xl font-bold tracking-[0.3em]">{info.otp.code}</div>
            <div className="text-muted text-sm">
              유효시간 {formatSeconds(otpLeft)} — 별도 경로로 수신자에게 알려 주세요.
            </div>
          </div>
        ) : (
          <p className="text-muted text-sm">수신자가 OTP를 요청하면 여기에 표시됩니다. (3초마다 자동 확인)</p>
        )}
      </Card>

      {error && <ErrorBox>{error}</ErrorBox>}

      <Button variant="danger" onClick={destroy}>
        지금 즉시 파기
      </Button>
    </div>
  );
}
