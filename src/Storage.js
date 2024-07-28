/** @typedef {import("fs/promises").FileHandle} FileHandle */
/** @typedef {import("./types.js").Bookmark} Bookmark */

import { readFileSync, writeFileSync, statSync } from "fs";

/**
 * @param {string} roomId
 * @param {string} eventId
 * @returns {string}
 */
const bookmarkKey = (roomId, eventId) => `${roomId}|${eventId}`;

// Yes, this reads and writes the entire file to disk with every interaction. It's fine, it's fine
export class Storage {
  /** @type {string} */
  path;

  // Data is keyed by event ID for easy deletion.
  /** @type {Record<string, Bookmark>} */
  data;

  /**
   *
   * @param {string} path
   */
  constructor(path) {
    this.path = path;
    // TODO create if doesn't exist
    this.data = JSON.parse(readFileSync(path).toString());
  }

  // Add a bookmark to storage.
  /**
   * @param {string} roomId
   * @param {string} eventId
   * @param {Bookmark} bookmark
   */
  add(roomId, eventId, bookmark) {
    this.data[bookmarkKey(roomId, eventId)] = bookmark;
    writeFileSync(this.path, JSON.stringify(this.data));
  }

  // List all bookmarks.
  /**
   * @returns {(Bookmark & {
   *   event_id: string
   *   room_id: string
   * })[]}
   */
  list() {
    return Object.entries(this.data).map(([key, bookmark]) => ({
      room_id: key.split("|")[0] || "",
      event_id: key.split("|")[1] || "",
      ...bookmark,
    }));
  }

  // Clear a bookmark (mark it as done and remove it from the list)
  /**
   * @param {string} roomId
   * @param {string} eventId
   */
  clear(roomId, eventId) {
    if (bookmarkKey(roomId, eventId) in this.data) {
      delete this.data[bookmarkKey(roomId, eventId)];
    }
    writeFileSync(this.path, JSON.stringify(this.data));
  }
}
