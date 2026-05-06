import { useState } from "react";
import { useLocation } from "wouter";
import { registerUser } from "@/lib/api";

export default function Welcome() {
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Введи имя и email");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await registerUser({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      localStorage.setItem("pf_user", JSON.stringify(data.user));
      if (data.quizResult) {
        localStorage.setItem("pf_quiz", JSON.stringify(data.quizResult));
        setLocation("/result");
      } else {
        setLocation("/quiz");
      }
    } catch {
      setError("Ошибка регистрации. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0A84FF]/10 border border-[#0A84FF]/20 mb-6">
            <span className="text-3xl">🏸</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Padel Future</h1>
          <p className="text-[#8a8a8a] text-base leading-relaxed">
            Найди свой уровень.<br />Найди свою игру.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#8a8a8a] uppercase tracking-widest mb-2">Имя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как тебя зовут?"
              className="w-full h-14 px-4 bg-[#161616] border border-[#2a2a2a] rounded-xl text-white placeholder-[#555] focus:outline-none focus:border-[#0A84FF] transition-colors text-base"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8a8a8a] uppercase tracking-widest mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="твой@email.com"
              className="w-full h-14 px-4 bg-[#161616] border border-[#2a2a2a] rounded-xl text-white placeholder-[#555] focus:outline-none focus:border-[#0A84FF] transition-colors text-base"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8a8a8a] uppercase tracking-widest mb-2">
              Телефон <span className="text-[#555] normal-case font-normal">(необязательно)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+971 50 000 0000"
              className="w-full h-14 px-4 bg-[#161616] border border-[#2a2a2a] rounded-xl text-white placeholder-[#555] focus:outline-none focus:border-[#0A84FF] transition-colors text-base"
              autoComplete="tel"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-[#0A84FF] hover:bg-[#0A84FF]/90 active:bg-[#0A84FF]/80 text-white font-semibold text-base rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="animate-spin text-xl">⟳</span>
            ) : (
              <>Начать <span>→</span></>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-[#555] text-xs leading-relaxed">
          Займёт ~2 минуты. Никакого спама.
        </p>
      </div>
    </div>
  );
}
