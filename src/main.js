import { default as config } from "../config.json" with { type: "json" };

import {
  MatrixClient,
  RustSdkCryptoStorageProvider,
  SimpleFsStorageProvider,
} from "matrix-bot-sdk";

import { Storage } from "./Storage.js";

import { default as configTemplate } from "../config.template.json" with { type: "json" };

import { join as joinPath } from "path";

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

const CHECKMARKS = ["☑️", "✔️", "✅", "✅️"];

/** @type {Record<string, Storage>} */
const stores = ACTIVE_ROOMS.reduce(
  (result, roomId) => ({
    ...result,
    [roomId]: new Storage(joinPath(BOOKMARK_STORAGE_PATH, `${roomId}.json`)),
  }),
  {}
);

console.log("Loaded stores:");
console.log(stores);

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

      const store = stores[roomId];
      if (!store) {
        console.log(`Missing store for ${roomId}.`);
        console.log("Existing stores:");
        console.log(stores);
        return;
      }

      if (
        // Create bookmark with message
        event.type === "m.room.message" &&
        event?.content?.body?.startsWith("🔖")
      ) {
        console.log("Creating bookmark by message");
        console.log(event);
        console.log(event?.event_id);
        createBookmark(
          store,
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

        createBookmark(store, roomId, originalEventId, excerpt || "");
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
        store.clear(event?.content?.["m.relates_to"]?.event_id);
      }

      // Clear bookmark by message
      if (
        event.type === "m.room.message" &&
        CHECKMARKS.includes(event?.content?.body?.[0])
      ) {
        const index = event?.content?.body?.split(" ")[1];
        const bookmarks = store.list();

        console.log(bookmarks.length);

        if (!index || isNaN(index) || index < 1 || index > bookmarks.length) {
          console.log(`Warning: Invalid bookmark index to clear: ${index}`);
          client.sendEvent(roomId, "m.reaction", {
            "m.relates_to": {
              rel_type: "m.annotation",
              event_id: event?.event_id,
              key: "❌️",
            },
          });
          return;
        }

        console.log(`Clearing bookmark by message: ${roomId}; #${index}`);
        console.log(bookmarks);
        console.log(bookmarks[index - 1]?.event_id);
        store.clear(bookmarks[index - 1]?.event_id || "");

        client.sendEvent(roomId, "m.reaction", {
          "m.relates_to": {
            rel_type: "m.annotation",
            event_id: event?.event_id,
            key: "🆗",
          },
        });
      }

      if (event.type === "m.room.message" && event?.content?.body === "📑") {
        // List bookmarks
        const bookmarks = store.list();
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
 * @param {Storage} store
 * @param {string} roomId
 * @param {string} eventId
 * @param {string} excerpt
 */
const createBookmark = async (store, roomId, eventId, excerpt) => {
  console.log(`Creating bookmark in ${roomId}:${eventId} - ${excerpt}`);
  store.add(eventId, { excerpt });

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
