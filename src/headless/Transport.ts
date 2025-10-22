import { z } from "zod";
import { EventBus, GameEvent } from "../core/EventBus";
import {
  AllPlayers,
  GameType,
  Gold,
  PlayerID,
  Tick,
  UnitType,
} from "../core/game/Game";
import { TileRef } from "../core/game/GameMap";
import { PlayerView } from "../core/game/GameView";
import {
  AllPlayersStats,
  ClientHashMessage,
  ClientIntentMessage,
  ClientJoinMessage,
  ClientMessage,
  ClientPingMessage,
  ClientSendWinnerMessage,
  Intent,
  ServerMessage,
  ServerMessageSchema,
  Winner,
} from "../core/Schemas";
import { replacer } from "../core/Util";
import { LobbyConfig } from "./ClientGameRunner";
import { LocalServer } from "./LocalServer";

export class PauseGameEvent implements GameEvent {
  constructor(public readonly paused: boolean) {}
}
export class SendAllianceRequestIntentEvent implements GameEvent {
  constructor(
    public readonly requestor: PlayerView,
    public readonly recipient: PlayerView,
  ) {}
}
export class SendBreakAllianceIntentEvent implements GameEvent {
  constructor(
    public readonly requestor: PlayerView,
    public readonly recipient: PlayerView,
  ) {}
}
export class SendUpgradeStructureIntentEvent implements GameEvent {
  constructor(
    public readonly unitId: number,
    public readonly unitType: UnitType,
  ) {}
}
export class SendAllianceReplyIntentEvent implements GameEvent {
  constructor(
    public readonly requestor: PlayerView,
    public readonly recipient: PlayerView,
    public readonly accepted: boolean,
  ) {}
}
export class SendAllianceExtensionIntentEvent implements GameEvent {
  constructor(public readonly recipient: PlayerView) {}
}
export class SendSpawnIntentEvent implements GameEvent {
  constructor(public readonly tile: TileRef) {}
}
export class SendAttackIntentEvent implements GameEvent {
  constructor(
    public readonly targetID: PlayerID | null,
    public readonly troops: number,
  ) {}
}
export class SendBoatAttackIntentEvent implements GameEvent {
  constructor(
    public readonly targetID: PlayerID | null,
    public readonly dst: TileRef,
    public readonly troops: number,
    public readonly src: TileRef | null = null,
  ) {}
}
export class BuildUnitIntentEvent implements GameEvent {
  constructor(
    public readonly unit: UnitType,
    public readonly tile: TileRef,
  ) {}
}
export class SendTargetPlayerIntentEvent implements GameEvent {
  constructor(public readonly targetID: PlayerID) {}
}
export class SendEmojiIntentEvent implements GameEvent {
  constructor(
    public readonly recipient: PlayerView | typeof AllPlayers,
    public readonly emoji: number,
  ) {}
}
export class SendDonateGoldIntentEvent implements GameEvent {
  constructor(
    public readonly recipient: PlayerView,
    public readonly gold: Gold | null,
  ) {}
}
export class SendDonateTroopsIntentEvent implements GameEvent {
  constructor(
    public readonly recipient: PlayerView,
    public readonly troops: number | null,
  ) {}
}
export class SendQuickChatEvent implements GameEvent {
  constructor(
    public readonly recipient: PlayerView,
    public readonly quickChatKey: string,
    public readonly target?: PlayerID,
  ) {}
}
export class SendEmbargoIntentEvent implements GameEvent {
  constructor(
    public readonly target: PlayerView,
    public readonly action: "start" | "stop",
  ) {}
}
export class SendDeleteUnitIntentEvent implements GameEvent {
  constructor(public readonly unitId: number) {}
}
export class CancelAttackIntentEvent implements GameEvent {
  constructor(public readonly attackID: string) {}
}
export class CancelBoatIntentEvent implements GameEvent {
  constructor(public readonly unitID: number) {}
}
export class SendWinnerEvent implements GameEvent {
  constructor(
    public readonly winner: Winner,
    public readonly allPlayersStats: AllPlayersStats,
  ) {}
}
export class SendHashEvent implements GameEvent {
  constructor(
    public readonly tick: Tick,
    public readonly hash: number,
  ) {}
}
export class MoveWarshipIntentEvent implements GameEvent {
  constructor(
    public readonly unitId: number,
    public readonly tile: number,
  ) {}
}
export class SendKickPlayerIntentEvent implements GameEvent {
  constructor(public readonly target: string) {}
}

