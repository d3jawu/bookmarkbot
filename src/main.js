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
   * @param {Record<string, any>} event
   */
  async (roomId, event) => {
    if (!ACTIVE_ROOMS.includes(roomId)) {
      return;
    }

    console.log(roomId);
    console.log(event);

    // Create bookmark
    if (
      event.type === "m.room.message" &&
      !!event?.content?.body &&
      typeof event?.content?.body === "string" &&
      event.content.body.startsWith("🔖")
    ) {
      /** @type {string} */
      let senderName = event.sender;
      try {
        const profile = await client.getUserProfile(event.sender);
        senderName = profile.displayname;
      } catch (e) {
        console.log(`Warning: couldn't get display name for ${event.sender}`);
      }

      storage.add(event.event_id, {
        excerpt: event.content.body.replace("🔖", "").trim(),
        sender: senderName,
      });

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

/**
 * @param {string} roomId
 * @param {string} eventId
 * @returns {string}
 */
const messageUrl = (roomId, eventId) =>
  `https://matrix.to/#/${roomId}:${HOMESERVER_URL.replace(
    "https://",
    ""
  ).replace("http://", "")}/${eventId}`;

client.start();
