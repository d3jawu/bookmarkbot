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

const CHECKMARKS = ["☑️", "✔️", "✅️", "✅"];

const storage = new Storage(BOOKMARK_STORAGE_PATH);

const client = new MatrixClient(
  HOMESERVER_URL,
  ACCESS_TOKEN,
  new SimpleFsStorageProvider(MATRIX_STORAGE_PATH),
  new RustSdkCryptoStorageProvider(CRYPTO_STORE_PATH)
);

client.syncingPresence = "offline";

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

      // Clear bookmark by reaction
      if (
        event.type === "m.reaction" &&
        // The two identical-looking checkmarks are actually different!
        // The second one contains a variation selector: https://en.wikipedia.org/wiki/Variation_Selectors_(Unicode_block)
        // If you step over it with the arrow keys, you'll notice it's two characters wide.
        CHECKMARKS.includes(event?.content?.["m.relates_to"]?.key)
      ) {
        console.log(
          `Clearing bookmark by reaction: ${roomId}:${event?.content?.["m.relates_to"]?.event_id}`
        );
        storage.clear(roomId, event?.content?.["m.relates_to"]?.event_id);
        listBookmarks(roomId);
      }

      // Clear bookmark by message
      if (
        event.type === "m.room.message" &&
        CHECKMARKS.includes(event?.content?.body?.[0])
      ) {
        /** @type {string} */
        const body = CHECKMARKS.reduce(
          (body, checkmark) => body.replace(checkmark, ""),
          event?.content?.body || ""
        );

        const bookmarks = storage.list(roomId);


        body
          .split(",")
          .map((iStr) => iStr.replace(/[^0-9]/g, ""))
          .map((iStr) => parseInt(iStr))
          .map((index) => {
            if (
              !index ||
              isNaN(index) ||
              index < 1 ||
              index > bookmarks.length
            ) {
              client.sendEvent(roomId, "m.reaction", {
                "m.relates_to": {
                  rel_type: "m.annotation",
                  event_id: event?.event_id,
                  key: "❌️",
                },
              });
              throw new Error(`Invalid bookmark index to clear: ${index}`);
            }

            return index;
          })
          .forEach((index) => {
            console.log(`Clearing bookmark by message: ${roomId}; #${index}`);
            storage.clear(roomId, bookmarks[index - 1]?.event_id || "");
          });

        client.sendEvent(roomId, "m.reaction", {
          "m.relates_to": {
            rel_type: "m.annotation",
            event_id: event?.event_id,
            key: "🆗",
          },
        });
        listBookmarks(roomId);
      }

      if (event.type === "m.room.message" && event?.content?.body === "📑") {
        // List bookmarks
        listBookmarks(roomId);
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
 * @param {string} roomId
 */
function listBookmarks(roomId) {
  const bookmarks = storage.list(roomId);
  console.log(`Listing bookmarks:`);
  console.log(bookmarks);
  client.sendHtmlText(
    roomId,
    bookmarks.length !== 0
      ? `<b>📚️ Current bookmarks 📚️</b><br/><ol>
        ${bookmarks
          .map(
            ({ excerpt, event_id }) =>
              `<li>${excerpt} ${messageUrl(roomId, event_id)}</li>`
          )
          .join("\n")}
        </ol>`
      : `There are no bookmarks! :3`
  );
}

try {
  client.start();
} catch (e) {
  console.log("Client encountered error:");
  console.log(e);
}
