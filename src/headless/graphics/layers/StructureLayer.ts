import { GameUpdateType } from "../../../core/game/GameUpdates";
import { GameView, UnitView } from "../../../core/game/GameView";
import { Layer } from "./Layer";
import { UnitType } from "../../../core/game/Game";

export class StructureLayer implements Layer {
  private activeStructures: Map<number, any> = new Map();
  private lastUpdate = 0;

  constructor(private game: GameView) {}

  init() {}

  tick() {
    const updates = this.game.updatesSinceLastTick();
    updates?.[GameUpdateType.Unit]?.forEach((u) => {
      const unit = this.game.unit(u.id);
      if (unit) this.handleUnitUpdate(unit);
    });

    const now = Date.now();
    if (now - this.lastUpdate < 500) {
      return;
    }
    this.lastUpdate = now;

    const structureData = Array.from(this.activeStructures.values());
    if (structureData.length > 0) {
      window.chrome.webview.postMessage({
        type: "structureLayerUpdate",
        payload: structureData,
      });
    }
  }

  private handleUnitUpdate(unit: UnitView) {
    const isSpriteStructure = [
      UnitType.Port,
      UnitType.City,
      UnitType.Factory,
      UnitType.MissileSilo,
      UnitType.DefensePost,
      UnitType.SAMLauncher,
      UnitType.Construction,
    ].includes(unit.type());

    if (unit.isActive() && isSpriteStructure) {
      this.activeStructures.set(unit.id(), {
        id: unit.id(),
        type: unit.type(),
        constructionType: unit.constructionType(),
        ownerId: unit.owner().id(),
        borderColor: unit.owner().borderColor().toRgbString(),
        territoryColor: unit.owner().territoryColor().toRgbString(),
        tile: unit.tile(),
        x: this.game.x(unit.tile()),
        y: this.game.y(unit.tile()),
      });
    } else {
      this.activeStructures.delete(unit.id());
    }
  }
}