import { EventBus } from "../../../core/EventBus";
import { GameUpdateType } from "../../../core/game/GameUpdates";
import { GameView, UnitView } from "../../../core/game/GameView";
import { AlternateViewEvent, MouseUpEvent, UnitSelectionEvent } from "../../InputHandler";
import { MoveWarshipIntentEvent } from "../../Transport";
import { TransformHandler } from "../TransformHandler";
import { Layer } from "./Layer";
import { UnitType } from "../../../core/game/Game";

export class UnitLayer implements Layer {
  private activeUnits: Map<number, any> = new Map();
  private selectedUnitId: number | null = null;
  private alternateView = false;
  private lastUpdate = 0;

  constructor(
    private game: GameView,
    private eventBus: EventBus,
    private transformHandler: TransformHandler,
  ) {}

  init() {
    this.eventBus.on(AlternateViewEvent, (e) => (this.alternateView = e.alternateView));
    this.eventBus.on(MouseUpEvent, (e) => this.onMouseUp(e));
    this.eventBus.on(UnitSelectionEvent, (e) => this.onUnitSelectionChange(e));
  }

  tick() {
    const updates = this.game.updatesSinceLastTick();
    updates?.[GameUpdateType.Unit]?.forEach((u) => {
      const unit = this.game.unit(u.id);
      this.handleUnitUpdate(unit);
    });

    const now = Date.now();
    if(now - this.lastUpdate < 100) return;
    this.lastUpdate = now;

    const unitData = Array.from(this.activeUnits.values());
    if(unitData.length > 0) {
      window.chrome.webview.postMessage({
          type: "unitLayerUpdate",
          payload: unitData,
      });
    }
  }

  private handleUnitUpdate(unit: UnitView | undefined) {
    if (!unit) return;

    if (unit.isActive()) {
      this.activeUnits.set(unit.id(), {
        id: unit.id(),
        type: unit.type(),
        ownerId: unit.owner().id(),
        tile: unit.tile(),
        lastTile: unit.lastTile(),
        x: this.game.x(unit.tile()),
        y: this.game.y(unit.tile()),
        targetUnitId: unit.targetUnitId(),
        isLoaded: unit.isLoaded(),
        trainType: unit.trainType(),
      });
    } else {
      this.activeUnits.delete(unit.id());
    }
  }
  
  private findWarshipsNearCell(cell: { x: number; y: number }): UnitView[] {
    if (!this.game.isValidCoord(cell.x, cell.y)) return [];
    const clickRef = this.game.ref(cell.x, cell.y);
    const radius = 10;
    
    return this.game
      .units(UnitType.Warship)
      .filter(
        (unit) =>
          unit.isActive() &&
          unit.owner() === this.game.myPlayer() &&
          this.game.manhattanDist(unit.tile(), clickRef) <= radius,
      )
      .sort((a, b) => {
        const distA = this.game.manhattanDist(a.tile(), clickRef);
        const distB = this.game.manhattanDist(b.tile(), clickRef);
        return distA - distB;
      });
  }

  private onMouseUp(event: MouseUpEvent) {
    const cell = this.transformHandler.screenToWorldCoordinates(event.x, event.y);
    const nearbyWarships = this.findWarshipsNearCell(cell);

    if (this.selectedUnitId) {
        const selectedUnit = this.game.unit(this.selectedUnitId);
        if(selectedUnit) {
            const clickRef = this.game.ref(cell.x, cell.y);
            if (this.game.isOcean(clickRef)) {
                this.eventBus.emit(new MoveWarshipIntentEvent(this.selectedUnitId, clickRef));
            }
            this.eventBus.emit(new UnitSelectionEvent(selectedUnit, false));
        }
    } else if (nearbyWarships.length > 0) {
      this.eventBus.emit(new UnitSelectionEvent(nearbyWarships[0], true));
    }
  }

  private onUnitSelectionChange(event: UnitSelectionEvent) {
    if (event.isSelected && event.unit) {
      this.selectedUnitId = event.unit.id();
    } else if (this.selectedUnitId === event.unit?.id()) {
      this.selectedUnitId = null;
    }
  }
}