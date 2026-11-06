import { execFileSync } from "node:child_process";

const databases = [
  ["cabinet-db", "cabinet", "cabinet"],
  ["dsp-db", "dsp", "dsp"],
];

for (const [service, user, database] of databases) {
  try {
    execFileSync(
      "docker",
      ["compose", "exec", "-T", service, "pg_isready", "-U", user, "-d", database],
      { stdio: "pipe" },
    );
    process.stdout.write(service + ": ready\n");
  } catch {
    process.stderr.write(service + ": unavailable\n");
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
