import { EventBus } from "../../../core/EventBus";
import { GameUpdateType } from "../../../core/game/GameUpdates";
import { GameView, UnitView } from "../../../core/game/GameView";
import {
  BuildUnitIntentEvent,
  SendUpgradeStructureIntentEvent,
} from "../../Transport";
import { UIState } from "../UIState";
import { Layer } from "./Layer";
import { UnitType } from "../../../core/game/Game";

export class StructureIconsLayer implements Layer {
  private activeStructures: Map<number, any> = new Map();
  private lastUpdate = 0;

  constructor(
    private game: GameView,
    private eventBus: EventBus,
    public uiState: UIState,
  ) {}

  init() {
  }

  tick() {
    const updates = this.game.updatesSinceLastTick();
    updates?.[GameUpdateType.Unit]?.forEach((u) => {
      const unit = this.game.unit(u.id);
      if (unit) this.handleUnitUpdate(unit);
    });

    const now = Date.now();
    if (now - this.lastUpdate < 250) {
      return;
    }
    this.lastUpdate = now;

    const structureData = Array.from(this.activeStructures.values());
    if (structureData.length > 0 || this.uiState.ghostStructure) {
      window.chrome.webview.postMessage({
        type: "structureIconLayerUpdate",
        payload: {
          structures: structureData,
          ghost: this.uiState.ghostStructure,
        },
      });
    }
  }

  private handleUnitUpdate(unit: UnitView) {
    const isStructure = [
      UnitType.City,
      UnitType.Factory,
      UnitType.DefensePost,
      UnitType.Port,
      UnitType.MissileSilo,
      UnitType.SAMLauncher,
      UnitType.Construction,
    ].includes(unit.type());

    if (unit.isActive() && isStructure) {
      this.activeStructures.set(unit.id(), {
        id: unit.id(),
        type: unit.type(),
        constructionType: unit.constructionType(),
        level: unit.level(),
        ownerId: unit.owner().id(),
        tile: unit.tile(),
        x: this.game.x(unit.tile()),
        y: this.game.y(unit.tile()),
      });
    } else {
      this.activeStructures.delete(unit.id());
    }
  }
}