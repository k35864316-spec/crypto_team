"use client";

import { useEffect, useState } from "react";
import { MAX_FILE_BYTES, TTL_OPTIONS_MINUTES } from "@/lib/config";
import {
  encryptFile,
  generateNotifyKeyPair,
  loadOrCreateIdentity,
  prettyFingerprint,
  resetIdentity,
  signHashes,
} from "@/lib/client-crypto";
import { Button, Card, CopyField, ErrorBox, formatBytes } from "./ui";

interface Result {
  shareUrl: string;
  manageUrl: string;
  expiresAt: string;
  fingerprint: string;
}

const TTL_LABEL: Record<number, string> = { 10: "10분", 60: "1시간", 1440: "24시간" };

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [ttl, setTtl] = useState<number>(60);
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [fingerprint, setFingerprint] = useState<string>("");

  useEffect(() => {
    loadOrCreateIdentity()
      .then((id) => setFingerprint(id.fingerprint))
      .catch((e: Error) => setError(e.message));
  }, []);

  async function upload() {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setError(`파일은 ${formatBytes(MAX_FILE_BYTES)} 이하만 가능합니다.`);
    setError(null);
    try {
      setStep("① 브라우저에서 AES-256-GCM 키 생성 및 파일 암호화 중…");
      const pkg = await encryptFile(file);

      setStep("③ SHA-256 해시 계산 및 ECDSA 전자서명 생성 중…");
      const identity = await loadOrCreateIdentity();
      const signature = await signHashes(identity.privateKey, pkg.cipherHash, pkg.plainHash);

      setStep("② OTP 수신용 ECDH 키쌍 생성 중…");
      const notify = await generateNotifyKeyPair();

      setStep("암호문만 서버로 업로드 중… (키는 전송되지 않음)");
      const form = new FormData();
      form.append("ciphertext", new Blob([pkg.ciphertext]));
      form.append("iv", new Blob([pkg.iv]));
      form.append("metaIv", new Blob([pkg.metaIv]));
      form.append("metaCiphertext", new Blob([pkg.metaCiphertext]));
      form.append("plainHash", pkg.plainHash);
      form.append("cipherHash", pkg.cipherHash);
      form.append("signature", signature);
      form.append("signerPublicKey", identity.publicKeyB64);
      form.append("notifyPublicKey", notify.publicKeyB64);
      form.append("ttlMinutes", String(ttl));

      const res = await fetch("/api/files", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");

      const origin = window.location.origin;
      // 키·지문·관리토큰은 모두 # 뒤(fragment)에 둔다 → 브라우저가 서버로 보내지 않음
      setResult({
        shareUrl: `${origin}/d/${data.id}#k=${pkg.keyB64}&f=${identity.fingerprint}`,
        manageUrl: `${origin}/m/${data.id}#t=${data.manageToken}&n=${notify.privateKeyB64}`,
        expiresAt: data.expiresAt,
        fingerprint: identity.fingerprint,
      });
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStep(null);
    }
  }

  if (result) {
    return (
      <Card title="✅ 암호화 업로드 완료">
        <div className="space-y-5">
          <CopyField
            label="① 수신자에게 보낼 공유 링크"
            value={result.shareUrl}
            hint="# 뒤에 복호화 키가 들어 있습니다. 이 부분은 서버로 전송되지 않습니다."
          />
          <CopyField
            label="② 송신자 전용 관리 링크 (절대 공유 금지)"
            value={result.manageUrl}
            hint="수신자가 OTP를 요청하면 이 페이지에 OTP가 표시됩니다. 카카오톡·전화 등 다른 경로로 수신자에게 알려 주세요."
          />
          <div className="bg-bg rounded-lg p-4 text-sm">
            <div>만료: {new Date(result.expiresAt).toLocaleString("ko-KR")}</div>
            <div className="mt-1">
              서명 키 지문: <span className="font-mono">{prettyFingerprint(result.fingerprint)}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={result.manageUrl} target="_blank" rel="noreferrer">
              <Button>관리 페이지 열기</Button>
            </a>
            <Button variant="ghost" onClick={() => setResult(null)}>
              다른 파일 보내기
            </Button>
          </div>
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
          <input
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            data-testid="file-input"
          />
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
        {step && <div className="bg-accent/10 text-accent rounded-lg px-4 py-3 text-sm">{step}</div>}

        <Button className="w-full" disabled={!file || !!step} onClick={upload}>
          암호화하고 업로드
        </Button>

        {fingerprint && (
          <p className="text-muted text-xs">
            내 서명 키 지문: <span className="font-mono">{prettyFingerprint(fingerprint)}</span>{" "}
            <button
              type="button"
              className="underline"
              onClick={async () => {
                resetIdentity();
                setFingerprint((await loadOrCreateIdentity()).fingerprint);
              }}
            >
              새 키 생성
            </button>
          </p>
        )}
      </div>
    </Card>
  );
}
