/** @typedef {import("fs/promises").FileHandle} FileHandle */
/** @typedef {import("./types.js").Bookmark} Bookmark */

import { readFileSync, writeFileSync, statSync, existsSync } from "fs";

// Yes, this reads and writes the entire file to disk with every interaction. It's fine, it's fine
export class Storage {
  /** @type {string} */
  path;

  // Data is keyed by event ID for easy deletion.
  /** @type {Record<string, Record<string, Bookmark>>} */
  data;

  /**
   *
   * @param {string} path
   */
  constructor(path) {
    this.path = path;
    if (!existsSync(path)) {
      writeFileSync(path, "{}");
    }

    this.data = JSON.parse(readFileSync(path).toString());
  }

  // Add a bookmark to storage.
  /**
   * @param {string} roomId
   * @param {string} eventId
   * @param {Bookmark} bookmark
   */
  add(roomId, eventId, bookmark) {
    if (!this.data[roomId]) {
      this.data[roomId] = {};
    }

    this.data[roomId][eventId] = bookmark;
    writeFileSync(this.path, JSON.stringify(this.data));
  }

  // List all bookmarks.
  /**
   * @param {string} roomId
   * @returns {(Bookmark & {
   *   event_id: string
   * })[]}
   */
  list(roomId) {
    return Object.entries(this.data[roomId] || {}).map(([key, bookmark]) => ({
      event_id: key,
      ...bookmark,
    }));
  }

  // Clear a bookmark (mark it as done and remove it from the list)
  /**
   * @param {string} roomId
   * @param {string} eventId
   * @returns {boolean}
   */
  clear(roomId, eventId) {
    if (!this.data[roomId]) {
      return false;
    }

    delete this.data[roomId][eventId];
    writeFileSync(this.path, JSON.stringify(this.data));

    return true;
  }
}
