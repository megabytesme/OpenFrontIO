import { GameView } from "../../../core/game/GameView";
import { Layer } from "./Layer";

export class TerrainLayer implements Layer {
  constructor(private game: GameView) {}

  init() {
    this.sendTerrainData();
  }

  tick() {}

  private sendTerrainData() {
    const terrainData = this.game.tiles().map((tile) => ({
      tile,
      color: this.game
        .config()
        .theme()
        .terrainColor(this.game, tile)
        .toRgbString(),
    }));

    window.chrome.webview.postMessage({
      type: "terrainLayerUpdate",
      payload: {
        width: this.game.width(),
        height: this.game.height(),
        tiles: terrainData,
        backgroundColor: this.game
          .config()
          .theme()
          .backgroundColor()
          .toRgbString(),
      },
    });
  }

  redraw() {
    this.sendTerrainData();
  }
}
