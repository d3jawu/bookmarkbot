# Bookmarkbot

A bot for managing bookmarks on Matrix/Element.

## Development

1. Build the image: `just build`
2. Fill out the contents of `config.json`
3. Create an access token (if not already acquired)
   1. Run `just generate-token <username> <password>` to get the access token
   2. Enter it into the `config.json`
4. Run the bot: `just up`
5. Ensure the session is verified
   1. If there was a previous key, remove the `crypto_store` directory for that host
   2. Open the "Sessions" settings in the Element App
   3. Verify the session for the bot (it will show up with a red warning and be a series of letters in all caps)
   4. Restart the bot

## Dump
Previous storage info:

```json
  "STORAGE_PATH": "./store/bookmarks.json",
  "MATRIX_STORAGE_PATH": "./store/.matrix_storage.json",
  "CRYPTO_STORE_PATH": "./store/.crypto_store"
```