import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "열렸조 · 일회용 암호화 파일 공유",
  description: "OTP 인증 시스템이 결합된 일회용 암호화 파일 공유 서비스",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-line bg-panel border-b">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
            <Link href="/" className="font-semibold">
              🔐 OneTime<span className="text-accent">Share</span>
            </Link>
            <Link href="/about" className="text-muted hover:text-fg text-sm">
              보안 구조
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
        <footer className="border-line text-muted border-t py-6 text-center text-xs">
          팀 열렸조 · 김명준 · 김용현 · 박민지 — 암호학 프로젝트
        </footer>
      </body>
    </html>
  );
}
