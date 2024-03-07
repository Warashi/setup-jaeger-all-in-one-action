import * as core from "@actions/core";
import * as artifact from "@actions/artifact";
import * as glob from "@actions/glob";
import * as fs from "node:fs/promises";
import dedent from "dedent";

async function main() {
  const pid = core.getState("jaeger-process");
  if (!pid) {
    throw new Error("jaeger process not found");
  }
  process.kill(Number(pid), "SIGINT");

  if (!core.getBooleanInput("upload-trace")) {
    return;
  }

  const jaegerDataPath = core.getState("jaeger-data-path") as string;
  if (!jaegerDataPath) {
    throw new Error("jaeger data path not found");
  }

  fs.writeFile(
    `${jaegerDataPath}/compose.yaml`,
    dedent`
      services:
        jaeger:
          image: docker.io/jaegertracing/all-in-one:1.54
          ports:
            - "16686:16686"
          environment:
            - "SPAN_STORAGE_TYPE=badger"
            - "BADGER_EPHEMERAL=false"
            - "BADGER_DIRECTORY_VALUE=/badger/data"
            - "BADGER_DIRECTORY_KEY=/badger/key"
          volumes:
            - ./badger:/badger
    `,
  );

  const globber = await glob.create(`${jaegerDataPath}/**/*`, {
    followSymbolicLinks: true,
    matchDirectories: false,
  });
  const files = await globber.glob();

  console.log(files);

  await artifact.default.uploadArtifact(
    "jaeger",
    files,
    jaegerDataPath,
  );
}
main();
