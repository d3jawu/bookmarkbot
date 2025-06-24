import { Storage } from "./Storage.js";
import { default as config } from "../config.json" with { type: "json" };
import {
  MatrixClient,
  RustSdkCryptoStorageProvider,
  SimpleFsStorageProvider,
} from "matrix-bot-sdk";

import { mkdirSync, existsSync } from "fs";
import { join as joinPath } from "path";

// Hold on to your fucking skorts
/** @typedef {(typeof config)['HOSTS'][number]} HostConfig */

/**
 * @param {string} roomId
 * @param {string} eventId
 * @returns {string}
 */
function messageUrl(roomId, eventId) {
  return `https://matrix.to/#/${roomId}/${eventId}`;
}

const SILENT_CHECKMARKS = ["☑️", "✔️"];
const LOUD_CHECKMARKS = ["✅️", "✅"];
const CHECKMARKS = [...SILENT_CHECKMARKS, ...LOUD_CHECKMARKS];

export class Host {
  /**
   * @param {HostConfig} config
   * @param {string} storePath
   */
  constructor({ HOST_PATH, ACCESS_TOKEN, ACTIVE_ROOMS }, storePath) {
    const hostPath = joinPath(storePath, HOST_PATH);
    if (!existsSync(hostPath)) {
      console.log(`Creating host folder for ${hostPath}`);
      mkdirSync(hostPath);
    }

    /** @type {Storage} */
    this.storage = new Storage(joinPath(hostPath, "bookmarks.json"));

    /** @type {MatrixClient} */
    this.client = new MatrixClient(
      config.HOMESERVER_URL,
      ACCESS_TOKEN,
      new SimpleFsStorageProvider(joinPath(hostPath, "matrix_storage.json")),
      new RustSdkCryptoStorageProvider(joinPath(hostPath, "crypto_store")),
    );

    this.client.on(
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

          // Create bookmark with message
          if (
            event.type === "m.room.message" &&
            event?.content?.body?.startsWith("🔖")
          ) {
            this.createBookmark(
              roomId,
              event?.event_id,
              event.content.body.replace("🔖", "").trim(),
            );
          }

          // Create bookmark with reaction
          if (
            event.type === "m.reaction" &&
            event?.content?.["m.relates_to"]?.key === "🔖"
          ) {
            const originalEventId = event?.content?.["m.relates_to"]?.event_id;
            /** @type {string} */
            const excerpt = await (async () => {
              try {
                /** @type {Event} */
                const originalEvent = await this.client.getEvent(
                  roomId,
                  originalEventId,
                );
                console.log(originalEvent);
                return originalEvent?.content?.body;
              } catch (e) {
                console.log(
                  `Warning: couldn't get original event ${originalEventId}`,
                );
                console.log(e);
                return "";
              }
            })();

            this.createBookmark(roomId, originalEventId, excerpt || "");
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
              `Clearing bookmark by reaction: ${roomId}:${event?.content?.["m.relates_to"]?.event_id}`,
            );
            this.storage.clear(
              roomId,
              event?.content?.["m.relates_to"]?.event_id,
            );
            
            // Silent check or loud check
            const checkmark = event?.content?.["m.relates_to"]?.key;
            if (SILENT_CHECKMARKS.includes(checkmark)) {
              // Add 🆓 emoji for silent check
              this.client.sendEvent(roomId, "m.reaction", {
                "m.relates_to": {
                  rel_type: "m.annotation",
                  event_id: event?.content?.["m.relates_to"]?.event_id,
                  key: "🆓",
                },
              });
            } else {
              // List bookmarks for loud check
              this.listBookmarks(roomId);
            }
          }

          // Clear bookmark by message
          if (
            event.type === "m.room.message" &&
            CHECKMARKS.includes(event?.content?.body?.[0])
          ) {
            
            /** @type {string} */
            const body = CHECKMARKS.reduce(
              (body, checkmark) => body.replace(checkmark, ""),
              event?.content?.body || "",
            );

            const bookmarks = this.storage.list(roomId);

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
                  this.client.sendEvent(roomId, "m.reaction", {
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
                console.log(
                  `Clearing bookmark by message: ${roomId}; #${index}`,
                );
                this.storage.clear(
                  roomId,
                  bookmarks[index - 1]?.event_id || "",
                );
              });

            let emojiKey;
            if (SILENT_CHECKMARKS.includes(event?.content?.body?.[0])) {
              emojiKey = "🆓";
            } else {
              this.listBookmarks(roomId);
              emojiKey = "🆗";
            }

            this.client.sendEvent(roomId, "m.reaction", {
              "m.relates_to": {
                rel_type: "m.annotation",
                event_id: event?.event_id,
                key: emojiKey,
              },
            });
          }

          // List bookmarks
          if (
            event.type === "m.room.message" &&
            event?.content?.body?.startsWith("📑")
          ) {
            this.listBookmarks(roomId);
          }
        } catch (e) {
          console.log(e);
        }
      },
    );
  }

  /**
   *
   * @param {string} roomId
   * @param {string} eventId
   * @param {string} excerpt
   */
  async createBookmark(roomId, eventId, excerpt) {
    console.log(`Creating bookmark: ${roomId}:${eventId} - ${excerpt}`);
    this.storage.add(roomId, eventId, { excerpt });

    this.client.sendEvent(roomId, "m.reaction", {
      "m.relates_to": {
        rel_type: "m.annotation",
        event_id: eventId,
        key: "🆗",
      },
    });
  }

  /**
   * @param {string} roomId
   */
  listBookmarks(roomId) {
    const bookmarks = this.storage.list(roomId);
    console.log(`Listing bookmarks:`);
    console.log(bookmarks);
    this.client.sendHtmlText(
      roomId,
      bookmarks.length !== 0
        ? `<b>📚️ Current bookmarks 📚️</b><br/><ol>
            ${bookmarks
              .map(
                ({ excerpt, event_id }) =>
                  `<li>${excerpt} ${messageUrl(roomId, event_id)}</li>`,
              )
              .join("\n")}
            </ol>`
        : `There are no bookmarks! :3`,
    );
  }

  async start() {
    return this.client.start();
  }
}
