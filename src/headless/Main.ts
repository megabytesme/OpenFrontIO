import { generateCryptoRandomUUID } from "./Utils";

// WARNING: DO NOT EXPOSE THIS ID
export function getPersistentID(): string {
  if (typeof localStorage === "undefined") {
    return generateCryptoRandomUUID();
  }

  const COOKIE_NAME = "player_persistent_id";

  const storedId = localStorage.getItem(COOKIE_NAME);
  if (storedId) {
    return storedId;
  }

  const newID = generateCryptoRandomUUID();
  localStorage.setItem(COOKIE_NAME, newID);
  return newID;
}
