"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ShareStatus } from "@/lib/config";

export function Card({
  title,
  children,
  className = "",
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-line bg-panel rounded-2xl border p-6 shadow-sm ${className}`}>
      {title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-accent text-white hover:brightness-110",
    ghost: "border border-line bg-transparent hover:bg-line/40",
    danger: "bg-danger text-white hover:brightness-110",
  }[variant];
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          className="border-line bg-bg min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-xs"
        />
        <Button
          variant="ghost"
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "복사됨" : "복사"}
        </Button>
      </div>
      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  );
}

const STATUS_LABEL: Record<ShareStatus, { text: string; cls: string }> = {
  active: { text: "대기 중", cls: "bg-ok/15 text-ok" },
  downloaded: { text: "다운로드 완료 · 파기됨", cls: "bg-accent/15 text-accent" },
  destroyed: { text: "송신자가 파기함", cls: "bg-muted/20 text-muted" },
  locked: { text: "OTP 실패 초과 · 잠금/파기", cls: "bg-danger/15 text-danger" },
  expired: { text: "만료 · 파기됨", cls: "bg-muted/20 text-muted" },
};

export function StatusBadge({ status }: { status: ShareStatus }) {
  const s = STATUS_LABEL[status];
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>{s.text}</span>;
}

export function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return 0;
  return Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
}

export function formatSeconds(s: number) {
  if (s >= 3600) return `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail?: ReactNode }) {
  const icon = ok === null ? "…" : ok ? "✓" : "✕";
  const cls = ok === null ? "text-muted" : ok ? "text-ok" : "text-danger";
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 font-bold ${cls}`}>{icon}</span>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {detail && <div className="text-muted text-xs break-all">{detail}</div>}
      </div>
    </li>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="border-danger/40 bg-danger/10 text-danger rounded-lg border px-4 py-3 text-sm">{children}</div>
  );
}
