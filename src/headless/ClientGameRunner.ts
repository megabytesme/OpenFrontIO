import { EventBus } from "../core/EventBus";
import {
  ClientID,
  GameID,
  GameRecord,
  GameStartInfo,
  PlayerCosmeticRefs,
  PlayerRecord,
  ServerMessage,
} from "../core/Schemas";
import { createPartialGameRecord } from "../core/Util";
import { ServerConfig } from "../core/configuration/Config";
import {
  getConfig,
  getServerConfigFromClient,
} from "../core/configuration/ConfigLoader";
import { PlayerActions, UnitType } from "../core/game/Game";
import { TileRef } from "../core/game/GameMap";
import { GameMapLoader } from "../core/game/GameMapLoader";
import {
  ErrorUpdate,
  GameUpdateType,
  GameUpdateViewData,
  HashUpdate,
  WinUpdate,
} from "../core/game/GameUpdates";
import { GameView, PlayerView } from "../core/game/GameView";
import { loadTerrainMap, TerrainMapData } from "../core/game/TerrainMapLoader";
import { UserSettings } from "../core/game/UserSettings";
import { WorkerClient } from "../core/worker/WorkerClient";
import {
  AutoUpgradeEvent,
  DoBoatAttackEvent,
  DoGroundAttackEvent,
  MouseMoveEvent,
  MouseUpEvent,
} from "./InputHandler";
import { endGame, startGame, startTime } from "./LocalPersistantStats";
import { getPersistentID } from "./Main";
import { terrainMapFileLoader } from "./TerrainMapFileLoader";
import {
  SendAttackIntentEvent,
  SendBoatAttackIntentEvent,
  SendHashEvent,
  SendSpawnIntentEvent,
  SendUpgradeStructureIntentEvent,
  Transport,
} from "./Transport";
import { createRenderer, GameRenderer } from "./graphics/GameRenderer";
import SoundManager from "./sound/SoundManager";

export interface LobbyConfig {
  serverConfig?: ServerConfig;
  cosmetics: PlayerCosmeticRefs;
  playerName: string;
  clientID: ClientID;
  gameID: GameID;
  token: string;
  gameStartInfo?: GameStartInfo;
  gameRecord?: GameRecord;
}

export async function joinLobby(
  eventBus: EventBus,
  lobbyConfig: LobbyConfig,
  onPrestart: () => void,
  onJoin: () => void,
): Promise<() => void> {
  startGame(lobbyConfig.gameID, lobbyConfig.gameStartInfo?.config ?? {});

  if (!lobbyConfig.serverConfig) {
    lobbyConfig.serverConfig = await getServerConfigFromClient();
  }

  const transport = new Transport(
    lobbyConfig as Required<LobbyConfig>,
    eventBus,
  );

  const onconnect = () => {
    transport.joinGame(0);
  };
  let terrainLoad: Promise<TerrainMapData> | null = null;

  const onmessage = (message: ServerMessage) => {
    if (message.type === "prestart") {
      terrainLoad = loadTerrainMap(
        message.gameMap,
        message.gameMapSize,
        terrainMapFileLoader,
      );
      onPrestart();
    }
    if (message.type === "start") {
      onPrestart();
      onJoin();
      lobbyConfig.gameStartInfo = message.gameStartInfo;
      createClientGame(
        lobbyConfig as Required<LobbyConfig>,
        eventBus,
        transport,
        new UserSettings(),
        terrainLoad,
        terrainMapFileLoader,
      ).then((r) => r.start());
    }
    if (message.type === "error") {
      window.chrome.webview.postMessage({
        type: "error",
        payload: {
          title: "Connection Error",
          message: `Error: ${message.error}\nMessage: ${message.message}`,
        },
      });
    }
  };

  transport.connect(onconnect, onmessage);

  return () => {
    transport.leaveGame();
  };
}

async function createClientGame(
  lobbyConfig: LobbyConfig,
  eventBus: EventBus,
  transport: Transport,
  userSettings: UserSettings,
  terrainLoad: Promise<TerrainMapData> | null,
  mapLoader: GameMapLoader,
): Promise<ClientGameRunner> {
  if (lobbyConfig.gameStartInfo === undefined)
    throw new Error("missing gameStartInfo");

  const config = await getConfig(
    lobbyConfig.gameStartInfo.config,
    userSettings,
    lobbyConfig.gameRecord !== undefined,
  );

  const gameMap = terrainLoad
    ? await terrainLoad
    : await loadTerrainMap(
        lobbyConfig.gameStartInfo.config.gameMap,
        lobbyConfig.gameStartInfo.config.gameMapSize,
        mapLoader,
      );

  const worker = new WorkerClient(
    lobbyConfig.gameStartInfo,
    lobbyConfig.clientID,
  );
  await worker.initialize();

  const gameView = new GameView(
    worker,
    config,
    gameMap,
    lobbyConfig.clientID,
    lobbyConfig.gameStartInfo.gameID,
    lobbyConfig.gameStartInfo.players,
  );
  const gameRenderer = createRenderer(gameView, eventBus);

  return new ClientGameRunner(
    lobbyConfig,
    eventBus,
    gameRenderer,
    transport,
    worker,
    gameView,
  );
}

