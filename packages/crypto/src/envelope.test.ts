import assert from "node:assert/strict";
import { test } from "node:test";

import { blindIndex } from "./blind-index.ts";
import { FieldEncryptor } from "./envelope.ts";
import { LocalKeyProvider, generateKey } from "./key-provider.ts";

const ctx = {
  tenantId: "t_1",
  table: "vendors",
  column: "bank_account",
  id: "v_1",
};

test("round-trips plaintext", async () => {
  const enc = new FieldEncryptor(
    new LocalKeyProvider({ k1: generateKey() }, "k1")
  );
  const token = await enc.encrypt("GB33BUKB20201555555555", ctx);
  assert.ok(FieldEncryptor.isEncrypted(token));
  assert.ok(!token.includes("GB33"));
  assert.equal(await enc.decrypt(token, ctx), "GB33BUKB20201555555555");
});

test("same plaintext encrypts to different ciphertexts", async () => {
  const enc = new FieldEncryptor(
    new LocalKeyProvider({ k1: generateKey() }, "k1")
  );
  assert.notEqual(await enc.encrypt("x", ctx), await enc.encrypt("x", ctx));
});

test("rejects ciphertext moved to another row or tenant", async () => {
  const enc = new FieldEncryptor(
    new LocalKeyProvider({ k1: generateKey() }, "k1")
  );
  const token = await enc.encrypt("secret", ctx);
  await assert.rejects(enc.decrypt(token, { ...ctx, id: "v_2" }));
  await assert.rejects(enc.decrypt(token, { ...ctx, tenantId: "t_2" }));
});

test("rejects tampered ciphertext", async () => {
  const enc = new FieldEncryptor(
    new LocalKeyProvider({ k1: generateKey() }, "k1")
  );
  const parts = (await enc.encrypt("secret", ctx)).split(".");
  const ct = Buffer.from(parts[6]!, "base64url");
  ct[0] = ct[0]! ^ 1;
  parts[6] = ct.toString("base64url");
  await assert.rejects(enc.decrypt(parts.join("."), ctx));
});

test("old data stays readable after KEK rotation", async () => {
  const k1 = generateKey();
  const before = new FieldEncryptor(new LocalKeyProvider({ k1 }, "k1"));
  const token = await before.encrypt("secret", ctx);

  const after = new FieldEncryptor(
    new LocalKeyProvider({ k1, k2: generateKey() }, "k2")
  );
  assert.equal(await after.decrypt(token, ctx), "secret");
  assert.equal(FieldEncryptor.keyIdOf(token), "k1");
  assert.equal(
    FieldEncryptor.keyIdOf(await after.encrypt("secret", ctx)),
    "k2"
  );
});

test("blind index is deterministic, normalized and tenant-scoped", () => {
  const key = generateKey();
  assert.equal(
    blindIndex(" 12-3456789 ", key, "t_1"),
    blindIndex("12-3456789", key, "t_1")
  );
  assert.notEqual(
    blindIndex("12-3456789", key, "t_1"),
    blindIndex("12-3456789", key, "t_2")
  );
});
