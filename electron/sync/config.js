/*
 * Where the sync server lives.
 *
 * Left empty until the server (server/, render.yaml) is deployed: with no
 * address here, the sign-in screen asks for one. Once the production
 * server exists, put its https address here and the field is filled in
 * for everyone. FOCUSDOCK_SERVER_URL overrides it for development, e.g.
 *   FOCUSDOCK_SERVER_URL=http://localhost:8080 npm run dev
 */
const DEFAULT_SERVER_URL = "";

function defaultServerUrl(env = process.env) {
  return env.FOCUSDOCK_SERVER_URL || DEFAULT_SERVER_URL;
}

module.exports = { DEFAULT_SERVER_URL, defaultServerUrl };
