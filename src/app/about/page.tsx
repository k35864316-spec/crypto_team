const STEPS = [
  {
    step: "STEP 01 · 송신자 업로드",
    items: [
      "브라우저에서 AES-256-GCM 키를 생성해 파일을 암호화 (팀원 A)",
      "파일 SHA-256 해시를 계산하고 송신자 전자서명 생성 (팀원 C)",
      "서버에는 암호문과 서명만 전송, 복호화 키는 링크의 # 뒤에만 포함",
    ],
  },
  {
    step: "STEP 02 · 수신자 OTP 검증",
    items: [
      "수신자가 OTP를 요청하면 6자리 일회용 코드 발급 (팀원 B)",
      "OTP는 해시로만 저장, 유효시간 3분",
      "시도 횟수 제한(실패 시 잠금), 재사용 방지",
    ],
  },
  {
    step: "STEP 03 · 다운로드 및 파기",
    items: [
      "인증된 단 하나의 세션에만 암호문 전송 후 서버에서 즉시 삭제",
      "수신자 브라우저에서 복호화하고 해시·서명 검증, 위변조 시 경고 (팀원 C)",
      "제한시간이 지나면 자동 파기",
    ],
  },
];

const THREATS = [
  ["서버 관리자의 열람", "서버에는 암호문만 존재, 키는 URL fragment로만 전달"],
  ["링크 유출", "별도 경로로 전달된 OTP 없이는 다운로드 불가"],
  ["OTP 무차별 대입", "실패 횟수 제한 후 잠금, OTP 3분 만료"],
  ["재전송(Replay) 공격", "OTP 1회용, 파일도 1회 전송 후 삭제"],
  ["암호문 변조", "SHA-256 해시와 전자서명 검증으로 탐지"],
  ["방치된 파일", "보관 시간 경과 시 자동 파기"],
];

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">보안 구조 (설계)</h1>
      <div className="space-y-4">
        {STEPS.map((s) => (
          <section key={s.step} className="border-line bg-panel rounded-2xl border p-6">
            <h2 className="text-accent mb-3 font-semibold">{s.step}</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <section className="border-line bg-panel rounded-2xl border p-6">
        <h2 className="mb-3 font-semibold">위협 모델과 대응</h2>
        <table className="w-full text-left text-sm">
          <tbody>
            {THREATS.map(([t, d]) => (
              <tr key={t} className="border-line border-t align-top">
                <td className="py-2 pr-4 font-medium whitespace-nowrap">{t}</td>
                <td className="text-muted py-2">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
