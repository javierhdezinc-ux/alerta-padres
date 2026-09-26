const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("la base original conserva el hash auditado", () => {
  const digest = crypto.createHash("sha256").update(fs.readFileSync(path.join(root, "app.html"))).digest("hex");
  assert.equal(digest, "5f1764b3ed0ffb8352c63e5c7ed1cb93aef1fa00d92fd69a0d41791652d95041");
});

test("la app de desarrollo reutiliza la base protegida y carga la conexión real", () => {
  const html = read("app-dev.html");
  assert.match(html, /<iframe src="app\.html"/);
  assert.match(html, /CANAL REAL · DESARROLLO/);
  assert.match(html, /@supabase\/supabase-js@2\.95\.0/);
  assert.ok(html.indexOf("p2-config.js") < html.indexOf("real-channel.js"));
});

test("el navegador solo contiene una clave publicable", () => {
  const config = read("p2-config.js");
  assert.match(config, /sb_publishable_/);
  assert.doesNotMatch(config, /service_role|sb_secret_/i);
});

test("el canal real no depende de localStorage", () => {
  const client = read("real-channel.js");
  assert.doesNotMatch(client, /localStorage\.(getItem|setItem|removeItem|clear)/);
  assert.match(client, /signInWithPassword/);
  assert.match(client, /from\("messages"\)\.insert/);
  assert.match(client, /from\("message_reads"\)\.upsert/);
  assert.match(client, /postgres_changes/);
});

test("el contenido de mensajes se escapa antes de renderizarse", () => {
  const client = read("real-channel.js");
  assert.match(client, /function escapeHtml/);
  assert.match(client, /escapeHtml\(message\.body\)/);
});