export class Transport {
  private socket: WebSocket | null = null;
  private localServer: LocalServer;
  private buffer: string[] = [];
  private onconnect: () => void;
  private onmessage: (msg: ServerMessage) => void;
  private pingInterval: number | null = null;
  public readonly isLocal: boolean;

  constructor(
    private lobbyConfig: LobbyConfig,
    private eventBus: EventBus,
  ) {
    this.isLocal =
      lobbyConfig.gameRecord !== undefined ||
      lobbyConfig.gameStartInfo?.config.gameType === GameType.Singleplayer;

    this.eventBus.on(SendAllianceRequestIntentEvent, (e) =>
      this.onSendAllianceRequest(e),
    );
    this.eventBus.on(SendAllianceReplyIntentEvent, (e) =>
      this.onAllianceRequestReplyUIEvent(e),
    );
    this.eventBus.on(SendAllianceExtensionIntentEvent, (e) =>
      this.onSendAllianceExtensionIntent(e),
    );
    this.eventBus.on(SendBreakAllianceIntentEvent, (e) =>
      this.onBreakAllianceRequestUIEvent(e),
    );
    this.eventBus.on(SendSpawnIntentEvent, (e) =>
      this.onSendSpawnIntentEvent(e),
    );
    this.eventBus.on(SendAttackIntentEvent, (e) => this.onSendAttackIntent(e));
    this.eventBus.on(SendUpgradeStructureIntentEvent, (e) =>
      this.onSendUpgradeStructureIntent(e),
    );
    this.eventBus.on(SendBoatAttackIntentEvent, (e) =>
      this.onSendBoatAttackIntent(e),
    );
    this.eventBus.on(SendTargetPlayerIntentEvent, (e) =>
      this.onSendTargetPlayerIntent(e),
    );
    this.eventBus.on(SendEmojiIntentEvent, (e) => this.onSendEmojiIntent(e));
    this.eventBus.on(SendDonateGoldIntentEvent, (e) =>
      this.onSendDonateGoldIntent(e),
    );
    this.eventBus.on(SendDonateTroopsIntentEvent, (e) =>
      this.onSendDonateTroopIntent(e),
    );
    this.eventBus.on(SendQuickChatEvent, (e) => this.onSendQuickChatIntent(e));
    this.eventBus.on(SendEmbargoIntentEvent, (e) =>
      this.onSendEmbargoIntent(e),
    );
    this.eventBus.on(BuildUnitIntentEvent, (e) => this.onBuildUnitIntent(e));
    this.eventBus.on(PauseGameEvent, (e) => this.onPauseGameEvent(e));
    this.eventBus.on(SendWinnerEvent, (e) => this.onSendWinnerEvent(e));
    this.eventBus.on(SendHashEvent, (e) => this.onSendHashEvent(e));
    this.eventBus.on(CancelAttackIntentEvent, (e) =>
      this.onCancelAttackIntentEvent(e),
    );
    this.eventBus.on(CancelBoatIntentEvent, (e) =>
      this.onCancelBoatIntentEvent(e),
    );
    this.eventBus.on(MoveWarshipIntentEvent, (e) => this.onMoveWarshipEvent(e));
    this.eventBus.on(SendDeleteUnitIntentEvent, (e) =>
      this.onSendDeleteUnitIntent(e),
    );
    this.eventBus.on(SendKickPlayerIntentEvent, (e) =>
      this.onSendKickPlayerIntent(e),
    );
  }

