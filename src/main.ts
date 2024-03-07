import * as core from "@actions/core";
import * as io from "@actions/io";
import * as tc from "@actions/tool-cache";
import { spawn } from "node:child_process";
import * as process from "node:process";
import * as os from "node:os";

async function main() {
  const tempDir = `${process.env.RUNNER_TEMP || os.tmpdir()}/jaeger-all-in-one`;
  await io.mkdirP(tempDir);

  core.debug(`tempDir: ${tempDir}`);

  const jaegerVersion = core.getInput("jaeger-version");
  const jaegerUrl =
    `https://github.com/jaegertracing/jaeger/releases/download/v${jaegerVersion}/jaeger-${jaegerVersion}-linux-amd64.tar.gz`;
  const jaegerPath = await tc.downloadTool(jaegerUrl);
  const jaegerExtractedFolder = await tc.extractTar(
    jaegerPath,
    `${tempDir}/jaeger-tar`,
  );
  const jaegerExecutable =
    `${jaegerExtractedFolder}/jaeger-${jaegerVersion}-linux-amd64/jaeger-all-in-one`;

  core.debug(`jaegerPath: ${jaegerPath}`);

  const child_process = spawn(jaegerExecutable, {
    stdio: "ignore",
    detached: true,
    env: {
      COLLECTOR_OTLP_ENABLED: "true",
      COLLECTOR_ZIPKIN_HTTP_PORT: ":9411",
      SPAN_STORAGE_TYPE: "badger",
      BADGER_CONSISTENCY: "true",
      BADGER_EPHEMERAL: "false",
      BADGER_DIRECTORY_VALUE: `${tempDir}/jaeger/badger/data`,
      BADGER_DIRECTORY_KEY: `${tempDir}/jaeger/badger/key`,
    },
  });
  core.saveState("jaeger-process", child_process.pid);
  child_process.unref();
  core.debug(`jaeger-process: ${child_process.pid}`);

  core.saveState("jaeger-data-path", `${tempDir}/jaeger`);
  core.debug(`jaeger-data-path: ${tempDir}/jaeger`);

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const res = await fetch("http://127.0.0.1:14269/").catch((e) => {
      if (e.cause?.code === "ECONNREFUSED") {
        return { ok: false, status: 500 };
      }
      throw e;
    });
    if (res?.ok && res.status === 200) {
      break;
    }
    console.log("waiting for jaeger to start: not ok");
  }
}
main();
