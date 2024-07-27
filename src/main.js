import "dotenv/config";

import {
  MatrixClient,
  RustSdkCryptoStorageProvider,
  SimpleFsStorageProvider,
} from "matrix-bot-sdk";

import { Storage } from "./Storage.js";

const { HOMESERVER_URL, ACCESS_TOKEN } = process.env;
if (!HOMESERVER_URL) {
  throw new Error("HOMESERVER_URL not set.");
}
if (!ACCESS_TOKEN) {
  throw new Error("ACCESS_TOKEN not set.");
}

if (!process.env["ACTIVE_ROOMS"]) {
  throw new Error();
}

if (!process.env["STORAGE_PATH"]) {
  throw new Error();
}

const ACTIVE_ROOMS = process.env["ACTIVE_ROOMS"].split(",");

const storage = new Storage(process.env["STORAGE_PATH"]);

const client = new MatrixClient(
  HOMESERVER_URL,
  ACCESS_TOKEN,
  new SimpleFsStorageProvider("./.matrix_storage.json"),
  new RustSdkCryptoStorageProvider("./.crypto_store")
);

client.on(
  "room.event",
  /**
   *
   * @param {string} roomId
   * @param {Record<string, unknown>} event
   */
  async (roomId, event) => {
    if (!ACTIVE_ROOMS.includes(roomId)) {
      return;
    }

    console.log(roomId);
    console.log(event);

    if (
      event.type === "m.room.message" &&
      !!event?.content?.body &&
      typeof event?.content?.body === "string" &&
      event.content.body.startsWith("🔖")
    ) {
      // Create bookmark
      console.log("bookmarking:");
      console.log(event);

      client.sendEvent(roomId, "m.reaction", {
        "m.relates_to": {
          rel_type: "m.annotation",
          event_id: event.event_id,
          key: "👀",
        },
      });
    }
  }
);

client.start();
