import { default as config } from "../config.json" with { type: "json" };

import { Storage } from "./Storage.js";
import { Host } from "./Host.js";

import { default as configTemplate } from "../config.template.json" with { type: "json" };

// sigh...
/** @typedef {Record<string, any>} Event */

Object.keys(configTemplate).forEach((key) => {
  if (!(key in config)) {
    throw new Error(`Missing config key: ${key}. See config.template.json.`);
  }
});

// Settings that are consistent across users
const { HOSTS } = config;
const STORE_PATH = "../store/";

// const ACTIVE_ROOMS = config.ACTIVE_ROOMS.split(",");

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
