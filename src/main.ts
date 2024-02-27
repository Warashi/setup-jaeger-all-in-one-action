import * as core from "@actions/core";
import Dockerode from "dockerode";
import fs from "node:fs/promises";
import process from "node:process";

async function main() {
  const mountPath = `${core.getInput("jaeger-data-path")}/badger`;
  await fs.mkdir(mountPath, { recursive: true, mode: 0o777 });

  const docker = new Dockerode();

  // from https://github.com/apocas/dockerode/issues/647
  const pullStream = await docker.pull(
    "docker.io/jaegertracing/all-in-one:1.54",
  );
  await new Promise((resolve, reject) => {
    docker.modem.followProgress(
      pullStream,
      (err, res) => (err ? reject(err) : resolve(res)),
    );
  });

  let uid = 0;
  let gid = 0;
  if (process.getuid && process.getgid) {
    uid = process.getuid();
    gid = process.getgid();
  }

  const container = await docker.createContainer({
    name: "jaeger",
    Image: "docker.io/jaegertracing/all-in-one:1.54",
    User: `${uid}:${gid}`,
    Env: [
      "COLLECTOR_OTLP_ENABLED=true",
      "COLLECTOR_ZIPKIN_HTTP_PORT=:9411",
      "SPAN_STORAGE_TYPE=badger",
      "BADGER_EPHEMERAL=false",
      "BADGER_DIRECTORY_VALUE=/badger/data",
      "BADGER_DIRECTORY_KEY=/badger/key",
    ],
    ExposedPorts: {
      "5775/udp": {},
      "6831/udp": {},
      "6832/udp": {},
      "5778/tcp": {},
      "16686/tcp": {},
      "14250/tcp": {},
      "14268/tcp": {},
      "14269/tcp": {},
      "4317/tcp": {},
      "4318/tcp": {},
      "9411/tcp": {},
    },
    HostConfig: {
      PortBindings: {
        "5775/udp": [{ HostPort: "5775" }],
        "6831/udp": [{ HostPort: "6831" }],
        "6832/udp": [{ HostPort: "6832" }],
        "5778/tcp": [{ HostPort: "5778" }],
        "16686/tcp": [{ HostPort: "16686" }],
        "14250/tcp": [{ HostPort: "14250" }],
        "14268/tcp": [{ HostPort: "14268" }],
        "14269/tcp": [{ HostPort: "14269" }],
        "4317/tcp": [{ HostPort: "4317" }],
        "4318/tcp": [{ HostPort: "4318" }],
        "9411/tcp": [{ HostPort: "9411" }],
      },
      Mounts: [
        {
          Target: "/badger",
          Source: mountPath,
          Type: "bind",
          ReadOnly: false,
        },
      ],
    },
  });

  await container.start();

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const res = await fetch("http://127.0.0.1:14269/").catch((e) => {
      if (e.cause?.code === "ECONNREFUSED") {
        console.log("waiting for jaeger to start: connection refused");
        return;
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
