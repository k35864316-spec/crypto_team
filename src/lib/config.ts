// 서비스 전반에서 공유하는 보안 정책 상수
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB (MongoDB 문서 16MB 제한 고려)
export const OTP_TTL_SECONDS = 180; // OTP 유효시간 3분
export const OTP_COOLDOWN_SECONDS = 30; // OTP 재발급 최소 간격
export const MAX_OTP_ISSUES = 5; // 파일 하나당 OTP 최대 발급 횟수
export const MAX_FAILED_ATTEMPTS = 5; // 누적 실패 허용 횟수 (초과 시 잠금 + 파기)
export const TTL_OPTIONS_MINUTES = [10, 60, 60 * 24] as const; // 업로드 시 선택 가능한 보관 시간
export const RECEIPT_RETENTION_HOURS = 24; // 파기 후 송신자에게 상태를 보여주기 위해 메타데이터를 남기는 시간

export type ShareStatus = "active" | "downloaded" | "destroyed" | "locked" | "expired";
