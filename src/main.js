import { default as config } from "../config.json" with { type: "json" };

import { Host } from "./Host.js";

import { default as configTemplate } from "../config.template.json" with { type: "json" };
import { join as joinPath } from "path";

// sigh...
/** @typedef {Record<string, any>} Event */

Object.keys(configTemplate).forEach((key) => {
  if (!(key in config)) {
    throw new Error(`Missing config key: ${key}. See config.template.json.`);
  }
});

// Settings that are consistent across users
const { HOSTS } = config;
const STORE_PATH = joinPath(process.cwd(), "store");

HOSTS.forEach((hostConfig) => {
  const host = new Host(hostConfig, STORE_PATH);
  try {
    host.start();
  } catch (e) {
    console.log(`Client for host ${hostConfig.HOST_PATH} encountered error:`);
    console.log(e);
    process.exit(1);
  }
});
