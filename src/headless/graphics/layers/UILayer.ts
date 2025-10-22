import { EventBus } from "../../../core/EventBus";
import { UnitType } from "../../../core/game/Game";
import { GameUpdateType } from "../../../core/game/GameUpdates";
import { GameView, UnitView } from "../../../core/game/GameView";
import { UnitSelectionEvent } from "../../InputHandler";
import { Layer } from "./Layer";

export class UILayer implements Layer {
  private selectedUnitId: number | null = null;
  private progressBars: Map<number, any> = new Map();

  constructor(
    private game: GameView,
    private eventBus: EventBus,
  ) {}

  init() {
    this.eventBus.on(UnitSelectionEvent, (e) => this.onUnitSelection(e));
  }

  tick() {
    const updates = this.game.updatesSinceLastTick();
    updates?.[GameUpdateType.Unit]
      ?.map((unit) => this.game.unit(unit.id))
      .forEach((unitView) => {
        if (unitView) this.onUnitEvent(unitView);
      });

    this.updateProgressBars();

    const payload = {
      selectedUnitId: this.selectedUnitId,
      progressBars: Array.from(this.progressBars.values()),
    };

    if (payload.progressBars.length > 0 || payload.selectedUnitId !== null) {
      window.chrome.webview.postMessage({
        type: "uiLayerUpdate",
        payload,
      });
    }
  }

  private onUnitSelection(event: UnitSelectionEvent) {
    if (event.isSelected && event.unit) {
      this.selectedUnitId = event.unit.id();
    } else if (this.selectedUnitId === event.unit?.id()) {
      this.selectedUnitId = null;
    }
  }

  private onUnitEvent(unit: UnitView) {
    const isProgressBarUnit = [
      UnitType.Construction,
      UnitType.MissileSilo,
      UnitType.SAMLauncher,
    ].includes(unit.type());

    const isHealthBarUnit = unit.type() === UnitType.Warship;

    if (isProgressBarUnit || isHealthBarUnit) {
      this.updateUnitBar(unit);
    } else {
      this.progressBars.delete(unit.id());
    }
  }

  private updateUnitBar(unit: UnitView) {
    if (!unit.isActive()) {
      this.progressBars.delete(unit.id());
      return;
    }

    let progress = -1;
    let barType: "health" | "loading" = "loading";

    if (unit.type() === UnitType.Warship) {
      const maxHealth = this.game.unitInfo(unit.type()).maxHealth;
      if (maxHealth && unit.health() < maxHealth && unit.health() > 0) {
        progress = unit.health() / maxHealth;
        barType = "health";
      }
    } else {
      progress = this.getProgress(unit);
      barType = "loading";
    }

    if (progress >= 0 && progress < 1) {
      this.progressBars.set(unit.id(), {
        unitId: unit.id(),
        x: this.game.x(unit.tile()),
        y: this.game.y(unit.tile()),
        progress,
        barType,
      });
    } else {
      this.progressBars.delete(unit.id());
    }
  }

  private updateProgressBars() {
    for (const unitId of this.progressBars.keys()) {
      const unit = this.game.unit(unitId);
      if (!unit || !unit.isActive()) {
        this.progressBars.delete(unitId);
        continue;
      }
      this.updateUnitBar(unit);
    }
  }

  private getProgress(unit: UnitView): number {
    switch (unit.type()) {
      case UnitType.Construction: {
        const constructionType = unit.constructionType();
        if (!constructionType) return 1;
        const constDuration =
          this.game.unitInfo(constructionType).constructionDuration ?? 1;
        return (this.game.ticks() - unit.createdAt()) / (constDuration || 1);
      }
      case UnitType.MissileSilo:
      case UnitType.SAMLauncher:
        return unit.missileReadinesss();
      default:
        return 1;
    }
  }
}
