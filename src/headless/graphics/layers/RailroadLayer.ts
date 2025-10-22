import { GameUpdateType, RailroadUpdate } from "../../../core/game/GameUpdates";
import { GameView } from "../../../core/game/GameView";
import { Layer } from "./Layer";

export class RailroadLayer implements Layer {
  private activeRails: Map<number, any> = new Map();
  private lastUpdate = 0;

  constructor(private game: GameView) {}

  init() {}

  tick() {
    const updates = this.game.updatesSinceLastTick();
    updates?.[GameUpdateType.RailroadEvent]?.forEach((railUpdate) => {
      this.handleRailroadUpdate(railUpdate);
    });

    const now = Date.now();
    if (now - this.lastUpdate < 500) {
      return;
    }
    this.lastUpdate = now;

    const railData = Array.from(this.activeRails.values());
    if (railData.length > 0) {
      window.chrome.webview.postMessage({
        type: "railroadLayerUpdate",
        payload: railData,
      });
    }
  }

  private handleRailroadUpdate(railUpdate: RailroadUpdate) {
    for (const rail of railUpdate.railTiles) {
      if (railUpdate.isActive) {
        this.activeRails.set(rail.tile, {
          tile: rail.tile,
          type: rail.railType,
          isWater: this.game.isWater(rail.tile),
          ownerId: this.game.owner(rail.tile)?.id(),
        });
      } else {
        this.activeRails.delete(rail.tile);
      }
    }
  }
}