export class ClientGameRunner {
  private myPlayer: PlayerView | null = null;
  private isActive = false;
  private turnsSeen = 0;
  private hasJoined = false;
  private lastMousePosition: { x: number; y: number } | null = null;
  private lastMessageTime: number = 0;
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private lobby: LobbyConfig,
    private eventBus: EventBus,
    private renderer: GameRenderer,
    private transport: Transport,
    private worker: WorkerClient,
    private gameView: GameView,
  ) {
    this.lastMessageTime = Date.now();
  }

  private saveGame(update: WinUpdate) {
    if (!this.myPlayer) return;
    const players: PlayerRecord[] = [
      {
        persistentID: getPersistentID(),
        username: this.lobby.playerName,
        clientID: this.lobby.clientID,
        stats: update.allPlayersStats[this.lobby.clientID],
      },
    ];
    if (!this.lobby.gameStartInfo) throw new Error("missing gameStartInfo");
    const record = createPartialGameRecord(
      this.lobby.gameStartInfo.gameID,
      this.lobby.gameStartInfo.config,
      players,
      [],
      startTime(),
      Date.now(),
      update.winner,
    );
    endGame(record);
  }

  public start() {
    SoundManager.playBackgroundMusic();
    this.isActive = true;
    this.lastMessageTime = Date.now();
    setTimeout(() => {
      this.connectionCheckInterval = setInterval(
        () => this.onConnectionCheck(),
        1000,
      );
    }, 20000);

    this.eventBus.on(MouseUpEvent, this.inputEvent.bind(this));
    this.eventBus.on(MouseMoveEvent, this.onMouseMove.bind(this));
    this.eventBus.on(AutoUpgradeEvent, this.autoUpgradeEvent.bind(this));
    this.eventBus.on(
      DoBoatAttackEvent,
      this.doBoatAttackUnderCursor.bind(this),
    );
    this.eventBus.on(
      DoGroundAttackEvent,
      this.doGroundAttackUnderCursor.bind(this),
    );

    this.renderer.initialize();

    this.worker.start((gu: GameUpdateViewData | ErrorUpdate) => {
      if ("errMsg" in gu) {
        window.chrome.webview.postMessage({
          type: "error",
          payload: { title: "Game Error", message: gu.errMsg, stack: gu.stack },
        });
        this.stop();
        return;
      }
      this.transport.turnComplete();
      gu.updates[GameUpdateType.Hash].forEach((hu: HashUpdate) => {
        this.eventBus.emit(new SendHashEvent(hu.tick, hu.hash));
      });
      this.gameView.update(gu);
      this.renderer.tickLoop();

      if (gu.updates[GameUpdateType.Win].length > 0) {
        this.saveGame(gu.updates[GameUpdateType.Win][0]);
      }
    });

    const onconnect = () => this.transport.joinGame(this.turnsSeen);
    const onmessage = (message: ServerMessage) => {
      this.lastMessageTime = Date.now();
      if (message.type === "start") {
        this.hasJoined = true;
        message.turns.forEach((turn) => {
          if (turn.turnNumber >= this.turnsSeen) {
            while (turn.turnNumber - 1 > this.turnsSeen) {
              this.worker.sendTurn({
                turnNumber: this.turnsSeen++,
                intents: [],
              });
            }
            this.worker.sendTurn(turn);
            this.turnsSeen++;
          }
        });
      } else if (message.type === "desync") {
        window.chrome.webview.postMessage({
          type: "error",
          payload: { title: "Desync Error", message: JSON.stringify(message) },
        });
      } else if (message.type === "error") {
        window.chrome.webview.postMessage({
          type: "error",
          payload: {
            title: "Connection Error",
            message: `Error: ${message.error}\nMessage: ${message.message}`,
          },
        });
      } else if (message.type === "turn") {
        if (!this.hasJoined) {
          this.transport.joinGame(0);
          return;
        }
        if (this.turnsSeen === message.turn.turnNumber) {
          this.worker.sendTurn(message.turn);
          this.turnsSeen++;
        }
      }
    };
    this.transport.connect(onconnect, onmessage);
  }

  public stop() {
    SoundManager.stopBackgroundMusic();
    if (!this.isActive) return;
    this.isActive = false;
    this.worker.cleanup();
    this.transport.leaveGame();
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  private inputEvent(event: MouseUpEvent) {
    if (!this.isActive || this.renderer.uiState.ghostStructure !== null) return;
    const cell = this.renderer.transformHandler.screenToWorldCoordinates(
      event.x,
      event.y,
    );
    if (!this.gameView.isValidCoord(cell.x, cell.y)) return;
    const tile = this.gameView.ref(cell.x, cell.y);
    if (!this.gameView.hasOwner(tile) && this.gameView.inSpawnPhase()) {
      this.eventBus.emit(new SendSpawnIntentEvent(tile));
      return;
    }
    if (this.gameView.inSpawnPhase()) return;
    const myPlayer = this.gameView.myPlayer();
    if (!myPlayer) return;
    this.myPlayer = myPlayer;

    myPlayer.actions(tile).then((actions) => {
      if (!this.myPlayer) return;
      if (actions.canAttack) {
        this.eventBus.emit(
          new SendAttackIntentEvent(
            this.gameView.owner(tile).id(),
            this.myPlayer.troops() * this.renderer.uiState.attackRatio,
          ),
        );
      } else if (this.canAutoBoat(actions, tile)) {
        this.sendBoatAttackIntent(tile);
      }
    });
  }

  private autoUpgradeEvent(event: AutoUpgradeEvent) {
    if (!this.isActive) return;
    const cell = this.renderer.transformHandler.screenToWorldCoordinates(
      event.x,
      event.y,
    );
    if (!this.gameView.isValidCoord(cell.x, cell.y)) return;
    const tile = this.gameView.ref(cell.x, cell.y);
    if (this.gameView.inSpawnPhase()) return;
    this.findAndUpgradeNearestBuilding(tile);
  }

  private findAndUpgradeNearestBuilding(clickedTile: TileRef) {
    this.myPlayer?.actions(clickedTile).then((actions) => {
      const upgradeUnits = actions.buildableUnits
        .filter((bu) => bu.canUpgrade !== false)
        .map((bu) => {
          const unit = this.gameView
            .units()
            .find((u) => u.id() === bu.canUpgrade);
          return unit
            ? {
                unitId: bu.canUpgrade as number,
                unitType: bu.type,
                distance: this.gameView.manhattanDist(clickedTile, unit.tile()),
              }
            : null;
        })
        .filter(
          (u): u is { unitId: number; unitType: UnitType; distance: number } =>
            u !== null,
        )
        .sort((a, b) => a.distance - b.distance);

      if (upgradeUnits.length > 0) {
        this.eventBus.emit(
          new SendUpgradeStructureIntentEvent(
            upgradeUnits[0].unitId,
            upgradeUnits[0].unitType,
          ),
        );
      }
    });
  }

  private doBoatAttackUnderCursor(): void {
    const tile = this.getTileUnderCursor();
    if (!tile) return;
    this.myPlayer?.actions(tile).then((actions) => {
      if (this.canBoatAttack(actions) !== false)
        this.sendBoatAttackIntent(tile);
    });
  }

  private doGroundAttackUnderCursor(): void {
    const tile = this.getTileUnderCursor();
    if (!tile) return;
    this.myPlayer?.actions(tile).then((actions) => {
      if (this.myPlayer && actions.canAttack) {
        this.eventBus.emit(
          new SendAttackIntentEvent(
            this.gameView.owner(tile).id(),
            this.myPlayer.troops() * this.renderer.uiState.attackRatio,
          ),
        );
      }
    });
  }

  private getTileUnderCursor(): TileRef | null {
    if (
      !this.isActive ||
      !this.lastMousePosition ||
      this.gameView.inSpawnPhase()
    )
      return null;
    const cell = this.renderer.transformHandler.screenToWorldCoordinates(
      this.lastMousePosition.x,
      this.lastMousePosition.y,
    );
    if (!this.gameView.isValidCoord(cell.x, cell.y)) return null;
    return this.gameView.ref(cell.x, cell.y);
  }

  private canBoatAttack(actions: PlayerActions): false | TileRef {
    return (
      actions.buildableUnits.find((bu) => bu.type === UnitType.TransportShip)
        ?.canBuild ?? false
    );
  }

  private sendBoatAttackIntent(tile: TileRef) {
    if (!this.myPlayer) return;
    this.myPlayer.bestTransportShipSpawn(tile).then((spawn) => {
      if (!this.myPlayer) return;
      this.eventBus.emit(
        new SendBoatAttackIntentEvent(
          this.gameView.owner(tile).id(),
          tile,
          this.myPlayer.troops() * this.renderer.uiState.attackRatio,
          spawn === false ? null : spawn,
        ),
      );
    });
  }

  private canAutoBoat(actions: PlayerActions, tile: TileRef): boolean {
    if (!this.gameView.isLand(tile)) return false;
    const canBuild = this.canBoatAttack(actions);
    if (canBuild === false) return false;
    const distanceSquared = this.gameView.euclideanDistSquared(tile, canBuild);
    return distanceSquared < 100 * 100;
  }

  private onMouseMove(event: MouseMoveEvent) {
    this.lastMousePosition = { x: event.x, y: event.y };
  }

  private onConnectionCheck() {
    if (this.transport.isLocal) return;
    if (Date.now() - this.lastMessageTime > 5000) {
      this.lastMessageTime = Date.now();
      this.transport.reconnect();
    }
  }
}
