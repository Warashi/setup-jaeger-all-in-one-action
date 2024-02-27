import * as core from "@actions/core";
import * as artifact from "@actions/artifact";
import { glob } from "glob";
import Dockerode from "dockerode";
import fs from "node:fs/promises";
import dedent from "dedent";

async function main() {
  const jaegerDataPath = core.getInput("jaeger-data-path");

  const docker = new Dockerode();
  const container = await docker.getContainer("jaeger");
  await container.stop();
  await container.remove();

  if (!core.getBooleanInput("upload-trace")) {
    return;
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

  await artifact.default.uploadArtifact(
    "jaeger",
    await glob(`${jaegerDataPath}/**/*`),
    jaegerDataPath,
  );
}
main();
