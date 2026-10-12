// 화면(UI)이 호출하는 기능 인터페이스.
// 암호화·OTP·전자서명·저장소 기능은 아직 구현되지 않았으며, 각 담당자가 아래 함수를 채운다.
// 구현 전에는 NotImplementedError를 던지고, 화면은 이를 "미구현" 안내로 표시한다.

import type { ShareStatus } from "./config";

export class NotImplementedError extends Error {
  constructor(
    public readonly feature: string,
    public readonly owner: string,
  ) {
    super(`아직 구현되지 않은 기능입니다: ${feature} (담당: ${owner})`);
    this.name = "NotImplementedError";
  }
}

/* ───────── 업로드 (송신자) ───────── */

export interface UploadResult {
  shareUrl: string; // 수신자에게 보낼 공유 링크
  manageUrl: string; // 송신자 전용 관리 링크
  expiresAt: string; // ISO 시각
}

/**
 * 파일을 암호화·서명한 뒤 서버에 업로드하고 공유 링크를 돌려준다.
 * TODO(팀원 A · 파일 암호화): 브라우저 키 생성, 파일 암호화, 링크 # 키 구조
 * TODO(팀원 C · 전자서명): 파일 해시 계산, 송신자 서명 생성
 */
export async function uploadFile(file: File, ttlMinutes: number): Promise<UploadResult> {
  void file;
  void ttlMinutes;
  throw new NotImplementedError("파일 암호화 및 업로드", "팀원 A · 팀원 C");
}

/* ───────── 다운로드 (수신자) ───────── */

export interface ShareInfo {
  status: ShareStatus;
  size: number;
  expiresAt: string;
  otpPending: boolean;
  otpExpiresAt: string | null;
  otpIssuesLeft: number;
  attemptsLeft: number;
}

/** 공유 상태 조회. TODO(팀원 A): 서버 저장소 연동 */
export async function getShareInfo(id: string): Promise<ShareInfo> {
  void id;
  throw new NotImplementedError("공유 상태 조회", "팀원 A");
}

/** OTP 발급 요청. TODO(팀원 B · OTP): OTP 발급, 시도 횟수 제한, 토큰 해시 저장 */
export async function requestOtp(id: string): Promise<{ expiresAt: string }> {
  void id;
  throw new NotImplementedError("OTP 발급", "팀원 B");
}

export interface VerificationResult {
  checks: { label: string; ok: boolean; detail?: string }[];
  fileName: string;
  fileSize: number;
}

/**
 * OTP 검증 → 파일 1회 다운로드 → 복호화 → 무결성·서명 검증 후 저장.
 * TODO(팀원 B · OTP): OTP 검증, 재사용 방지
 * TODO(팀원 A · 파일 암호화): 복호화
 * TODO(팀원 C · 전자서명): 해시·서명 검증, 위변조 경고
 */
export async function downloadWithOtp(id: string, otp: string): Promise<VerificationResult> {
  void id;
  void otp;
  throw new NotImplementedError("OTP 인증 후 다운로드", "팀원 A · 팀원 B · 팀원 C");
}

/* ───────── 관리 (송신자) ───────── */

export interface ManageInfo {
  status: ShareStatus;
  size: number;
  createdAt: string;
  expiresAt: string;
  otp: { code: string; expiresAt: string } | null;
}

/** 송신자 관리 화면 정보 (수신자 OTP 포함). TODO(팀원 B): 송신자에게 OTP 전달 */
export async function getManageInfo(id: string): Promise<ManageInfo> {
  void id;
  throw new NotImplementedError("송신자 관리 정보 조회", "팀원 B");
}

/** 송신자가 즉시 파기. TODO(팀원 A): 저장소에서 완전 파기 */
export async function destroyShare(id: string): Promise<void> {
  void id;
  throw new NotImplementedError("즉시 파기", "팀원 A");
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
