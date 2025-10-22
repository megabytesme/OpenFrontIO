import { EventBus } from "../../core/EventBus";
import { GameView } from "../../core/game/GameView";
import { UserSettings } from "../../core/game/UserSettings";
import { RefreshGraphicsEvent } from "../InputHandler";
import { UIState } from "./UIState";
import { FxLayer } from "./layers/FxLayer";
import { HeadlessLeaderboard } from "./layers/HeadlessLeaderboard";
import { Layer } from "./layers/Layer";
import { NameLayer } from "./layers/NameLayer";
import { RailroadLayer } from "./layers/RailroadLayer";
import { SpawnTimer } from "./layers/SpawnTimer";
import { StructureIconsLayer } from "./layers/StructureIconsLayer";
import { StructureLayer } from "./layers/StructureLayer";
import { TerrainLayer } from "./layers/TerrainLayer";
import { TerritoryLayer } from "./layers/TerritoryLayer";
import { UILayer } from "./layers/UILayer";
import { UnitLayer } from "./layers/UnitLayer";

export function createRenderer(
  game: GameView,
  eventBus: EventBus,
): GameRenderer {
  const userSettings = new UserSettings();
  const uiState: UIState = { attackRatio: 0.2, ghostStructure: null };

  const layers: Layer[] = [
    new TerrainLayer(game),
    new TerritoryLayer(game, eventBus, null as any, userSettings),
    new RailroadLayer(game),
    new StructureLayer(game),
    new UnitLayer(game, eventBus, null as any),
    new FxLayer(game),
    new UILayer(game, eventBus),
    new StructureIconsLayer(game, eventBus, uiState),
    new NameLayer(game, null as any, eventBus),
    new SpawnTimer(game),
    new HeadlessLeaderboard(game, eventBus),
  ];

  return new GameRenderer(game, eventBus, null as any, layers, uiState);
}

export class GameRenderer {
  constructor(
    private game: GameView,
    private eventBus: EventBus,
    public transformHandler: any,
    private layers: Layer[],
    public uiState: UIState,
  ) {}

  initialize() {
    this.eventBus.on(RefreshGraphicsEvent, () => this.redraw());
    this.layers.forEach((l) => l.init?.());
    setInterval(() => this.tickLoop(), 100);
  }

  redraw() {
    this.layers.forEach((l) => {
      if ("redraw" in l && typeof l.redraw === "function") {
        l.redraw();
      }
    });
  }

  tickLoop() {
    this.layers.forEach((l) => l.tick?.());
  }
}
