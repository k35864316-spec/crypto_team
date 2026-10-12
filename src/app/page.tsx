import UploadForm from "@/components/UploadForm";

const FEATURES = [
  {
    icon: "🧩",
    title: "클라이언트 측 암호화",
    desc: "브라우저에서 AES-256-GCM으로 암호화. 서버는 암호문만 보관합니다 (Zero-Knowledge).",
  },
  {
    icon: "🔑",
    title: "OTP 동적 인증",
    desc: "6자리 일회용 코드(3분), 시도 횟수 제한·재사용 방지로 링크가 유출돼도 안전합니다.",
  },
  {
    icon: "🔥",
    title: "1회 열람 후 완전 파기",
    desc: "다운로드 즉시, 또는 제한시간이 지나면 서버에서 영구 삭제됩니다.",
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <p className="text-accent text-xs font-semibold tracking-widest">CRYPTOGRAPHY · TEAM 열렸조</p>
        <h1 className="text-3xl leading-tight font-bold">
          OTP 인증 시스템이 결합된
          <br />
          일회용 암호화 파일 공유 서비스
        </h1>
        <p className="text-muted">회원가입·설치 없이, 서버조차 내용을 볼 수 없는 방식으로 파일을 전달하세요.</p>
      </div>

      <UploadForm />

      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="border-line bg-panel rounded-2xl border p-5">
            <div className="text-2xl">{f.icon}</div>
            <div className="mt-2 font-semibold">{f.title}</div>
            <p className="text-muted mt-1 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
