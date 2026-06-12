import { useState, useEffect, useRef } from "react";
import { useLocation, Link, Redirect } from "wouter";
import { useRegister, useUpdateUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { translateError, type Lang } from "@/lib/errorMessages";
import { triggerInstallPrompt } from "@/components/PWAInstallPrompt";

const LEVELS = [
  { value: 0, label: "1.0", desc: "Complete Beginner" },
  { value: 1, label: "1.5", desc: "Beginner" },
  { value: 2, label: "2.0", desc: "Novice" },
  { value: 3, label: "2.5", desc: "Developing" },
  { value: 4, label: "3.0", desc: "Intermediate" },
  { value: 5, label: "3.5", desc: "Upper Intermediate" },
  { value: 6, label: "4.0", desc: "Advanced" },
  { value: 7, label: "4.5", desc: "Elite Amateur" },
  { value: 8, label: "5.0", desc: "Professional" },
];

const GOAL_KEYS = ["Play", "Compete", "Improve", "Fitness"] as const;
const INTENSITY_KEYS = ["Casual", "Active-Dynamic", "Competitive", "Professional"] as const;

const AVAILABILITY_SLOTS = [
  { id: "morning_wd", key: "register.availability.morningWeekday" },
  { id: "afternoon_wd", key: "register.availability.afternoonWeekday" },
  { id: "evening_wd", key: "register.availability.eveningWeekday" },
  { id: "morning_we", key: "register.availability.morningWeekend" },
  { id: "afternoon_we", key: "register.availability.afternoonWeekend" },
  { id: "evening_we", key: "register.availability.eveningWeekend" },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const [step, setStep] = useState(1);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const [, setLocation] = useLocation();
  const { user, isLoading, login: authLogin } = useAuth();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const lang: Lang = language === "en" ? "en" : "ru";

  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [inlineError, setInlineError] = useState<{ field?: "email" | "password" | "confirm" | "form"; message: string } | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const [levelIdx, setLevelIdx] = useState(2);
  const [availability, setAvailability] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    level: "2.0",
    goal: "Play",
    intensity: "Active-Dynamic",
    locationName: "Dubai",
  });

  const update = (k: string, v: string) => {
    setFormData((p) => ({ ...p, [k]: v }));
    if (k === "email") {
      setEmailExists(false);
      if (inlineError?.field === "email") setInlineError(null);
    }
    if ((k === "password" || k === "confirmPassword") && inlineError?.field !== "form") {
      setInlineError(null);
    }
  };

  const toggleAvailability = (id: string) => {
    setAvailability((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const emailCheckAbort = useRef<AbortController | null>(null);
  const emailCheckValue = useRef<string>("");
  async function checkEmailAvailability(email: string) {
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) return;
    emailCheckAbort.current?.abort();
    const ctrl = new AbortController();
    emailCheckAbort.current = ctrl;
    emailCheckValue.current = trimmed;
    setCheckingEmail(true);
    try {
      const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal });
      if (!res.ok || emailCheckValue.current !== trimmed) return;
      const data = (await res.json()) as { available: boolean };
      if (emailCheckValue.current !== trimmed) return;
      setEmailExists(!data.available);
    } catch {
      // network/aborted — silent
    } finally {
      if (emailCheckAbort.current === ctrl) setCheckingEmail(false);
    }
  }

  const updateUserMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        setInlineError(null);
        // Stage 1 onboarding: new registrants go through the Welcome
        // questionnaire before the skill assessment.
        setLocation("/welcome");
      },
      onError: (err: unknown) => {
        const translated = translateError(err, lang);
        setInlineError({ field: "form", message: translated.message });
      },
    },
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data) => {
        setInlineError(null);
        toast({ title: t("register.welcomeToast"), description: t("register.welcomeToastDesc") });
        authLogin(data.token, data.user);
        triggerInstallPrompt();
      },
      onError: (err: unknown) => {
        const translated = translateError(err, lang);
        if (translated.code === "emailExists") {
          setEmailExists(true);
          setStep(1);
          setSlideDir("left");
        } else {
          setInlineError({ field: "form", message: translated.message });
        }
      },
    },
  });

  const handleStep1Continue = () => {
    if (!formData.email.trim() || !EMAIL_RE.test(formData.email.trim())) {
      setInlineError({ field: "email", message: translateError({ message: "invalid email" }, lang).message });
      return;
    }
    if (formData.password.length < 8) {
      setInlineError({ field: "password", message: translateError({ message: "password too short" }, lang).message });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setInlineError({ field: "confirm", message: translateError({ message: "passwords don't match" }, lang).message });
      return;
    }
    if (emailExists) return;
    setInlineError(null);
    goToStep(2);
  };

  const handleSubmit = () => {
    const existingToken = localStorage.getItem("token");
    if (existingToken && user?.id) {
      const { confirmPassword: _c, password: _p, email: _e, name: _n, phone: _ph, ...profileFields } = formData;
      updateUserMutation.mutate({
        id: user.id,
        data: {
          name: formData.name || undefined,
          level: profileFields.level,
          goal: profileFields.goal,
          intensity: profileFields.intensity,
          locationName: profileFields.locationName,
        },
      });
      return;
    }
    setInlineError(null);
    const { confirmPassword, ...rest } = formData;
    registerMutation.mutate({ data: { ...rest, phone: rest.phone || "N/A" } });
  };

  const useDifferentEmail = () => {
    setFormData((p) => ({ ...p, email: "" }));
    setEmailExists(false);
    setInlineError(null);
    setStep(1);
    setTimeout(() => emailInputRef.current?.focus(), 50);
  };

  const goToStep = (next: number) => {
    setSlideDir(next > step ? "right" : "left");
    setStep(next);
  };

  const isPending = registerMutation.isPending || updateUserMutation.isPending;
  const selectedLevel = LEVELS[levelIdx];
  const emailQuery = formData.email.trim() ? `?email=${encodeURIComponent(formData.email.trim())}` : "";

  // Guard must run AFTER every hook above (useRef / useUpdateUser /
  // useRegister sat below the old early-return spot). Bailing earlier
  // skipped those hooks on this render → "Rendered fewer hooks than expected".
  if (isLoading) return null;
  if (user) return <Redirect to={user.archetype ? "/dashboard" : "/welcome"} />;

  return (
    <div
      className="bg-black flex flex-col"
      style={{ minHeight: "100dvh", paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto w-full max-w-md flex-shrink-0 px-6 pt-8 pb-6">
        <div className="text-center mb-8">
          <h1 className="font-serif font-bold text-white" style={{ fontSize: "28px" }}>
            {t("register.title")}
          </h1>
          <p className="text-muted-foreground mt-1" style={{ fontSize: "15px" }}>
            {t("register.subtitle")}
          </p>
        </div>

        <div className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="flex-1 h-1 rounded-full transition-all duration-300"
              style={{ background: s <= step ? "#D4AF37" : "rgba(255,255,255,0.12)" }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {[t("register.stepAccount"), t("register.stepProfile"), t("register.stepLocation")].map((label, i) => (
            <span
              key={label}
              className="transition-colors"
              style={{ fontSize: "12px", color: i + 1 === step ? "#D4AF37" : "rgba(255,255,255,0.35)" }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-6 pb-4">
        <div
          key={step}
          style={{ animation: `${slideDir === "right" ? "slideInRight" : "slideInLeft"} 0.3s ease-out both` }}
        >
          {step === 1 && (
            <div className="space-y-5 pb-2">
              <IosInput
                id="name"
                label={t("register.fullName")}
                placeholder={t("register.namePlaceholder")}
                value={formData.name}
                onChange={(v) => update("name", v)}
              />
              <div>
                <label htmlFor="email" className="block text-white font-medium mb-2" style={{ fontSize: "15px" }}>
                  {t("register.email")}
                </label>
                <input
                  id="email"
                  ref={emailInputRef}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => update("email", e.target.value)}
                  onBlur={(e) => checkEmailAvailability(e.target.value)}
                  className="w-full bg-white/5 border rounded-xl px-4 text-white placeholder:text-white/30 transition-all focus:bg-white/8"
                  style={{
                    height: "56px",
                    fontSize: "17px",
                    borderColor: emailExists
                      ? "rgba(245,158,11,0.5)"
                      : inlineError?.field === "email"
                        ? "rgba(245,158,11,0.5)"
                        : "rgba(255,255,255,0.1)",
                    boxShadow: emailExists || inlineError?.field === "email" ? "0 0 0 3px rgba(245,158,11,0.12)" : undefined,
                  }}
                />
                {checkingEmail && (
                  <p className="mt-1.5 text-xs text-white/40">{t("register.checkingEmail")}</p>
                )}
                {!checkingEmail && inlineError?.field === "email" && !emailExists && (
                  <p className="mt-1.5" style={{ fontSize: "13px", color: "#fbbf24" }}>{inlineError.message}</p>
                )}
                {emailExists && (
                  <EmailExistsCard
                    title={t("register.emailExists.title")}
                    body={t("register.emailExists.body")}
                    signInLabel={t("register.emailExists.signIn")}
                    forgotLabel={t("register.emailExists.forgotPassword")}
                    useDifferentLabel={t("register.emailExists.useDifferent")}
                    signInHref={`/login${emailQuery}`}
                    forgotHref={`/forgot-password${emailQuery}`}
                    onUseDifferent={useDifferentEmail}
                  />
                )}
              </div>
              <IosInput
                id="phone"
                label={t("register.phone")}
                placeholder="+971 50 000 0000"
                value={formData.phone}
                onChange={(v) => update("phone", v)}
              />
              <div>
                <label htmlFor="password" className="block text-white font-medium mb-2" style={{ fontSize: "15px" }}>
                  {t("register.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="w-full bg-white/5 border rounded-xl px-4 text-white placeholder:text-white/30 transition-all focus:bg-white/8"
                  style={{
                    height: "56px",
                    fontSize: "17px",
                    borderColor: inlineError?.field === "password" ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.1)",
                  }}
                />
                {inlineError?.field === "password" && (
                  <p className="mt-1.5" style={{ fontSize: "13px", color: "#fbbf24" }}>{inlineError.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-white font-medium mb-2" style={{ fontSize: "15px" }}>
                  {t("register.confirmPassword")}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  className="w-full bg-white/5 border rounded-xl px-4 text-white placeholder:text-white/30 transition-all focus:bg-white/8"
                  style={{
                    height: "56px",
                    fontSize: "17px",
                    borderColor: inlineError?.field === "confirm" ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)",
                  }}
                />
                {inlineError?.field === "confirm" && (
                  <p className="mt-1.5" style={{ fontSize: "13px", color: "#f87171" }}>{inlineError.message}</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 pb-2">
              <div>
                <label htmlFor="level" className="block text-white font-medium mb-1" style={{ fontSize: "15px" }}>
                  {t("register.selfAssessedLevel")}
                </label>
                <p className="text-muted-foreground mb-5" style={{ fontSize: "13px" }}>
                  {t("register.levelNote")}
                </p>
                <div className="text-center mb-5">
                  <div
                    className="font-mono font-black"
                    style={{ fontSize: "72px", color: "#D4AF37", lineHeight: 1, textShadow: "0 0 40px rgba(212,175,55,0.4)" }}
                  >
                    {selectedLevel.label}
                  </div>
                  <div className="text-muted-foreground mt-1" style={{ fontSize: "15px" }}>
                    {selectedLevel.desc}
                  </div>
                </div>
                <div className="relative">
                  <input
                    id="level"
                    type="range"
                    min={0}
                    max={LEVELS.length - 1}
                    value={levelIdx}
                    onChange={(e) => {
                      const idx = Number(e.target.value);
                      setLevelIdx(idx);
                      update("level", LEVELS[idx].label);
                    }}
                    className="w-full"
                    style={{
                      background: `linear-gradient(to right, #D4AF37 ${(levelIdx / (LEVELS.length - 1)) * 100}%, rgba(255,255,255,0.1) ${(levelIdx / (LEVELS.length - 1)) * 100}%)`,
                    }}
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-muted-foreground" style={{ fontSize: "13px" }}>1.0</span>
                    <span className="text-muted-foreground" style={{ fontSize: "13px" }}>5.0</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-white font-medium mb-3" style={{ fontSize: "15px" }}>
                  {t("register.primaryGoal")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {GOAL_KEYS.map((g) => (
                    <ChipButton key={g} selected={formData.goal === g} onClick={() => update("goal", g)}>
                      {t(`register.goals.${g}`)}
                    </ChipButton>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-white font-medium mb-3" style={{ fontSize: "15px" }}>
                  {t("register.playIntensity")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {INTENSITY_KEYS.map((intensity) => (
                    <ChipButton key={intensity} selected={formData.intensity === intensity} onClick={() => update("intensity", intensity)}>
                      {t(`register.intensities.${intensity}`)}
                    </ChipButton>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 pb-2">
              <div>
                <label htmlFor="locationName" className="block text-white font-medium mb-2" style={{ fontSize: "15px" }}>
                  {t("register.cityArea")}
                </label>
                <input
                  id="locationName"
                  placeholder={t("register.cityPlaceholder")}
                  value={formData.locationName}
                  onChange={(e) => update("locationName", e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-white/30 transition-all focus:border-primary/60 focus:bg-white/8 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
                  style={{ height: "56px", fontSize: "17px" }}
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-1" style={{ fontSize: "15px" }}>
                  {t("register.availability.title")}
                </label>
                <p className="text-muted-foreground mb-4" style={{ fontSize: "13px" }}>
                  {t("register.availability.hint")}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABILITY_SLOTS.map(({ id, key }) => (
                    <ChipButton key={id} selected={availability.has(id)} onClick={() => toggleAvailability(id)}>
                      {t(key)}
                    </ChipButton>
                  ))}
                </div>
              </div>

              {inlineError?.field === "form" && (
                <div
                  className="rounded-[14px] p-4 border"
                  style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)" }}
                >
                  <p style={{ fontSize: "14px", color: "#fbbf24" }}>{inlineError.message}</p>
                </div>
              )}

              <div
                className="rounded-[16px] p-4 border"
                style={{ background: "rgba(212,175,55,0.06)", borderColor: "rgba(212,175,55,0.2)" }}
              >
                <div className="text-white font-medium mb-1" style={{ fontSize: "15px" }}>
                  {t("register.almostThere")}
                </div>
                <div className="text-muted-foreground" style={{ fontSize: "13px" }}>
                  {t("register.almostThereDesc")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="mx-auto w-full max-w-md flex-shrink-0 px-6 pt-4 border-t border-white/6"
        style={{
          background: "rgba(0,0,0,0.97)",
          backdropFilter: "blur(20px)",
          paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))",
        }}
      >
        {step === 1 && (
          <>
            <IosButton
              onClick={handleStep1Continue}
              disabled={!formData.name || !formData.email || !formData.password || !formData.confirmPassword || emailExists || checkingEmail}
            >
              {t("register.continue")}
            </IosButton>
            <p className="text-center mt-4" style={{ fontSize: "15px" }}>
              <span className="text-muted-foreground">{t("register.alreadyMember")} </span>
              <Link href="/login">
                <span className="text-primary font-medium cursor-pointer hover:opacity-80 transition-opacity">
                  {t("register.signIn")}
                </span>
              </Link>
            </p>
          </>
        )}
        {step === 2 && (
          <div className="flex gap-3">
            <button
              onClick={() => goToStep(1)}
              className="rounded-[14px] border border-white/15 text-white/70 font-medium transition-all hover:border-white/25 hover:text-white flex-shrink-0"
              style={{ height: "56px", minWidth: "80px", fontSize: "17px" }}
            >
              {t("register.back")}
            </button>
            <IosButton onClick={() => goToStep(3)}>
              {t("register.continue")}
            </IosButton>
          </div>
        )}
        {step === 3 && (
          <div className="flex gap-3">
            <button
              onClick={() => goToStep(2)}
              className="rounded-[14px] border border-white/15 text-white/70 font-medium transition-all hover:border-white/25 hover:text-white flex-shrink-0"
              style={{ height: "56px", minWidth: "80px", fontSize: "17px" }}
            >
              {t("register.back")}
            </button>
            <IosButton onClick={handleSubmit} disabled={isPending} gold>
              {isPending ? t("register.creatingAccount") : t("register.createAccount")}
            </IosButton>
          </div>
        )}
      </div>
    </div>
  );
}

function EmailExistsCard({
  title,
  body,
  signInLabel,
  forgotLabel,
  useDifferentLabel,
  signInHref,
  forgotHref,
  onUseDifferent,
}: {
  title: string;
  body: string;
  signInLabel: string;
  forgotLabel: string;
  useDifferentLabel: string;
  signInHref: string;
  forgotHref: string;
  onUseDifferent: () => void;
}) {
  return (
    <div
      className="mt-3 rounded-[16px] p-4 border"
      style={{
        background: "rgba(245,158,11,0.06)",
        borderColor: "rgba(245,158,11,0.25)",
        animation: "slideInRight 0.25s ease-out both",
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", fontSize: "16px" }}
        >
          ⓘ
        </div>
        <div className="flex-1">
          <div className="text-white font-medium" style={{ fontSize: "15px" }}>{title}</div>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "13px" }}>{body}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Link href={signInHref}>
          <button
            className="w-full rounded-[12px] font-semibold text-black transition-all hover:opacity-90"
            style={{ height: "44px", fontSize: "14px", background: "#D4AF37" }}
          >
            {signInLabel}
          </button>
        </Link>
        <Link href={forgotHref}>
          <button
            className="w-full rounded-[12px] font-medium transition-all"
            style={{ height: "44px", fontSize: "14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
          >
            {forgotLabel}
          </button>
        </Link>
        <button
          onClick={onUseDifferent}
          className="w-full rounded-[12px] font-medium transition-all"
          style={{ height: "44px", fontSize: "14px", background: "transparent", color: "rgba(255,255,255,0.55)" }}
        >
          {useDifferentLabel}
        </button>
      </div>
    </div>
  );
}

function IosInput({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-white font-medium mb-2" style={{ fontSize: "15px" }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-white/30 transition-all focus:border-primary/60 focus:bg-white/8 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.15)]"
        style={{ height: "56px", fontSize: "17px" }}
      />
    </div>
  );
}

function IosButton({
  children,
  onClick,
  disabled,
  gold,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  gold?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex-1 rounded-[14px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
        gold ? "bg-primary text-black shadow-lg" : "bg-primary text-black"
      )}
      style={{ height: "56px", fontSize: "17px", boxShadow: "0 4px 20px rgba(212,175,55,0.25)" }}
    >
      {children}
    </button>
  );
}

function ChipButton({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-[14px] border font-medium transition-all text-left px-4 flex items-center"
      style={{
        minHeight: "52px",
        fontSize: "15px",
        borderColor: selected ? "#D4AF37" : "rgba(255,255,255,0.12)",
        background: selected ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.03)",
        color: selected ? "#D4AF37" : "rgba(255,255,255,0.7)",
      }}
    >
      {children}
    </button>
  );
}
