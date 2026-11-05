export function loadStartupEnvironment() {
	if (process.env.NODE_ENV === "test") return;
// Keys for paid services live in api/keys.local (gitignored, KEY=value per
// line). The app launches this server with the environment it was opened
// with, so a key added to the shell profile later never reaches it.
try {
	process.loadEnvFile(new URL("../keys.local", import.meta.url).pathname);
} catch {}

}
