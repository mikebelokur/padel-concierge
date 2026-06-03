export type Lang = "en" | "ru" | "ar";

export type ErrorCode =
  | "emailExists"
  | "invalidEmail"
  | "passwordTooShort"
  | "passwordsMismatch"
  | "invalidCredentials"
  | "network"
  | "sessionExpired"
  | "notFound"
  | "badRequest"
  | "server"
  | "unknown";

export interface TranslatedError {
  code: ErrorCode;
  message: string;
  action?: { label: string; href: string };
}

const MESSAGES: Record<Lang, Record<ErrorCode, string>> = {
  ru: {
    emailExists: "Этот email уже зарегистрирован",
    invalidEmail: "Похоже, в email опечатка. Проверь, пожалуйста",
    passwordTooShort: "Пароль должен быть минимум 8 символов",
    passwordsMismatch: "Пароли не совпадают",
    invalidCredentials: "Неверный email или пароль",
    network: "Не удалось подключиться. Проверь интернет",
    sessionExpired: "Сессия истекла. Пожалуйста, войдите снова",
    notFound: "Запись не найдена",
    badRequest: "Проверь введённые данные",
    server: "Что-то пошло не так. Попробуй через минуту",
    unknown: "Что-то пошло не так. Попробуй снова",
  },
  en: {
    emailExists: "This email is already registered",
    invalidEmail: "Looks like there's a typo in the email. Please check",
    passwordTooShort: "Password must be at least 8 characters",
    passwordsMismatch: "Passwords don't match",
    invalidCredentials: "Invalid email or password",
    network: "Connection failed. Check your internet",
    sessionExpired: "Session expired. Please sign in again",
    notFound: "Record not found",
    badRequest: "Please check the values you entered",
    server: "Something went wrong. Try again in a moment",
    unknown: "Something went wrong. Try again",
  },
  ar: {
    emailExists: "هذا البريد الإلكتروني مسجل بالفعل",
    invalidEmail: "يبدو أن هناك خطأ في البريد. يرجى التحقق",
    passwordTooShort: "يجب أن تكون كلمة المرور 8 أحرف على الأقل",
    passwordsMismatch: "كلمات المرور غير متطابقة",
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    network: "فشل الاتصال. تحقق من الإنترنت",
    sessionExpired: "انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى",
    notFound: "السجل غير موجود",
    badRequest: "يرجى التحقق من القيم المدخلة",
    server: "حدث خطأ. حاول بعد قليل",
    unknown: "حدث خطأ. حاول مرة أخرى",
  },
};

const LOGIN_LABEL: Record<Lang, string> = { ru: "Войти", en: "Sign in", ar: "تسجيل الدخول" };

function classifyError(err: unknown): ErrorCode {
  const status = (err as { status?: number })?.status;
  const raw = String((err as { message?: string })?.message ?? "").toLowerCase();

  if (raw.includes("email already") || raw.includes("already registered") || raw.includes("уже зарегистрирован")) {
    return "emailExists";
  }
  // Note: the credentials error "invalid email or password" also contains the
  // substring "invalid email" — exclude it here so it falls through to the
  // invalidCredentials branch below and isn't mislabeled as an email typo.
  if (
    (raw.includes("invalid email") && !raw.includes("password")) ||
    raw.includes("email format") ||
    (raw.includes("некорректн") && raw.includes("email"))
  ) {
    return "invalidEmail";
  }
  if (raw.includes("password") && (raw.includes("short") || raw.includes("least") || raw.includes("минимум"))) {
    return "passwordTooShort";
  }
  if (raw.includes("password") && (raw.includes("match") || raw.includes("совпада"))) {
    return "passwordsMismatch";
  }
  if (
    raw.includes("invalid password") ||
    raw.includes("wrong password") ||
    raw.includes("incorrect password") ||
    raw.includes("invalid credentials") ||
    raw.includes("неверн") ||
    status === 401
  ) {
    return "invalidCredentials";
  }
  if (
    raw.includes("network") ||
    raw.includes("failed to fetch") ||
    raw.includes("load failed") ||
    raw.includes("networkerror") ||
    status === 0
  ) {
    return "network";
  }
  if (raw.includes("session") || raw.includes("token") || raw.includes("expired")) {
    return "sessionExpired";
  }
  if (raw.includes("not found") || status === 404) {
    return "notFound";
  }
  if (status === 400 || status === 422 || raw.includes("bad request") || raw.includes("validation")) {
    return "badRequest";
  }
  if (typeof status === "number" && status >= 500) {
    return "server";
  }
  return "unknown";
}

export function translateError(err: unknown, lang: Lang = "ru"): TranslatedError {
  const code = classifyError(err);
  const map = MESSAGES[lang] ?? MESSAGES.ru;
  const result: TranslatedError = { code, message: map[code] };
  if (code === "invalidCredentials" || code === "sessionExpired") {
    result.action = { label: LOGIN_LABEL[lang], href: "/login" };
  }
  if (code === "emailExists") {
    result.action = { label: LOGIN_LABEL[lang], href: "/login" };
  }
  return result;
}
