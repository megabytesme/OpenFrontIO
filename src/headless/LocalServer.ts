import { z } from "zod";
import { EventBus } from "../core/EventBus";
import {
  AllPlayersStats,
  ClientMessage,
  ClientSendWinnerMessage,
  Intent,
  PartialGameRecordSchema,
  PlayerRecord,
  ServerMessage,
  ServerStartGameMessage,
  Turn,
} from "../core/Schemas";
import { createPartialGameRecord, decompressGameRecord } from "../core/Util";
import { LobbyConfig } from "./ClientGameRunner";
import { ReplaySpeedChangeEvent } from "./InputHandler";
import { getPersistentID } from "./Main";
import { defaultReplaySpeedMultiplier } from "./utilities/ReplaySpeedMultiplier";

export class LocalServer {
  private replayTurns: Turn[] = [];
  private turns: Turn[] = [];
  private intents: Intent[] = [];
  private startedAt: number;
  private paused = false;
  private replaySpeedMultiplier = defaultReplaySpeedMultiplier;
  private winner: ClientSendWinnerMessage | null = null;
  private allPlayersStats: AllPlayersStats = {};
  private turnsExecuted = 0;
  private turnStartTime = 0;
  private turnCheckInterval: NodeJS.Timeout;

  constructor(
    private lobbyConfig: LobbyConfig,
    private clientConnect: () => void,
    private clientMessage: (message: ServerMessage) => void,
    private isReplay: boolean,
    private eventBus: EventBus,
  ) {}

  start() {
    this.turnCheckInterval = setInterval(() => {
      if (!this.lobbyConfig.serverConfig) {
        return;
      }
      const turnIntervalMs =
        this.lobbyConfig.serverConfig.turnIntervalMs() *
        this.replaySpeedMultiplier;

      if (
        this.turnsExecuted === this.turns.length &&
        Date.now() > this.turnStartTime + turnIntervalMs
      ) {
        this.turnStartTime = Date.now();
        this.endTurn();
      }
    }, 5);

    this.eventBus.on(ReplaySpeedChangeEvent, (event) => {
      this.replaySpeedMultiplier = event.replaySpeedMultiplier;
    });

    this.startedAt = Date.now();
    this.clientConnect();
    if (this.lobbyConfig.gameRecord) {
      this.replayTurns = decompressGameRecord(
        this.lobbyConfig.gameRecord,
      ).turns;
    }
    if (this.lobbyConfig.gameStartInfo === undefined) {
      throw new Error("missing gameStartInfo");
    }
    this.clientMessage({
      type: "start",
      gameStartInfo: this.lobbyConfig.gameStartInfo,
      turns: [],
    } satisfies ServerStartGameMessage);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  onMessage(clientMsg: ClientMessage) {
    if (clientMsg.type === "intent") {
      if (this.lobbyConfig.gameRecord || this.paused) return;
      this.intents.push(clientMsg.intent);
    }
    if (clientMsg.type === "hash") {
      if (!this.lobbyConfig.gameRecord) {
        if (clientMsg.turnNumber % 100 === 0) {
          this.turns[clientMsg.turnNumber].hash = clientMsg.hash;
        }
        return;
      }
      const archivedHash = this.replayTurns[clientMsg.turnNumber].hash;
      if (!archivedHash) return;
      if (archivedHash !== clientMsg.hash) {
        this.clientMessage({
          type: "desync",
          turn: clientMsg.turnNumber,
          correctHash: archivedHash,
          clientsWithCorrectHash: 0,
          totalActiveClients: 1,
          yourHash: clientMsg.hash,
        });
      }
    }
    if (clientMsg.type === "winner") {
      this.winner = clientMsg;
      this.allPlayersStats = clientMsg.allPlayersStats;
    }
  }

  public turnComplete() {
    this.turnsExecuted++;
  }

  private endTurn() {
    if (this.paused) return;
    if (this.replayTurns.length > 0) {
      if (this.turns.length >= this.replayTurns.length) {
        this.endGame();
        return;
      }
      this.intents = this.replayTurns[this.turns.length].intents;
    }
    const pastTurn: Turn = {
      turnNumber: this.turns.length,
      intents: this.intents,
    };
    this.turns.push(pastTurn);
    this.intents = [];
    this.clientMessage({ type: "turn", turn: pastTurn });
  }

  public endGame() {
    clearInterval(this.turnCheckInterval);
    if (this.isReplay) return;

    const players: PlayerRecord[] = [
      {
        persistentID: getPersistentID(),
        username: this.lobbyConfig.playerName,
        clientID: this.lobbyConfig.clientID,
        stats: this.allPlayersStats[this.lobbyConfig.clientID],
        cosmetics: this.lobbyConfig.gameStartInfo?.players[0].cosmetics,
      },
    ];
    if (this.lobbyConfig.gameStartInfo === undefined) {
      throw new Error("missing gameStartInfo");
    }
    const record = createPartialGameRecord(
      this.lobbyConfig.gameStartInfo.gameID,
      this.lobbyConfig.gameStartInfo.config,
      players,
      this.turns,
      this.startedAt,
      Date.now(),
      this.winner?.winner,
    );

    const result = PartialGameRecordSchema.safeParse(record);
    if (!result.success) {
      console.error("Error parsing game record", z.prettifyError(result.error));
      return;
    }

    window.chrome.webview.postMessage({
      type: "archiveGame",
      payload: {
        gameId: this.lobbyConfig.gameStartInfo.gameID,
        record: result.data,
      },
    });
  }
}
