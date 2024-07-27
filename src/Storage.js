/** @typedef {import("fs/promises").FileHandle} FileHandle */
/** @typedef {import("./types.js").Bookmark} Bookmark */

import { readFileSync, writeFileSync } from "fs";

// Yes, this reads and writes the entire file to disk with every interaction. It's fine
export class Storage {
  /** @type {string} */
  path;

  /** @type {Record<string, Bookmark>} */
  data;

  /**
   *
   * @param {string} path
   */
  constructor(path) {
    this.path = path;
    this.data = JSON.parse(readFileSync(path).toString());
  }

  // Add a bookmark to storage.
  /**
   *
   * @param {string} eventId
   * @param {Bookmark} bookmark
   */
  add(eventId, bookmark) {
    this.data[eventId] = bookmark;
  }

  // List all bookmarks.
  /**
   * @returns {string}
   */
  list() {
    return Object.entries(this.data).reduce(
      (acc, [eventId, { excerpt, sender }]) =>
        `${acc}\n- ${sender}: ${excerpt}`,
      ""
    );
  }

  // Clear a bookmark (mark it as done and remove it from the list)
  /**
   *
   * @param {string} eventId
   */
  clear(eventId) {
    if (eventId in this.data) {
      delete this.data[eventId];
    }
  }
}
