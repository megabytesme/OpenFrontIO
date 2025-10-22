import { EventBus } from "../../../core/EventBus";
import { Cell } from "../../../core/game/Game";
import { GameView, PlayerView } from "../../../core/game/GameView";
import { TransformHandler } from "../TransformHandler";
import { Layer } from "./Layer";
import { GoToPlayerEvent } from "./HeadlessLeaderboard";

export class NameLayer implements Layer {
  private renders: Map<string, any> = new Map();
  private firstPlaceId: string | null = null;
  private lastPlayerNameUpdate = 0;

  constructor(
    private game: GameView,
    private transformHandler: TransformHandler,
    private eventBus: EventBus,
  ) {}

  public init() {
    this.eventBus.on(GoToPlayerEvent, (e) => this.onGoToPlayer(e));
  }

  public tick() {
    const now = Date.now();
    if (now - this.lastPlayerNameUpdate < 500) {
      return;
    }
    this.lastPlayerNameUpdate = now;

    const sorted = this.game
      .playerViews()
      .sort((a, b) => b.numTilesOwned() - a.numTilesOwned());
    if (sorted.length > 0 && sorted[0].isAlive()) {
      this.firstPlaceId = sorted[0].id();
    } else {
      this.firstPlaceId = null;
    }

    const myPlayer = this.game.myPlayer();
    const nameData = this.game.playerViews().map((player) => {
      if (!player.isAlive() || !player.nameLocation()) {
        this.renders.delete(player.id());
        return null;
      }
      const isFirst = player.id() === this.firstPlaceId;
      const isAlly = myPlayer ? myPlayer.isAlliedWith(player) : false;
      const isRequestingAlliance = myPlayer
        ? player.isRequestingAllianceWith(myPlayer)
        : false;
      const isTarget = myPlayer
        ? new Set(myPlayer.transitiveTargets()).has(player)
        : false;
      const hasEmbargo = myPlayer ? myPlayer.hasEmbargo(player) : false;

      const data = {
        id: player.id(),
        name: player.name(),
        x: player.nameLocation().x,
        y: player.nameLocation().y,
        size: player.nameLocation().size,
        color: player.borderColor().toRgbString(),
        troops: player.troops(),
        isFirst,
        isTraitor: player.isTraitor(),
        isDisconnected: player.isDisconnected(),
        isAlly,
        isRequestingAlliance,
        isTarget,
        hasEmbargo,
      };

      this.renders.set(player.id(), data);
      return data;
    });

    window.chrome.webview.postMessage({
      type: "nameLayerUpdate",
      payload: nameData.filter(Boolean),
    });
  }

  private onGoToPlayer(event: GoToPlayerEvent) {
    const nameLocation = event.player.nameLocation();
    if (nameLocation) {
      this.transformHandler.setTarget(new Cell(nameLocation.x, nameLocation.y));
    }
  }
}