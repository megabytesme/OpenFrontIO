import { GameMode, Team } from "../../../core/game/Game";
import { GameView } from "../../../core/game/GameView";
import { Layer } from "./Layer";

export class SpawnTimer implements Layer {
  private lastUpdate = 0;

  constructor(private game: GameView) {}

  init() {}

  tick() {
    const now = Date.now();
    if (now - this.lastUpdate < 200) {
      return;
    }
    this.lastUpdate = now;

    let ratios: number[] = [];
    let colors: string[] = [];

    if (this.game.inSpawnPhase()) {
      ratios = [this.game.ticks() / this.game.config().numSpawnPhaseTurns()];
      colors = ["rgba(0, 128, 255, 0.7)"];
    } else if (this.game.config().gameConfig().gameMode === GameMode.Team) {
      const teamTiles: Map<Team, number> = new Map();
      for (const player of this.game.players()) {
        const team = player.team();
        if (team === null) continue;
        const tiles = teamTiles.get(team) ?? 0;
        teamTiles.set(team, tiles + player.numTilesOwned());
      }

      const theme = this.game.config().theme();
      const total = Array.from(teamTiles.values()).reduce((a, b) => a + b, 0);
      if (total === 0) return;

      for (const [team, count] of teamTiles) {
        ratios.push(count / total);
        colors.push(theme.teamColor(team).toRgbString());
      }
    }

    if (ratios.length > 0) {
      window.chrome.webview.postMessage({
        type: "spawnTimerUpdate",
        payload: { ratios, colors },
      });
    }
  }
}