const STEPS = [
  {
    step: "STEP 01 · 송신자 업로드",
    items: [
      "브라우저가 AES-256-GCM 키(256비트)와 IV(96비트)를 생성해 파일과 파일명을 암호화",
      "원본 SHA-256 해시 + 암호문 해시를 ECDSA P-256 개인키로 서명",
      "OTP 수신용 ECDH P-256 키쌍 생성 (개인키는 관리 링크 # 뒤에만 존재)",
      "서버에는 암호문·서명·공개키만 전송 → MongoDB에 저장 (TTL 인덱스로 만료 자동 삭제)",
    ],
  },
  {
    step: "STEP 02 · 수신자 OTP 검증",
    items: [
      "수신자가 OTP 요청 → 서버가 CSPRNG로 6자리 코드 생성",
      "DB에는 HMAC-SHA256(pepper, id:code)만 저장, 평문은 송신자 공개키로 ECIES 봉인",
      "송신자 관리 페이지가 봉인을 풀어 코드 표시 → 별도 경로(카톡·전화)로 전달",
      "3분 유효, 상수 시간 비교, 누적 5회 실패 시 잠금 및 파기, 발급 5회·30초 쿨다운",
    ],
  },
  {
    step: "STEP 03 · 다운로드 및 파기",
    items: [
      "OTP 소비와 상태 변경을 원자적 findOneAndUpdate로 처리 → 단 한 세션만 성공",
      "암호문 문서를 findOneAndDelete로 삭제한 뒤 응답 → 서버에 잔존하지 않음",
      "수신자 브라우저가 지문·암호문 해시·서명·GCM 태그·원본 해시를 모두 검증 후 저장",
    ],
  },
];

const THREATS = [
  ["서버 관리자/DB 탈취", "암호문만 존재, 키는 URL fragment로만 전달 → 해독 불가"],
  ["링크 유출", "OTP 없이는 다운로드 불가, OTP는 송신자만 열람 가능"],
  ["OTP 무차별 대입", "실패 5회 시 잠금+파기, OTP 3분 만료, 발급 횟수·쿨다운 제한"],
  ["재전송(Replay) 공격", "OTP 1회용 + 원자적 소비, 파일도 1회 전송 후 삭제"],
  ["암호문 변조 / 키 바꿔치기", "링크에 공개키 지문 포함 → 서버가 서명·공개키를 바꿔도 탐지"],
  ["방치된 파일", "MongoDB TTL 인덱스 + 접근 시 만료 검사로 자동 파기"],
];

export default function AboutPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">보안 구조</h1>
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
