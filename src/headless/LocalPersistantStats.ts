import { GameConfig, GameID, PartialGameRecord } from "../core/Schemas";
import { replacer } from "../core/Util";

export interface LocalStatsData {
  [key: GameID]: {
    lobby: Partial<GameConfig>;
    gameRecord?: PartialGameRecord;
  };
}

let _startTime: number;

function getStats(): LocalStatsData {
  const statsStr = localStorage.getItem("game-records");
  return statsStr ? JSON.parse(statsStr) : {};
}

function save(stats: LocalStatsData) {
  setTimeout(
    () => localStorage.setItem("game-records", JSON.stringify(stats, replacer)),
    0,
  );
}

export function startGame(id: GameID, lobby: Partial<GameConfig>) {
  if (typeof localStorage === 'undefined') return;
  _startTime = Date.now();
  const stats = getStats();
  stats[id] = { lobby };
  save(stats);
}

export function startTime() {
  return _startTime;
}

export function endGame(gameRecord: PartialGameRecord) {
  if (typeof localStorage === 'undefined') return;
  const stats = getStats();
  const gameStat = stats[gameRecord.info.gameID];
  if (!gameStat) return;
  gameStat.gameRecord = gameRecord;
  save(stats);
}