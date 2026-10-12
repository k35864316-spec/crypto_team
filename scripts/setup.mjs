// 개발 환경 한 번에 준비: npm install → VS Code 추천 확장 설치
// 실행: npm run setup  (Windows / macOS / Linux 공통)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const run = (cmd, { optional = false } = {}) => {
  console.log(`\n$ ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", shell: true });
    return true;
  } catch {
    if (!optional) throw new Error(`실패: ${cmd}`);
    console.warn(`  ⚠ 건너뜀: ${cmd}`);
    return false;
  }
};

// 1) 패키지 설치
run("npm install");

// 2) VS Code 추천 확장 설치 (code 명령이 PATH에 있을 때)
// extensions.json은 주석이 있는 JSONC라 주석을 지우고 파싱한다.
const jsonc = readFileSync(".vscode/extensions.json", "utf8").replace(/^\s*\/\/.*$/gm, "");
const { recommendations } = JSON.parse(jsonc);
let installed = 0;
for (const ext of recommendations) if (run(`code --install-extension ${ext}`, { optional: true })) installed++;
if (installed === 0) {
  console.log(
    "\n  → 'code' 명령을 찾지 못했습니다. VS Code에서 Ctrl+Shift+P → 'Shell Command: Install code command in PATH'",
  );
  console.log("    또는 VS Code로 폴더를 열고 오른쪽 아래 '권장 확장 설치' 알림에서 설치하세요.");
}

console.log("\n🎉 준비 완료! `npm run dev` 후 http://localhost:3000 을 여세요.");
