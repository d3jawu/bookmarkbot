import { default as config } from "../config.json" with { type: "json" };
import { MatrixAuth } from "matrix-bot-sdk";

// This will be the URL where clients can reach your homeserver. Note that this might be different
// from where the web/chat interface is hosted. The server must support password registration without
// captcha or terms of service (public servers typically won't work).
const homeserverUrl = config.HOMESERVER_URL;

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error("Usage: node getToken.js <username> <password>");
  process.exit(1);
}

const username = args[0];
const password = args[1];

const auth = new MatrixAuth(homeserverUrl);
const client = await auth.passwordLogin(username, password);

console.log("=".repeat(20));
console.log(
  "Copy this access token to your bot's config: ",
  client.accessToken,
);
console.log("=".repeat(20));
