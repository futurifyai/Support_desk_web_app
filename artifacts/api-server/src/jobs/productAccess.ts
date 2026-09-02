import { logger } from "../lib/logger";
import { expireDueProductAccess } from "../lib/productAccess";

const EXPIRY_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export function startProductAccessExpiryScheduler(): void {
  const run = () => void expireDueProductAccess()
    .then((expiredCount) => {
      if (expiredCount > 0) logger.info({ expiredCount }, "Expired past-due product access");
    })
    .catch((err) => logger.error({ err }, "Product access expiry sweep failed"));

  run();
  setInterval(run, EXPIRY_SWEEP_INTERVAL_MS).unref();
}