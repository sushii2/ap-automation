// Prints a fresh dev keyring + blind index key for .env.local. Never use in production.
import { generateKey } from "../src/key-provider.ts";

const id = `dev-${new Date().toISOString().slice(0, 10)}`;
console.log(`ENCRYPTION_PROVIDER=local`);
console.log(`ENCRYPTION_ACTIVE_KEY_ID=${id}`);
console.log(`ENCRYPTION_KEYRING='${JSON.stringify({ [id]: generateKey() })}'`);
console.log(`BLIND_INDEX_KEY=${generateKey()}`);
