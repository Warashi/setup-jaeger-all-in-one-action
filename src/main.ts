import * as core from "@actions/core";
import Dockerode from "dockerode";
import fs from "node:fs/promises";

async function main() {
  const mountPath = `${core.getInput("jaeger-data-path")}/badger`;
  await fs.mkdir(mountPath, { recursive: true });

  const docker = new Dockerode();
  await docker.pull("jaegertracing/all-in-one:latest");
  const container = await docker.createContainer({
    name: "jaeger",
    Image: "jaegertracing/all-in-one:latest",
    Env: [
      "COLLECTOR_OTLP_ENABLED=true",
      "COLLECTOR_ZIPKIN_HTTP_PORT=:9411",
      "SPAN_STORAGE_TYPE=badger",
      "BADGER_EPHEMERAL=false",
      "BADGER_DIRECTORY_VALUE=/badger/data",
      "BADGER_DIRECTORY_KEY=/badger/key",
    ],
    HostConfig: {
      PortBindings: {
        "5775/udp": [{ HostIp: "0.0.0.0", HostPort: "5775" }],
        "6831/udp": [{ HostIp: "0.0.0.0", HostPort: "6831" }],
        "6832/udp": [{ HostIp: "0.0.0.0", HostPort: "6832" }],
        "5778/tcp": [{ HostIp: "0.0.0.0", HostPort: "5778" }],
        "16686/tcp": [{ HostIp: "0.0.0.0", HostPort: "16686" }],
        "14250/tcp": [{ HostIp: "0.0.0.0", HostPort: "14250" }],
        "14268/tcp": [{ HostIp: "0.0.0.0", HostPort: "14268" }],
        "14269/tcp": [{ HostIp: "0.0.0.0", HostPort: "14269" }],
        "4317/tcp": [{ HostIp: "0.0.0.0", HostPort: "4317" }],
        "4318/tcp": [{ HostIp: "0.0.0.0", HostPort: "4318" }],
        "9411/tcp": [{ HostIp: "0.0.0.0", HostPort: "9411" }],
      },
      Mounts: [
        {
          Target: "/badger",
          Source: mountPath,
          Type: "bind",
        },
      ],
    },
  });
  await container.start();
}
main();
