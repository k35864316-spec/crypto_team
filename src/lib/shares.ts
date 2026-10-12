import "server-only";
import { RECEIPT_RETENTION_HOURS, type ShareStatus } from "./config";
import { ID_PATTERN } from "./encoding";
import { getDb, type ShareDoc } from "./mongodb";

export const jsonError = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  Response.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const isValidId = (id: string) => ID_PATTERN.test(id);

/**
 * ③ 완전 파기: 암호문 문서를 삭제하고 공유 상태를 종료로 바꾼다.
 * 공유 기록은 송신자 영수증용으로 RECEIPT_RETENTION_HOURS 동안만 남고 TTL로 삭제된다.
 */
export async function destroyShare(id: string, status: Exclude<ShareStatus, "active">, onlyIfActive = true) {
  const { files, shares } = await getDb();
  const now = new Date();
  await files.deleteOne({ _id: id });
  await shares.updateOne(onlyIfActive ? { _id: id, status: "active" } : { _id: id }, {
    $set: {
      status,
      otp: null,
      finishedAt: now,
      purgeAt: new Date(now.getTime() + RECEIPT_RETENTION_HOURS * 3600_000),
    },
  });
}

/** 공유 기록을 읽고, 만료 시각이 지났으면 즉시 파기 처리한다 (TTL 모니터 주기(60초)를 기다리지 않음). */
export async function loadShare(id: string): Promise<ShareDoc | null> {
  const { shares } = await getDb();
  const share = await shares.findOne({ _id: id });
  if (share && share.status === "active" && share.expiresAt.getTime() <= Date.now()) {
    await destroyShare(id, "expired");
    return { ...share, status: "expired", otp: null };
  }
  return share;
}
