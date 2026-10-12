"use client";

import { useState } from "react";
import { MAX_FILE_BYTES, TTL_OPTIONS_MINUTES } from "@/lib/config";
import { errorMessage, uploadFile, type UploadResult } from "@/lib/service";
import { Button, Card, CopyField, ErrorBox, formatBytes } from "./ui";

const TTL_LABEL: Record<number, string> = { 10: "10분", 60: "1시간", 1440: "24시간" };

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [ttl, setTtl] = useState<number>(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function upload() {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setError(`파일은 ${formatBytes(MAX_FILE_BYTES)} 이하만 가능합니다.`);
    setError(null);
    setBusy(true);
    try {
      setResult(await uploadFile(file, ttl));
      setFile(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <Card title="✅ 업로드 완료">
        <div className="space-y-5">
          <CopyField label="① 수신자에게 보낼 공유 링크" value={result.shareUrl} />
          <CopyField
            label="② 송신자 전용 관리 링크 (절대 공유 금지)"
            value={result.manageUrl}
            hint="수신자가 OTP를 요청하면 이 페이지에 OTP가 표시됩니다."
          />
          <div className="bg-bg rounded-lg p-4 text-sm">만료: {new Date(result.expiresAt).toLocaleString("ko-KR")}</div>
          <Button variant="ghost" onClick={() => setResult(null)}>
            다른 파일 보내기
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="파일 보내기">
      <div className="space-y-5">
        <label
          className="border-line hover:border-accent flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setFile(e.dataTransfer.files[0] ?? null);
          }}
        >
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <span className="text-3xl">🔐</span>
          {file ? (
            <span className="font-medium">
              {file.name} <span className="text-muted">({formatBytes(file.size)})</span>
            </span>
          ) : (
            <span className="text-muted">클릭하거나 파일을 끌어다 놓으세요 (최대 {formatBytes(MAX_FILE_BYTES)})</span>
          )}
        </label>

        <div>
          <div className="mb-2 text-sm font-medium">보관 시간 (지나면 자동 파기)</div>
          <div className="flex gap-2">
            {TTL_OPTIONS_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTtl(m)}
                className={`rounded-lg border px-4 py-2 text-sm ${ttl === m ? "border-accent bg-accent/10 text-accent" : "border-line"}`}
              >
                {TTL_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}

        <Button className="w-full" disabled={!file || busy} onClick={upload}>
          암호화하고 업로드
        </Button>
      </div>
    </Card>
  );
}
