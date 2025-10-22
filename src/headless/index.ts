import { EventBus } from "../core/EventBus";
import { UserSettings } from "../core/game/UserSettings";
import { LobbyConfig, joinLobby } from "./ClientGameRunner";
import {
  AlternateViewEvent,
  CenterCameraEvent,
  ContextMenuEvent,
  DoBoatAttackEvent,
  DoGroundAttackEvent,
  DragEvent,
  MouseUpEvent,
  ZoomEvent,
} from "./InputHandler";
import { UIState } from "./graphics/UIState";

declare global {
  interface Window {
    headlessClient: HeadlessClient;
    chrome: {
      webview: {
        postMessage: (message: any) => void;
      };
    };
  }
}

class HeadlessClient {
  private eventBus: EventBus = new EventBus();
  private gameStop: (() => void) | null = null;
  public uiState: UIState = { attackRatio: 0.2, ghostStructure: null };
  private userSettings = new UserSettings();

  constructor() {
    this.uiState.attackRatio = Number(
      localStorage.getItem("settings.attackRatio") ?? "0.2",
    );
  }

  public async initialize(lobbyConfig: LobbyConfig) {
    if (this.gameStop) {
      this.gameStop();
    }

    this.gameStop = await joinLobby(
      this.eventBus,
      lobbyConfig,
      () => {
        window.chrome.webview.postMessage({ type: "gamePrestart" });
      },
      () => {
        window.chrome.webview.postMessage({ type: "gameStart" });
      },
    );
  }

  public shutdown() {
    if (this.gameStop) {
      this.gameStop();
      this.gameStop = null;
    }
  }

  public simulateRightClick(x: number, y: number) {
    this.eventBus.emit(new ContextMenuEvent(x, y));
  }

  public simulateClick(x: number, y: number, shiftKey: boolean) {
    if (this.userSettings.leftClickOpensMenu() && !shiftKey) {
      this.eventBus.emit(new ContextMenuEvent(x, y));
    } else {
      this.eventBus.emit(new MouseUpEvent(x, y));
    }
  }

  public simulatePan(deltaX: number, deltaY: number) {
    this.eventBus.emit(new DragEvent(deltaX, deltaY));
  }

  public simulateZoom(x: number, y: number, delta: number) {
    this.eventBus.emit(new ZoomEvent(x, y, delta));
  }

  public setAlternateView(isAlternate: boolean) {
    this.eventBus.emit(new AlternateViewEvent(isAlternate));
  }

  public setAttackRatio(ratioPercent: number) {
    const ratio = Math.max(0.01, Math.min(1.0, ratioPercent / 100));
    this.uiState.attackRatio = ratio;
    localStorage.setItem("settings.attackRatio", ratio.toString());
    window.chrome.webview.postMessage({
      type: "stateUpdate",
      payload: { attackRatio: ratioPercent },
    });
  }

  public changeAttackRatio(deltaPercent: number) {
    const currentRatio = this.uiState.attackRatio * 100;
    this.setAttackRatio(currentRatio + deltaPercent);
  }

  public build(unitType: string) {
    this.uiState.ghostStructure = unitType as any;
  }

  public doGroundAttack() {
    this.eventBus.emit(new DoGroundAttackEvent());
  }

  public doBoatAttack() {
    this.eventBus.emit(new DoBoatAttackEvent());
  }

  public centerCamera() {
    this.eventBus.emit(new CenterCameraEvent());
  }

  public handleUwpMessage(message: { type: string; payload: any }) {
    try {
      switch (message.type) {
        case "initialize":
          this.initialize(message.payload as LobbyConfig);
          break;
        case "simulateClick":
          this.simulateClick(
            message.payload.x,
            message.payload.y,
            message.payload.shiftKey,
          );
          break;
        case "simulateRightClick":
          this.simulateRightClick(message.payload.x, message.payload.y);
          break;
        case "simulatePan":
          this.simulatePan(message.payload.deltaX, message.payload.deltaY);
          break;
        case "simulateZoom":
          this.simulateZoom(
            message.payload.x,
            message.payload.y,
            message.payload.delta,
          );
          break;
        case "setAlternateView":
          this.setAlternateView(message.payload.isAlternate);
          break;
        case "setAttackRatio":
          this.setAttackRatio(message.payload.ratioPercent);
          break;
        case "changeAttackRatio":
          this.changeAttackRatio(message.payload.deltaPercent);
          break;
        case "build":
          this.build(message.payload.unitType);
          break;
        case "doGroundAttack":
          this.doGroundAttack();
          break;
        case "doBoatAttack":
          this.doBoatAttack();
          break;
        case "centerCamera":
          this.centerCamera();
          break;
        case "shutdown":
          this.shutdown();
          break;
      }
    } catch (e: any) {
      window.chrome.webview.postMessage({
        type: "error",
        payload: {
          title: "HeadlessClient JS Error",
          message: e.message,
          stack: e.stack,
        },
      });
    }
  }
}

window.headlessClient = new HeadlessClient();

window.chrome.webview.postMessage({ type: "clientReady" });
