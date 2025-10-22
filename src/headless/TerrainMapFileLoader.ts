import { FetchGameMapLoader } from "../core/game/FetchGameMapLoader";

const version = "headless";

export const terrainMapFileLoader = new FetchGameMapLoader(`/maps`, version);
