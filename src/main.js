import { default as config } from "../config.json" with { type: "json" };

import {
  MatrixClient,
  RustSdkCryptoStorageProvider,
  SimpleFsStorageProvider,
} from "matrix-bot-sdk";

import { Storage } from "./Storage.js";

import { default as configTemplate } from "../config.template.json" with { type: "json" };

Object.keys(configTemplate).forEach((key) => {
  if (!(key in config)) {
    throw new Error(`Missing config key: ${key}. See config.template.json.`);
  }
});

const {
  HOMESERVER_URL,
  ACCESS_TOKEN,
  BOOKMARK_STORAGE_PATH,
  MATRIX_STORAGE_PATH,
  CRYPTO_STORE_PATH,
} = config;

const ACTIVE_ROOMS = config.ACTIVE_ROOMS.split(",");

const storage = new Storage(BOOKMARK_STORAGE_PATH);

const client = new MatrixClient(
  HOMESERVER_URL,
  ACCESS_TOKEN,
  new SimpleFsStorageProvider(MATRIX_STORAGE_PATH),
  new RustSdkCryptoStorageProvider(CRYPTO_STORE_PATH)
);

client.on(
  "room.event",
  /**
   *
   * @param {string} roomId
   * @param {Record<string, any>} event
   */
  async (roomId, event) => {
    try {
      if (!ACTIVE_ROOMS.includes(roomId)) {
        return;
      }

      // Create bookmark
      if (
        event.type === "m.room.message" &&
        event?.content?.body?.startsWith("🔖")
      ) {
        /** @type {string} */
        let senderName = event.sender;
        try {
          const profile = await client.getUserProfile(event.sender);
          senderName = profile.displayname;
        } catch (e) {
          console.log(`Warning: couldn't get display name for ${event.sender}`);
        }

        storage.add(roomId, event.event_id, {
          excerpt: event.content.body.replace("🔖", "").trim(),
          sender: senderName,
        });

        client.sendEvent(roomId, "m.reaction", {
          "m.relates_to": {
            rel_type: "m.annotation",
            event_id: event.event_id,
            key: "🆗",
          },
        });
      }

      // Clear bookmark
      if (
        event.type === "m.reaction" &&
        ["☑️", "✅", "✔️"].includes(event?.content?.["m.relates_to"]?.key)
      ) {
        storage.clear(roomId, event?.content?.["m.relates_to"]?.event_id);
      }

      // List bookmarks
      if (event.type === "m.room.message" && event?.content?.body === "📑") {
        const bookmarks = storage.list();
        client.sendHtmlText(
          roomId,
          bookmarks.length !== 0
            ? `<b>📚️ Current bookmarks 📚️</b><br/><ul>
        ${bookmarks
          .map(
            ({ excerpt, room_id, event_id }) =>
              `<li>${excerpt} 👉️${messageUrl(room_id, event_id)}</li>`
          )
          .join("\n")}
        </ul>`
            : `There are no bookmarks! :3`
        );
      }
    } catch (e) {
      console.log(e);
    }
  }
);

/**
 * @param {string} roomId
 * @param {string} eventId
 * @returns {string}
 */
const messageUrl = (roomId, eventId) =>
  `https://matrix.to/#/${roomId}/${eventId}`;

client.start();