  private startPing() {
    if (this.isLocal) return;
    this.pingInterval ??= window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.sendMsg({ type: "ping" } as ClientPingMessage);
      }
    }, 5 * 1000);
  }

  private stopPing() {
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public connect(
    onconnect: () => void,
    onmessage: (message: ServerMessage) => void,
  ) {
    if (this.isLocal) {
      this.localServer = new LocalServer(
        this.lobbyConfig,
        onconnect,
        onmessage,
        this.lobbyConfig.gameRecord !== undefined,
        this.eventBus,
      );
      this.localServer.start();
    } else {
      this.connectRemote(onconnect, onmessage);
    }
  }

  private connectRemote(
    onconnect: () => void,
    onmessage: (message: ServerMessage) => void,
  ) {
    this.startPing();
    this.killExistingSocket();

    if (!this.lobbyConfig.serverConfig) {
      console.error(
        "Cannot connect to remote server without a server configuration.",
      );
      return;
    }

    const workerPath = this.lobbyConfig.serverConfig.workerPath(
      this.lobbyConfig.gameID,
    );

    let wsUrl;
    if (workerPath.startsWith("ws:") || workerPath.startsWith("wss:")) {
      wsUrl = workerPath;
    } else {
      const wsHost = this.lobbyConfig.serverConfig.domain();
      const wsProtocol = "wss:";

      wsUrl = `${wsProtocol}//${wsHost}/${workerPath}/socket`;
    }

    this.socket = new WebSocket(wsUrl);

    this.onconnect = onconnect;
    this.onmessage = onmessage;

    this.socket.onopen = () => {
      while (this.buffer.length > 0) {
        const msg = this.buffer.shift();
        if (msg) this.socket?.send(msg);
      }
      onconnect();
    };
    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const result = ServerMessageSchema.safeParse(JSON.parse(event.data));
        if (!result.success) {
          console.error(
            "Error parsing server message",
            z.prettifyError(result.error),
          );
          return;
        }
        this.onmessage(result.data);
      } catch (e) {
        console.error("Error in onmessage handler:", e, event.data);
      }
    };
    this.socket.onerror = () => this.socket?.close();
    this.socket.onclose = (event: CloseEvent) => {
      if (event.code !== 1000) this.reconnect();
    };
  }

  public reconnect() {
    this.connect(this.onconnect, this.onmessage);
  }

  public turnComplete() {
    if (this.isLocal) {
      this.localServer.turnComplete();
    }
  }

  joinGame(numTurns: number) {
    this.sendMsg({
      type: "join",
      gameID: this.lobbyConfig.gameID,
      clientID: this.lobbyConfig.clientID,
      lastTurn: numTurns,
      token: this.lobbyConfig.token,
      username: this.lobbyConfig.playerName,
      cosmetics: this.lobbyConfig.cosmetics,
    } as ClientJoinMessage);
  }

  leaveGame() {
    if (this.isLocal) {
      this.localServer.endGame();
      return;
    }
    this.stopPing();
    this.killExistingSocket();
  }

  private onSendAllianceRequest(event: SendAllianceRequestIntentEvent) {
    this.sendIntent({
      type: "allianceRequest",
      clientID: this.lobbyConfig.clientID,
      recipient: event.recipient.id(),
    });
  }
  private onAllianceRequestReplyUIEvent(event: SendAllianceReplyIntentEvent) {
    this.sendIntent({
      type: "allianceRequestReply",
      clientID: this.lobbyConfig.clientID,
      requestor: event.requestor.id(),
      accept: event.accepted,
    });
  }
  private onBreakAllianceRequestUIEvent(event: SendBreakAllianceIntentEvent) {
    this.sendIntent({
      type: "breakAlliance",
      clientID: this.lobbyConfig.clientID,
      recipient: event.recipient.id(),
    });
  }
  private onSendAllianceExtensionIntent(
    event: SendAllianceExtensionIntentEvent,
  ) {
    this.sendIntent({
      type: "allianceExtension",
      clientID: this.lobbyConfig.clientID,
      recipient: event.recipient.id(),
    });
  }
  private onSendSpawnIntentEvent(event: SendSpawnIntentEvent) {
    this.sendIntent({
      type: "spawn",
      clientID: this.lobbyConfig.clientID,
      tile: event.tile,
    });
  }
  private onSendAttackIntent(event: SendAttackIntentEvent) {
    this.sendIntent({
      type: "attack",
      clientID: this.lobbyConfig.clientID,
      targetID: event.targetID,
      troops: event.troops,
    });
  }
  private onSendBoatAttackIntent(event: SendBoatAttackIntentEvent) {
    this.sendIntent({
      type: "boat",
      clientID: this.lobbyConfig.clientID,
      targetID: event.targetID,
      troops: event.troops,
      dst: event.dst,
      src: event.src,
    });
  }
  private onSendUpgradeStructureIntent(event: SendUpgradeStructureIntentEvent) {
    this.sendIntent({
      type: "upgrade_structure",
      unit: event.unitType,
      clientID: this.lobbyConfig.clientID,
      unitId: event.unitId,
    });
  }
  private onSendTargetPlayerIntent(event: SendTargetPlayerIntentEvent) {
    this.sendIntent({
      type: "targetPlayer",
      clientID: this.lobbyConfig.clientID,
      target: event.targetID,
    });
  }
  private onSendEmojiIntent(event: SendEmojiIntentEvent) {
    this.sendIntent({
      type: "emoji",
      clientID: this.lobbyConfig.clientID,
      recipient:
        event.recipient === AllPlayers ? AllPlayers : event.recipient.id(),
      emoji: event.emoji,
    });
  }
  private onSendDonateGoldIntent(event: SendDonateGoldIntentEvent) {
    this.sendIntent({
      type: "donate_gold",
      clientID: this.lobbyConfig.clientID,
      recipient: event.recipient.id(),
      gold: event.gold ? Number(event.gold) : null,
    });
  }
  private onSendDonateTroopIntent(event: SendDonateTroopsIntentEvent) {
    this.sendIntent({
      type: "donate_troops",
      clientID: this.lobbyConfig.clientID,
      recipient: event.recipient.id(),
      troops: event.troops,
    });
  }
  private onSendQuickChatIntent(event: SendQuickChatEvent) {
    this.sendIntent({
      type: "quick_chat",
      clientID: this.lobbyConfig.clientID,
      recipient: event.recipient.id(),
      quickChatKey: event.quickChatKey,
      target: event.target,
    });
  }
  private onSendEmbargoIntent(event: SendEmbargoIntentEvent) {
    this.sendIntent({
      type: "embargo",
      clientID: this.lobbyConfig.clientID,
      targetID: event.target.id(),
      action: event.action,
    });
  }
  private onBuildUnitIntent(event: BuildUnitIntentEvent) {
    this.sendIntent({
      type: "build_unit",
      clientID: this.lobbyConfig.clientID,
      unit: event.unit,
      tile: event.tile,
    });
  }
  private onPauseGameEvent(event: PauseGameEvent) {
    if (!this.isLocal) return;
    if (event.paused) this.localServer.pause();
    else this.localServer.resume();
  }
  private onSendWinnerEvent(event: SendWinnerEvent) {
    this.sendMsg({
      type: "winner",
      winner: event.winner,
      allPlayersStats: event.allPlayersStats,
    } as ClientSendWinnerMessage);
  }
  private onSendHashEvent(event: SendHashEvent) {
    this.sendMsg({
      type: "hash",
      turnNumber: event.tick,
      hash: event.hash,
    } as ClientHashMessage);
  }
  private onCancelAttackIntentEvent(event: CancelAttackIntentEvent) {
    this.sendIntent({
      type: "cancel_attack",
      clientID: this.lobbyConfig.clientID,
      attackID: event.attackID,
    });
  }
  private onCancelBoatIntentEvent(event: CancelBoatIntentEvent) {
    this.sendIntent({
      type: "cancel_boat",
      clientID: this.lobbyConfig.clientID,
      unitID: event.unitID,
    });
  }
  private onMoveWarshipEvent(event: MoveWarshipIntentEvent) {
    this.sendIntent({
      type: "move_warship",
      clientID: this.lobbyConfig.clientID,
      unitId: event.unitId,
      tile: event.tile,
    });
  }
  private onSendDeleteUnitIntent(event: SendDeleteUnitIntentEvent) {
    this.sendIntent({
      type: "delete_unit",
      clientID: this.lobbyConfig.clientID,
      unitId: event.unitId,
    });
  }
  private onSendKickPlayerIntent(event: SendKickPlayerIntentEvent) {
    this.sendIntent({
      type: "kick_player",
      clientID: this.lobbyConfig.clientID,
      target: event.target,
    });
  }

  private sendIntent(intent: Intent) {
    this.sendMsg({ type: "intent", intent } as ClientIntentMessage);
  }

  private sendMsg(msg: ClientMessage) {
    if (this.isLocal) {
      this.localServer.onMessage(msg);
      return;
    }
    const str = JSON.stringify(msg, replacer);
    if (this.socket?.readyState !== WebSocket.OPEN) {
      this.buffer.push(str);
      if (
        this.socket?.readyState === WebSocket.CLOSED ||
        this.socket?.readyState === WebSocket.CLOSING
      ) {
        this.reconnect();
      }
    } else {
      this.socket.send(str);
    }
  }

  private killExistingSocket(): void {
    if (this.socket) {
      this.socket.onmessage =
        this.socket.onopen =
        this.socket.onclose =
        this.socket.onerror =
          null;
      if (this.socket.readyState === WebSocket.OPEN) this.socket.close();
      this.socket = null;
    }
  }
}
