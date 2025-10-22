import { EventBus, GameEvent } from "../../../core/EventBus";
import { GameView, PlayerView, UnitView } from "../../../core/game/GameView";
import { renderNumber, renderTroops } from "../../Utils";
import { Layer } from "./Layer";

export class GoToPlayerEvent implements GameEvent {
  constructor(public player: PlayerView) {}
}
export class GoToPositionEvent implements GameEvent {
  constructor(public x: number, public y: number) {}
}
export class GoToUnitEvent implements GameEvent {
  constructor(public unit: UnitView) {}
}

export class HeadlessLeaderboard implements Layer {
  private lastUpdate = 0;

  constructor(
    public game: GameView,
    public eventBus: EventBus,
  ) {}

  init() {}

  tick() {
    const now = Date.now();
    if (now - this.lastUpdate < 1000) return;
    this.lastUpdate = now;

    this.updateLeaderboard();
  }

  private updateLeaderboard() {
    const myPlayer = this.game.myPlayer();
    const sorted = this.game
      .playerViews()
      .sort((a, b) => b.numTilesOwned() - a.numTilesOwned());

    const numTilesWithoutFallout = this.game.numLandTiles() - this.game.numTilesWithFallout();
    const alivePlayers = sorted.filter((p) => p.isAlive());

    const leaderboardData = alivePlayers.map((player, index) => ({
      id: player.id(),
      name: player.displayName(),
      position: index + 1,
      score: ((player.numTilesOwned() / numTilesWithoutFallout) * 100).toFixed(1) + "%",
      gold: renderNumber(player.gold()),
      troops: renderTroops(player.troops()),
      isMyPlayer: player === myPlayer,
    }));

    window.chrome.webview.postMessage({
      type: "leaderboardUpdate",
      payload: leaderboardData,
    });
  }
}