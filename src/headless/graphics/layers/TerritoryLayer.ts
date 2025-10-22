import { EventBus } from "../../../core/EventBus";
import { UnitType } from "../../../core/game/Game";
import { GameUpdateType } from "../../../core/game/GameUpdates";
import { GameView, PlayerView } from "../../../core/game/GameView";
import { UserSettings } from "../../../core/game/UserSettings";
import { AlternateViewEvent, MouseMoveEvent } from "../../InputHandler";
import { TransformHandler } from "../TransformHandler";
import { Layer } from "./Layer";

export class TerritoryLayer implements Layer {
  private tilesToUpdate: Set<number> = new Set();
  private alternateView = false;
  private lastMousePosition: { x: number; y: number } | null = null;
  private highlightedTerritoryId: string | null = null;

  constructor(
    private game: GameView,
    private eventBus: EventBus,
    private transformHandler: TransformHandler,
    private userSettings: UserSettings,
  ) {}

  init() {
    this.eventBus.on(
      AlternateViewEvent,
      (e) => (this.alternateView = e.alternateView),
    );
    this.eventBus.on(MouseMoveEvent, (e) => this.onMouseMove(e));
    this.game.forEachTile((t) => this.tilesToUpdate.add(t));
  }

  tick() {
    this.game.recentlyUpdatedTiles().forEach((t) => this.tilesToUpdate.add(t));
    const updates = this.game.updatesSinceLastTick();
    if (
      updates?.[GameUpdateType.BrokeAlliance]?.length ||
      updates?.[GameUpdateType.AllianceRequestReply]?.length ||
      updates?.[GameUpdateType.EmbargoEvent]?.length
    ) {
      this.game.forEachTile((t) => this.tilesToUpdate.add(t));
    }
    this.sendUpdates();
  }

  private onMouseMove(event: MouseMoveEvent) {
    this.lastMousePosition = { x: event.x, y: event.y };
    this.updateHighlightedTerritory();
  }

  private updateHighlightedTerritory() {
    if (!this.alternateView || !this.lastMousePosition) {
      if (this.highlightedTerritoryId) {
        this.highlightedTerritoryId = null;
        this.game.forEachTile((t) => this.tilesToUpdate.add(t));
      }
      return;
    }

    const cell = this.transformHandler.screenToWorldCoordinates(
      this.lastMousePosition.x,
      this.lastMousePosition.y,
    );
    if (!this.game.isValidCoord(cell.x, cell.y)) return;

    const tile = this.game.ref(cell.x, cell.y);
    const owner = this.game.hasOwner(tile) ? this.game.owner(tile) : null;
    const newHighlightId = owner instanceof PlayerView ? owner.id() : null;

    if (this.highlightedTerritoryId !== newHighlightId) {
      this.highlightedTerritoryId = newHighlightId;
      this.game.forEachTile((t) => this.tilesToUpdate.add(t));
    }
  }

  private sendUpdates() {
    if (this.tilesToUpdate.size === 0) return;

    const payload = Array.from(this.tilesToUpdate).map((tile) => {
      const owner = this.game.hasOwner(tile)
        ? (this.game.owner(tile) as PlayerView)
        : null;
      let color: string | null = null;
      let alpha = 0;
      let isBorder = this.game.isBorder(tile);

      if (owner) {
        if (this.alternateView) {
          if (isBorder) {
            const myPlayer = this.game.myPlayer();
            alpha = 1.0;
            if (!myPlayer)
              color = this.game.config().theme().neutralColor().toRgbString();
            else if (owner.id() === myPlayer.id())
              color = this.game.config().theme().selfColor().toRgbString();
            else if (owner.isFriendly(myPlayer))
              color = this.game.config().theme().allyColor().toRgbString();
            else if (!owner.hasEmbargo(myPlayer))
              color = this.game.config().theme().neutralColor().toRgbString();
            else color = this.game.config().theme().enemyColor().toRgbString();
          }
        } else {
          if (isBorder) {
            const isDefended = this.game.hasUnitNearby(
              tile,
              this.game.config().defensePostRange(),
              UnitType.DefensePost,
              owner.id(),
            );
            color = owner.borderColor(tile, isDefended).toRgbString();
            alpha = 1.0;
          } else {
            color = owner.territoryColor(tile).toRgbString();
            alpha = 0.6;
          }
        }
      } else if (this.game.hasFallout(tile)) {
        color = this.game.config().theme().falloutColor().toRgbString();
        alpha = 0.6;
      }

      return { tile, color, alpha };
    });

    window.chrome.webview.postMessage({
      type: "territoryLayerUpdate",
      payload,
    });

    this.tilesToUpdate.clear();
  }
}
