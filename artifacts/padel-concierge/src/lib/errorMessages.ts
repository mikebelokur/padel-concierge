export interface TranslatedError {
  message: string;
  action?: { label: string; href: string };
}

const ERROR_MAP: Array<{
  match: (err: unknown) => boolean;
  result: TranslatedError;
}> = [
  {
    match: (err) => {
      const msg = String((err as any)?.message ?? "").toLowerCase();
      return (
        msg.includes("email already") ||
        msg.includes("already registered") ||
        msg.includes("уже зарегистрирован") ||
        (err as any)?.status === 409
      );
    },
    result: {
      message: "Этот email уже зарегистрирован. Войти?",
      action: { label: "Войти", href: "/login" },
    },
  },
  {
    match: (err) => {
      const msg = String((err as any)?.message ?? "").toLowerCase();
      return (
        msg.includes("invalid password") ||
        msg.includes("wrong password") ||
        msg.includes("incorrect password") ||
        msg.includes("invalid credentials") ||
        msg.includes("unauthorized") ||
        (err as any)?.status === 401
      );
    },
    result: { message: "Неверный email или пароль. Проверьте данные и попробуйте снова." },
  },
  {
    match: (err) => {
      const msg = String((err as any)?.message ?? "").toLowerCase();
      return (
        msg.includes("network") ||
        msg.includes("failed to fetch") ||
        msg.includes("load failed") ||
        msg.includes("networkerror") ||
        (err as any)?.status === 0
      );
    },
    result: { message: "Нет соединения с сервером. Проверьте интернет и попробуйте снова." },
  },
  {
    match: (err) => {
      const msg = String((err as any)?.message ?? "").toLowerCase();
      return (
        msg.includes("session") ||
        msg.includes("token") ||
        msg.includes("expired") ||
        (err as any)?.status === 403
      );
    },
    result: {
      message: "Сессия истекла. Пожалуйста, войдите снова.",
      action: { label: "Войти", href: "/login" },
    },
  },
  {
    match: (err) => (err as any)?.status >= 500,
    result: { message: "Ошибка сервера. Попробуйте позже." },
  },
];

export function translateError(err: unknown): TranslatedError {
  for (const entry of ERROR_MAP) {
    try {
      if (entry.match(err)) return entry.result;
    } catch {
      // skip
    }
  }
  return { message: "Что-то пошло не так. Попробуйте снова." };
}
