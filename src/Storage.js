/** @typedef {import("fs/promises").FileHandle} FileHandle */
/** @typedef {import("./types.js").Bookmark} Bookmark */

import { readFileSync, writeFileSync, statSync, existsSync } from "fs";

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
    if (!existsSync(path)) {
      console.log(`Created store at ${path}.`);
      writeFileSync(path, "{}");
    }

    this.data = JSON.parse(readFileSync(path).toString());
  }

  // Add a bookmark to storage.
  /**
   * @param {string} eventId
   * @param {Bookmark} bookmark
   */
  add(eventId, bookmark) {
    this.data[eventId] = bookmark;
    writeFileSync(this.path, JSON.stringify(this.data));
  }

  // List all bookmarks.
  /**
   * @returns {(Bookmark & {
   *   event_id: string
   * })[]}
   */
  list() {
    return Object.entries(this.data).map(([key, bookmark]) => ({
      event_id: key,
      ...bookmark,
    }));
  }

  // Clear a bookmark (mark it as done and remove it from the list)
  /**
   * @param {string} eventId
   * @returns {boolean}
   */
  clear(eventId) {
    if (!(eventId in this.data)) {
      return false;
    }

    delete this.data[eventId];
    writeFileSync(this.path, JSON.stringify(this.data));

    return true;
  }
}
