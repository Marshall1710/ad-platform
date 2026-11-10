import { pathToFileURL } from "node:url";

export const services = [
  { name: "Кабинет рекламодателя", url: "http://localhost:3000/" },
  { name: "Тестовый Аукцион", url: "http://localhost:3001/" },
  { name: "DSP", url: "http://localhost:8080/health" },
];

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForService(
  service,
  {
    fetchImpl = fetch,
    now = Date.now,
    sleep = defaultSleep,
    timeoutMs = 30_000,
    intervalMs = 500,
  } = {},
) {
  const deadline = now() + timeoutMs;

  while (now() < deadline) {
    try {
      const remaining = deadline - now();
      const response = await fetchImpl(service.url, {
        signal: AbortSignal.timeout(Math.min(2_000, remaining)),
      });
      if (response.status === 200) return;
    } catch {
      // A container may be running before its HTTP server starts listening.
    }

    const remaining = deadline - now();
    if (remaining > 0) await sleep(Math.min(intervalMs, remaining));
  }

  throw new Error(service.name + " не отвечает: " + service.url);
}

export function formatLinks(readyServices = services) {
  const rows = readyServices.map(
    ({ name, url }) => "  ✓ " + name.padEnd(24) + " " + url,
  );
  return "\nПриложения готовы:\n" + rows.join("\n") + "\n\n";
}

export async function showStartupLinks(
  readyServices = services,
  options = {},
) {
  await Promise.all(readyServices.map((service) => waitForService(service, options)));
  const write = options.write ?? process.stdout.write.bind(process.stdout);
  write(formatLinks(readyServices));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  showStartupLinks().catch((error) => {
    process.stderr.write("\nНе все приложения готовы: " + error.message + "\n");
    process.exitCode = 1;
  });
}
