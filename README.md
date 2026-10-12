# 🔐 OneTimeShare — OTP 인증 시스템이 결합된 일회용 암호화 파일 공유 서비스

팀 **열렸조** (김명준 · 김용현 · 박민지) 암호학 프로젝트의 **Next.js + TypeScript 화면 골격**입니다.

> 지금은 **화면(UI)만 있고**, 암호화·OTP·전자서명·데이터 저장 기능은 구현되어 있지 않습니다.
> 화면은 `src/lib/service.ts`의 함수를 호출하며, 각 담당자가 이 함수들을 채우면 됩니다.
> 미구현 함수를 누르면 화면에 "아직 구현되지 않은 기능입니다 (담당: …)"라고 표시됩니다.

자세한 작업 내역은 [`작업_과정_설명서.md`](./작업_과정_설명서.md)를 보세요.

## 빠른 시작

필요한 것: **Node.js 20.9 이상**, **VS Code**

```bash
npm run setup     # npm install + VS Code 추천 확장 설치
npm run dev       # → http://localhost:3000
```

## 담당자별 구현할 함수 (`src/lib/service.ts`)

| 함수 | 화면 | 담당 |
| --- | --- | --- |
| `uploadFile(file, ttlMinutes)` | 메인 `/` | 팀원 A (파일 암호화) · 팀원 C (서명) |
| `getShareInfo(id)` | 수신 `/d/[id]` | 팀원 A |
| `requestOtp(id)` | 수신 `/d/[id]` | 팀원 B (OTP) |
| `downloadWithOtp(id, otp)` | 수신 `/d/[id]` | 팀원 A · B · C |
| `getManageInfo(id)` | 관리 `/m/[id]` | 팀원 B |
| `destroyShare(id)` | 관리 `/m/[id]` | 팀원 A |

함수가 돌려줘야 할 값의 타입(`UploadResult`, `ShareInfo`, `VerificationResult`, `ManageInfo`)도 같은 파일에 정의되어 있습니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run check` | 타입 검사 + ESLint |
| `npm run format` | Prettier 포맷 |
| `npm run setup` | 패키지 + VS Code 확장 설치 |

## 폴더 구조

```
src/
├─ app/
│  ├─ page.tsx           # 메인(업로드)
│  ├─ d/[id]/page.tsx    # 수신자 다운로드
│  ├─ m/[id]/page.tsx    # 송신자 관리
│  └─ about/page.tsx     # 보안 구조(설계)
├─ components/           # UploadForm, DownloadView, ManageView, ui
└─ lib/
   ├─ service.ts         # ← 담당자가 구현할 기능 인터페이스
   └─ config.ts          # 정책 상수 (최대 크기, OTP 3분 등)
.vscode/                 # VS Code 설정 (확장, 포맷, 디버그, 작업, 스니펫)
.devcontainer/           # Dev Container 설정
```
