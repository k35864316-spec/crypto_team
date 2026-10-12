// 서비스 전반에서 공유하는 보안 정책 상수
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const OTP_TTL_SECONDS = 180; // OTP 유효시간 3분
export const OTP_COOLDOWN_SECONDS = 30; // OTP 재발급 최소 간격
export const MAX_OTP_ISSUES = 5; // 파일 하나당 OTP 최대 발급 횟수
export const MAX_FAILED_ATTEMPTS = 5; // 누적 실패 허용 횟수 (초과 시 잠금 + 파기)
export const TTL_OPTIONS_MINUTES = [10, 60, 60 * 24] as const; // 업로드 시 선택 가능한 보관 시간

export type ShareStatus = "active" | "downloaded" | "destroyed" | "locked" | "expired";
