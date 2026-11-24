import { spawnSync } from "node:child_process";
import { localConfig } from "./local-config.mjs";

const app = process.argv[2];
if (app !== "cabinet" && app !== "auction") {
  throw new Error("Укажите cabinet или auction");
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("docker", ["compose", "up", "-d", "cabinet-db", "dsp-db", "dsp"]);
run("docker", ["compose", "stop", app]);

if (!process.env.npm_execpath) {
  throw new Error("Запускайте dev-скрипт через npm");
}

const appEnv = app === "cabinet" ? {
  ...process.env,
  DATABASE_URL: `postgresql://cabinet:cabinet_local@127.0.0.1:${localConfig.ports.cabinetDb}/cabinet`,
  BETTER_AUTH_URL: localConfig.urls.cabinet.slice(0, -1),
  BETTER_AUTH_SECRET: process.env.AUTH_SECRET,
} : process.env;

if (app === "cabinet") {
  run(process.execPath, [process.env.npm_execpath, "run", "migrate", "--workspace=apps/cabinet"], appEnv);
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
], appEnv);
