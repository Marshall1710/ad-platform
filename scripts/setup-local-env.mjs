import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const templatePath = fileURLToPath(new URL("../.env.example", import.meta.url));
let content = existsSync(envPath)
  ? readFileSync(envPath, "utf8")
  : readFileSync(templatePath, "utf8");

const configured = content.match(/^AUTH_SECRET=(.*)$/m)?.[1]?.trim();
if (configured) {
  if (configured.length < 32) {
    throw new Error("AUTH_SECRET в .env должен содержать не менее 32 символов");
  }
} else {
  const secret = randomBytes(32).toString("base64url");
  if (/^AUTH_SECRET=.*$/m.test(content)) {
    content = content.replace(/^AUTH_SECRET=.*$/m, "AUTH_SECRET=" + secret);
  } else {
    content = content.trimEnd() + "\nAUTH_SECRET=" + secret + "\n";
  }
  writeFileSync(envPath, content, { mode: 0o600 });
  process.stdout.write("Локальный секрет авторизации создан в .env\n");
}
