import { spawnSync } from "node:child_process";
import { localConfig } from "./local-config.mjs";

const app = process.argv[2];
if (app !== "cabinet" && app !== "auction") {
  throw new Error("Укажите cabinet или auction");
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("docker", ["compose", "up", "-d", "cabinet-db", "dsp-db", "dsp"]);
run("docker", ["compose", "stop", app]);

if (!process.env.npm_execpath) {
  throw new Error("Запускайте dev-скрипт через npm");
}

run(process.execPath, [
  process.env.npm_execpath,
  "run",
  "dev",
  `--workspace=apps/${app}`,
  "--",
  "--hostname",
  localConfig.host,
  "--port",
  String(localConfig.ports[app]),
]);