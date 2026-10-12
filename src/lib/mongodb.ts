import "server-only";
import { Binary, MongoClient, type Db } from "mongodb";
import type { ShareStatus } from "./config";

/** 암호문 본문만 담는 컬렉션. expiresAt TTL 인덱스로 만료 시 MongoDB가 자동 삭제한다. */
export interface FileDoc {
  _id: string;
  ciphertext: Binary; // AES-256-GCM 암호문 (태그 포함)
  iv: Binary; // 파일 본문 IV (12바이트)
  metaIv: Binary; // 파일명/타입 메타데이터 IV
  metaCiphertext: Binary; // 암호화된 메타데이터
  expiresAt: Date;
}

export interface PendingOtp {
  hash: string; // HMAC-SHA256(pepper, id:code) — 평문 OTP는 저장하지 않는다
  expiresAt: Date;
  used: boolean;
  // 송신자 공개키(ECDH)로 암호화한 OTP. 송신자 브라우저만 복호화할 수 있다.
  sealed: { epk: string; iv: string; ct: string };
}

/** 공유 상태/서명/OTP 정보를 담는 컬렉션. 파일이 파기된 뒤에도 송신자 영수증용으로 잠시 남는다. */
export interface ShareDoc {
  _id: string;
  status: ShareStatus;
  manageTokenHash: string; // SHA-256(관리 토큰)
  notifyPublicKey: string; // 송신자 ECDH P-256 공개키 (raw, base64url)
  signerPublicKey: string; // 송신자 ECDSA P-256 공개키 (raw, base64url)
  signature: string; // ECDSA 서명 (base64url)
  plainHash: string; // SHA-256(원본 파일) hex
  cipherHash: string; // SHA-256(iv || ciphertext || metaIv || metaCiphertext) hex
  size: number; // 암호문 크기 (바이트)
  createdAt: Date;
  expiresAt: Date;
  purgeAt: Date; // TTL — 이 시각이 지나면 공유 기록 자체도 삭제
  otp: PendingOtp | null;
  otpIssueCount: number;
  lastOtpAt: Date | null;
  failedAttempts: number;
  finishedAt: Date | null;
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "crypto_team";

// 개발 모드의 HMR 때마다 커넥션이 새로 생기지 않도록 전역에 캐시한다.
const globalForMongo = globalThis as unknown as {
  _mongoClient?: Promise<MongoClient>;
  _mongoIndexes?: Promise<void>;
};

function getClient(): Promise<MongoClient> {
  if (!uri) throw new Error("MONGODB_URI 환경변수가 설정되지 않았습니다. .env.local을 확인하세요.");
  globalForMongo._mongoClient ??= new MongoClient(uri).connect().catch((e) => {
    globalForMongo._mongoClient = undefined;
    throw e;
  });
  return globalForMongo._mongoClient;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection<FileDoc>("files").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection<ShareDoc>("shares").createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

export async function getDb() {
  const db = (await getClient()).db(dbName);
  // 인덱스 생성이 실패하면 캐시를 비워 다음 요청에서 다시 시도한다.
  globalForMongo._mongoIndexes ??= ensureIndexes(db).catch((e) => {
    globalForMongo._mongoIndexes = undefined;
    throw e;
  });
  await globalForMongo._mongoIndexes;
  return {
    files: db.collection<FileDoc>("files"),
    shares: db.collection<ShareDoc>("shares"),
  };
}
