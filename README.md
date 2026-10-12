# 🔐 OneTimeShare — OTP 인증 시스템이 결합된 일회용 암호화 파일 공유 서비스

팀 **열렸조** (김명준 · 김용현 · 박민지) 암호학 프로젝트 구현체입니다.
**TypeScript + Next.js 16 (App Router) + MongoDB**로 만들었습니다.

| 기능 | 구현 |
| --- | --- |
| ① 클라이언트 측 암호화 | 브라우저 Web Crypto API로 **AES-256-GCM** 암호화. 키는 URL `#fragment`로만 전달 → 서버는 키를 모름 (Zero-Knowledge) |
| ② OTP 동적 인증 | 6자리 CSPRNG OTP, **3분 유효**, HMAC 해시만 저장, 누적 5회 실패 시 잠금+파기, 발급 5회·30초 쿨다운, 원자적 1회 소비(재사용 방지) |
| ③ 일회성 저장·완전 파기 | 다운로드 성공 즉시 MongoDB에서 암호문 삭제, 만료 시 **TTL 인덱스**로 자동 삭제 |
| 전자서명·무결성 | **SHA-256** 해시 + **ECDSA P-256** 서명, 링크에 공개키 지문 포함 → 서버의 서명/키 바꿔치기도 탐지 |

자세한 작업 과정은 [`작업_과정_설명서.md`](./작업_과정_설명서.md)에 정리했습니다.

## 빠른 시작

필요한 것: **Node.js 20.9+**, **Docker Desktop** (또는 MongoDB 서버/Atlas), **VS Code**

```bash
# 1) 한 번에 준비 (npm install + .env.local 생성 + VS Code 확장 설치 + MongoDB 컨테이너 실행)
npm run setup        # 또는: node scripts/setup.mjs

# 2) 개발 서버
npm run dev          # → http://localhost:3000
```

직접 하고 싶다면:

```bash
npm install
cp .env.example .env.local      # OTP_PEPPER를 32자 이상 랜덤 값으로 변경
docker compose up -d            # MongoDB 7 (localhost:27017)
npm run dev
```

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run check` | 타입 검사 + ESLint |
| `npm run format` | Prettier 포맷 |
| `npm run db:up` / `db:down` | MongoDB 컨테이너 시작 / 종료 |

## 사용 흐름

1. **송신자**: 메인 화면에서 파일 선택 → `암호화하고 업로드` → **공유 링크**(수신자용)와 **관리 링크**(송신자 전용)를 받음
2. **수신자**: 공유 링크 접속 → `OTP 요청`
3. **송신자**: 관리 페이지에 표시된 6자리 OTP를 카카오톡·전화 등 별도 경로로 전달
4. **수신자**: OTP 입력 → 암호문 1회 전송 → 브라우저에서 서명·해시 검증 후 복호화·저장 → **서버 데이터 즉시 파기**

## 폴더 구조

```
src/
├─ app/
│  ├─ page.tsx                 # 메인(업로드)
│  ├─ d/[id]/page.tsx          # 수신자 다운로드
│  ├─ m/[id]/page.tsx          # 송신자 관리(OTP 확인·즉시 파기)
│  ├─ about/page.tsx           # 보안 구조 설명
│  └─ api/files/...            # Route Handlers (업로드·상태·OTP·다운로드·관리)
├─ components/                 # UploadForm, DownloadView, ManageView, ui
└─ lib/
   ├─ client-crypto.ts         # 브라우저 암호 (AES-GCM, ECDSA, ECDH)
   ├─ server-crypto.ts         # 서버 암호 (OTP, HMAC, ECIES 봉인)
   ├─ mongodb.ts               # MongoDB 연결·스키마·TTL 인덱스
   ├─ shares.ts                # 파기/만료 처리 공통 로직
   ├─ encoding.ts, config.ts
```

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/api/files` | 암호문·서명·공개키 업로드 → `{ id, manageToken, expiresAt }` |
| GET | `/api/files/:id` | 공개 상태 조회 |
| POST | `/api/files/:id/otp` | OTP 발급 (송신자 공개키로 봉인 저장) |
| POST | `/api/files/:id/download` | `{ otp }` 검증 → 암호문 1회 반환 후 파기 |
| GET/DELETE | `/api/files/:id/manage` | (Bearer 관리 토큰) 상태·봉인된 OTP 조회 / 즉시 파기 |
