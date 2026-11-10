import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_LOCAL_CONFIG = {
  host: "127.0.0.1",
  ports: {
    cabinet: 3000,
    auction: 3001,
    dsp: 8080,
  },
};

const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) loadEnvFile(envFile);

function localPort(value, fallback, name) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(name + " должен быть целым числом от 1 до 65535");
  }
  return port;
}

const host = process.env.LOCAL_HOST?.trim() || DEFAULT_LOCAL_CONFIG.host;
const ports = {
  cabinet: localPort(process.env.CABINET_PORT, DEFAULT_LOCAL_CONFIG.ports.cabinet, "CABINET_PORT"),
  auction: localPort(process.env.AUCTION_PORT, DEFAULT_LOCAL_CONFIG.ports.auction, "AUCTION_PORT"),
  dsp: localPort(process.env.DSP_PORT, DEFAULT_LOCAL_CONFIG.ports.dsp, "DSP_PORT"),
};

export const localConfig = {
  host,
  ports,
  urls: {
    cabinet: `http://${host}:${ports.cabinet}/`,
    auction: `http://${host}:${ports.auction}/`,
    dsp: `http://${host}:${ports.dsp}/health`,
  },
};

export const services = [
  { name: "Кабинет рекламодателя", url: localConfig.urls.cabinet },
  { name: "Тестовый Аукцион", url: localConfig.urls.auction },
  { name: "DSP", url: localConfig.urls.dsp },
];