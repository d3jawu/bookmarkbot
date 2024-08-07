import { default as config } from "../config.json" with { type: "json" };

import {
  MatrixClient,
  RustSdkCryptoStorageProvider,
  SimpleFsStorageProvider,
} from "matrix-bot-sdk";

import { Storage } from "./Storage.js";

import { default as configTemplate } from "../config.template.json" with { type: "json" };

// sigh...
/** @typedef {Record<string, any>} Event */

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
   * @param {Event} event
   */
  async (roomId, event) => {
    try {
      if (!ACTIVE_ROOMS.includes(roomId)) {
        return;
      }

      if (
        // Create bookmark with message
        event.type === "m.room.message" &&
        event?.content?.body?.startsWith("🔖")
      ) {
        createBookmark(
          roomId,
          event?.event_id,
          event.content.body.replace("🔖", "").trim()
        );
      }

      if (
        // Create bookmark with reaction
        event.type === "m.reaction" &&
        event?.content?.["m.relates_to"]?.key === "🔖"
      ) {
        const originalEventId = event?.content?.["m.relates_to"]?.event_id;
        /** @type {string} */
        const excerpt = await (async () => {
          try {
            /** @type {Event} */
            const originalEvent = await client.getEvent(
              roomId,
              originalEventId
            );
            console.log(originalEvent);
            return originalEvent?.content?.body;
          } catch (e) {
            console.log(
              `Warning: couldn't get original event ${originalEventId}`
            );
            console.log(e);
            return "";
          }
        })();

        createBookmark(roomId, originalEventId, excerpt || "");
      }

      // Clear bookmark
      if (
        event.type === "m.reaction" &&
        // The two identical-looking checkmarks are actually different!
        // The second one contains a variation selector: https://en.wikipedia.org/wiki/Variation_Selectors_(Unicode_block)
        // If you step over it with the arrow keys, you'll notice it's two characters wide.
        ["☑️", "✔️", "✅", "✅️"].includes(
          event?.content?.["m.relates_to"]?.key
        )
      ) {
        console.log(
          `Clearing bookmark by reaction: ${roomId}:${event?.content?.["m.relates_to"]?.event_id}`
        );
        storage.clear(roomId, event?.content?.["m.relates_to"]?.event_id);
      }

      // List bookmarks
      if (event.type === "m.room.message" && event?.content?.body === "📑") {
        const bookmarks = storage.list();
        console.log(
          `Listing bookmarks:\n${bookmarks.map(({ room_id, event_id, excerpt }) => `- ${room_id}:${event_id} - ${excerpt}\n`)}`
        );
        client.sendHtmlText(
          roomId,
          bookmarks.length !== 0
            ? `<b>📚️ Current bookmarks 📚️</b><br/><ol>
        ${bookmarks
          .map(
            ({ excerpt, room_id, event_id }) =>
              `<li>${excerpt} ${messageUrl(room_id, event_id)}</li>`
          )
          .join("\n")}
        </ol>`
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

/**
 *
 * @param {string} roomId
 * @param {string} eventId
 * @param {string} excerpt
 */
const createBookmark = async (roomId, eventId, excerpt) => {
  console.log(`Creating bookmark: ${roomId}:${eventId} - ${excerpt}`);
  storage.add(roomId, eventId, { excerpt });

  client.sendEvent(roomId, "m.reaction", {
    "m.relates_to": {
      rel_type: "m.annotation",
      event_id: eventId,
      key: "🆗",
    },
  });
};

/**
 *
 * @param {string} senderId
 * @returns {Promise<string>}
 */
// const getDisplayName = async (senderId) => {
//   try {
//     const profile = await client.getUserProfile(senderId);
//     senderId = profile.displayname;
//   } catch (e) {
//     console.log(`Warning: couldn't get display name for ${senderId}`);
//   }

//   return senderId;
// };

try {
  client.start();
} catch (e) {
  console.log("Client encountered error:");
  console.log(e);
}
