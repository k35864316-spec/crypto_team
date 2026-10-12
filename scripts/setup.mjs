// 한 번에 개발 환경 준비: npm install → .env.local 생성 → VS Code 확장 설치 → MongoDB 컨테이너 실행
// 실행: node scripts/setup.mjs   (Windows / macOS / Linux 공통)
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const run = (cmd, { optional = false } = {}) => {
  console.log(`\n$ ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", shell: true });
    return true;
  } catch {
    if (!optional) throw new Error(`실패: ${cmd}`);
    console.warn(`  ⚠ 건너뜀 (선택 단계): ${cmd}`);
    return false;
  }
};

// 1) 의존성 설치
run("npm install");

// 2) 환경변수 파일
if (!existsSync(".env.local")) {
  const env = readFileSync(".env.example", "utf8").replace(
    /^OTP_PEPPER=.*$/m,
    `OTP_PEPPER=${randomBytes(32).toString("hex")}`,
  );
  writeFileSync(".env.local", env);
  console.log("\n✓ .env.local 생성 (OTP_PEPPER 랜덤 생성)");
} else {
  console.log("\n✓ .env.local 이미 존재 — 유지");
}

// 3) VS Code 확장 (code CLI가 PATH에 있을 때만)
const { recommendations } = JSON.parse(readFileSync(".vscode/extensions.json", "utf8"));
for (const ext of recommendations) run(`code --install-extension ${ext} --force`, { optional: true });

// 4) MongoDB (Docker가 있을 때만)
if (!run("docker compose up -d", { optional: true })) {
  console.log("  → Docker가 없다면 MongoDB Community Server를 설치하거나 MongoDB Atlas URI를 .env.local에 넣으세요.");
}

console.log("\n🎉 준비 완료! `npm run dev` 후 http://localhost:3000 을 여세요.");
