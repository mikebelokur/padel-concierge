import { logger } from "./logger.js";

export function fireAndForget(promise: Promise<unknown>, context: Record<string, unknown>): void {
  promise.catch((err: unknown) => {
    logger.warn({ ...context, err }, "[bg] background write failed");
  });
}
