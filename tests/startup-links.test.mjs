import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  services,
  waitForService,
  showStartupLinks,
} from "../scripts/show-startup-links.mjs";

test("ожидает временно недоступный сервис", async () => {
  let requests = 0;
  let currentTime = 0;

  await waitForService(
    { name: "Кабинет", url: "http://example.test/" },
    {
      fetchImpl: async () => ({ status: ++requests === 1 ? 503 : 200 }),
      now: () => currentTime,
      sleep: async (ms) => { currentTime += ms; },
      timeoutMs: 100,
      intervalMs: 25,
    },
  );

  assert.equal(requests, 2);
});

test("сообщает имя и адрес сервиса после истечения ожидания", async () => {
  let currentTime = 0;
  await assert.rejects(
    waitForService(
      { name: "Аукцион", url: "http://auction.test/" },
      {
        fetchImpl: async () => ({ status: 503 }),
        now: () => currentTime,
        sleep: async (ms) => { currentTime += ms; },
        timeoutMs: 50,
        intervalMs: 25,
      },
    ),
    /Аукцион.*http:\/\/auction\.test\//,
  );
});

test("печатает три адреса только после готовности всех приложений", async () => {
  let releaseAuction;
  const auctionReady = new Promise((resolve) => { releaseAuction = resolve; });
  let output = "";

  const pending = showStartupLinks(services, {
    fetchImpl: async (url) =>
      url === services[1].url ? auctionReady : { status: 200 },
    write: (value) => { output += value; },
  });

  await new Promise(setImmediate);
  assert.equal(output, "");

  releaseAuction({ status: 200 });
  await pending;

  for (const { name, url } of services) {
    assert.ok(output.includes(name));
    assert.ok(output.includes(url));
  }
  assert.equal((output.match(/http:\/\//g) ?? []).length, 3);
});

test("при недоступном приложении не печатает успешный итог", async () => {
  let currentTime = 0;
  let output = "";
  await assert.rejects(
    showStartupLinks(
      [{ name: "DSP", url: "http://dsp.test/health" }],
      {
        fetchImpl: async () => { throw new Error("connection refused"); },
        now: () => currentTime,
        sleep: async (ms) => { currentTime += ms; },
        timeoutMs: 50,
        intervalMs: 25,
        write: (value) => { output += value; },
      },
    ),
    /DSP.*http:\/\/dsp\.test\/health/,
  );
  assert.equal(output, "");
});

test("локальные адреса можно переопределить окружением", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", 'import { services } from "./scripts/show-startup-links.mjs"; console.log(JSON.stringify(services))'],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        LOCAL_HOST: "127.0.0.2",
        CABINET_PORT: "3100",
        AUCTION_PORT: "3101",
        DSP_PORT: "8180",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).map(({ url }) => url), [
    "http://127.0.0.2:3100/",
    "http://127.0.0.2:3101/",
    "http://127.0.0.2:8180/health",
  ]);
});
