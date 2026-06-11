import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/api";

// Stage 1 onboarding — Welcome questionnaire. Collects the personal-profile
// fields that registration does NOT already capture (gender, age, experience,
// limitations, communication style). Level + goal come from registration and
// are intentionally not re-asked here. Saves to POST /onboarding/welcome, then
// hands off to the skill assessment.

const TOTAL_STEPS = 6; // 5 questions + summary

type Single = string | undefined;

const GENDER_OPTS = ["female", "male", "other", "prefer_not"] as const;
const AGE_OPTS = ["18-25", "26-35", "36-45", "46-55", "55+"] as const;
// value = what we store; k = safe i18n key suffix (avoids special chars in keys)
const EXP_OPTS: { value: string; k: string }[] = [
  { value: "<6m", k: "u6" },
  { value: "6-12m", k: "m6_12" },
  { value: "1-3y", k: "y1_3" },
  { value: "3-5y", k: "y3_5" },
  { value: "5+", k: "y5p" },
];
const expLabel = (t: (k: string) => string, value?: string) => {
  const o = EXP_OPTS.find((e) => e.value === value);
  return o ? t(`welcome.exp.${o.k}`) : "—";
};
const LIMIT_OPTS = ["none", "back", "knees", "shoulder", "unsure"] as const;
const COMM_OPTS = ["direct", "supportive", "analytical", "motivating", "unsure"] as const;

function GoldProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${(step / TOTAL_STEPS) * 100}%`, background: "linear-gradient(90deg, #D4AF37, #f0d060)" }}
      />
    </div>
  );
}

export default function Welcome() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [gender, setGender] = useState<Single>();
  const [ageRange, setAgeRange] = useState<Single>();
  const [experienceYears, setExperienceYears] = useState<Single>();
  const [limitations, setLimitations] = useState<string[]>([]);
  const [communicationStyle, setCommunicationStyle] = useState<Single>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickSingle(setter: (v: string) => void, value: string) {
    setter(value);
    setStep((s) => s + 1);
  }

  function toggleLimitation(value: string) {
    setLimitations((prev) => {
      if (value === "none") return ["none"];
      const without = prev.filter((v) => v !== "none");
      return without.includes(value) ? without.filter((v) => v !== value) : [...without, value];
    });
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/onboarding/welcome", {
        method: "POST",
        body: JSON.stringify({ gender, ageRange, experienceYears, limitations, communicationStyle }),
      });
      setLocation("/assessment");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  const optionButton = (active: boolean, label: string, onClick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl px-4 py-3 mb-2 transition-all"
      style={{
        background: active ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? "#D4AF37" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#f0d060" : "rgba(255,255,255,0.85)",
      }}
    >
      {label}
    </button>
  );

  function renderQuestion() {
    switch (step) {
      case 1:
        return (
          <Question title={t("welcome.qGender")}>
            {GENDER_OPTS.map((o) =>
              optionButton(gender === o, t(`welcome.gender.${o}`), () => pickSingle(setGender, o), o),
            )}
          </Question>
        );
      case 2:
        return (
          <Question title={t("welcome.qAge")}>
            {AGE_OPTS.map((o) =>
              optionButton(ageRange === o, o, () => pickSingle(setAgeRange, o), o),
            )}
          </Question>
        );
      case 3:
        return (
          <Question title={t("welcome.qExperience")}>
            {EXP_OPTS.map((o) =>
              optionButton(experienceYears === o.value, t(`welcome.exp.${o.k}`), () => pickSingle(setExperienceYears, o.value), o.value),
            )}
          </Question>
        );
      case 4:
        return (
          <Question title={t("welcome.qLimitations")} subtitle={t("welcome.multiHint")}>
            {LIMIT_OPTS.map((o) =>
              optionButton(limitations.includes(o), t(`welcome.limit.${o}`), () => toggleLimitation(o), o),
            )}
            <button
              type="button"
              disabled={limitations.length === 0}
              onClick={() => setStep(5)}
              className="w-full rounded-xl px-4 py-3 mt-3 font-semibold transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(90deg, #D4AF37, #f0d060)", color: "#1a1a1a" }}
            >
              {t("welcome.next")}
            </button>
          </Question>
        );
      case 5:
        return (
          <Question title={t("welcome.qComm")}>
            {COMM_OPTS.map((o) =>
              optionButton(communicationStyle === o, t(`welcome.comm.${o}`), () => pickSingle(setCommunicationStyle, o), o),
            )}
          </Question>
        );
      default:
        return (
          <Question title={t("welcome.summaryTitle")} subtitle={t("welcome.summarySubtitle")}>
            <SummaryRow label={t("welcome.qGender")} value={gender ? t(`welcome.gender.${gender}`) : "—"} />
            <SummaryRow label={t("welcome.qAge")} value={ageRange ?? "—"} />
            <SummaryRow label={t("welcome.qExperience")} value={expLabel(t, experienceYears)} />
            <SummaryRow
              label={t("welcome.qLimitations")}
              value={limitations.length ? limitations.map((l) => t(`welcome.limit.${l}`)).join(", ") : "—"}
            />
            <SummaryRow label={t("welcome.qComm")} value={communicationStyle ? t(`welcome.comm.${communicationStyle}`) : "—"} />
            {error && <p className="text-sm mt-3" style={{ color: "#ff6b6b" }}>{error}</p>}
            <button
              type="button"
              disabled={saving}
              onClick={finish}
              className="w-full rounded-xl px-4 py-3 mt-4 font-semibold transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(90deg, #D4AF37, #f0d060)", color: "#1a1a1a" }}
            >
              {saving ? t("welcome.saving") : t("welcome.finish")}
            </button>
          </Question>
        );
    }
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 max-w-md mx-auto w-full">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#D4AF37" }}>
          {t("welcome.title")}
        </p>
        <GoldProgressBar step={step} />
        <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
          {step <= 5 ? `${step} / 5` : t("welcome.summaryStep")}
        </p>
      </div>

      <div className="flex-1">{renderQuestion()}</div>

      {step > 1 && step <= 5 && (
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className="mt-4 text-sm self-start"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          ← {t("welcome.back")}
        </button>
      )}
    </div>
  );
}

function Question({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-bold mb-1" style={{ color: "#fff" }}>{title}</h1>
      {subtitle && <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: "#f0d060" }}>{value}</span>
    </div>
  );
}
