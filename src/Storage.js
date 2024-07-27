/** @typedef {import("fs/promises").FileHandle} FileHandle */
/** @typedef {import("./types.js").Bookmark} Bookmark */

import { readFileSync, writeFileSync, statSync } from "fs";

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
   *
   * @param {string} eventId
   * @param {Bookmark} bookmark
   */
  add(eventId, bookmark) {
    this.data[eventId] = bookmark;
    writeFileSync(this.path, JSON.stringify(this.data));
  }

  // List all bookmarks.
  /**
   * @returns {Bookmark[]}
   */
  list() {
    return Object.values(this.data);
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
    writeFileSync(this.path, JSON.stringify(this.data));
  }
}
