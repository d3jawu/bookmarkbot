# Bookmarkbot

A bot for managing bookmarks on Matrix/Element.

## Development

1. Build the image: `just build`
2. Fill out the contents of `config.json`
3. Create an access token (if not already acquired)
   1. Enter your username and password in `getToken.js`
   2. Run `just run node scripts/getToken.js` to get the access token
   3. Enter it into the `config.json`
4. Run the bot: `just up`
