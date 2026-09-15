import app from "./app";
import { logger } from "./lib/logger";
import { startSlaScheduler } from "./jobs/sla";
import { startProductAccessExpiryScheduler } from "./jobs/productAccess";
import { getSessionSecret, getTrustedProxyHops } from "./config";

const rawPort = process.env["PORT"] || "5001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

getSessionSecret();
getTrustedProxyHops();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startSlaScheduler();
  startProductAccessExpiryScheduler();
});
