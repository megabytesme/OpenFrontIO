import { EventBus } from "../../core/EventBus";
import { Cell } from "../../core/game/Game";
import { GameView } from "../../core/game/GameView";

export const GOTO_INTERVAL_MS = 16;
export const CAMERA_MAX_SPEED = 15;
export const CAMERA_SMOOTHING = 0.03;

export class TransformHandler {
  public scale: number = 1.8;
  private offsetX: number = -350;
  private offsetY: number = -200;
  private lastGoToCallTime: number | null = null;
  private target: Cell | null = null;

  constructor(
    private game: GameView,
    private eventBus: EventBus,
  ) {}

  public setTarget(cell: Cell | null) {
    this.target = cell;
    if (cell === null) {
      this.lastGoToCallTime = null;
    }
  }

  public setPan(deltaX: number, deltaY: number) {
    this.setTarget(null);
    this.offsetX -= deltaX / this.scale;
    this.offsetY -= deltaY / this.scale;
  }

  public setZoom(x: number, y: number, delta: number) {
    this.setTarget(null);
    const oldScale = this.scale;
    const zoomFactor = 1 + delta / 600;
    this.scale /= zoomFactor;
    this.scale = Math.max(0.2, Math.min(20, this.scale));

    const worldPoint = this.screenToWorldCoordinates(x, y);

    this.offsetX = worldPoint.x - (x - window.innerWidth / 2) / this.scale;
    this.offsetY = worldPoint.y - (y - window.innerHeight / 2) / this.scale;
  }

  public update() {
    if (this.target) {
      this.goTo();
    }
  }

  private goTo() {
    if (!this.target) return;

    const screenCenter = this.screenCenter();
    if (Math.abs(this.target.x - screenCenter.x) + Math.abs(this.target.y - screenCenter.y) < 2) {
      this.setTarget(null);
      return;
    }

    const now = performance.now();
    const dt = this.lastGoToCallTime ? now - this.lastGoToCallTime : GOTO_INTERVAL_MS;
    this.lastGoToCallTime = now;

    const r = 1 - Math.pow(CAMERA_SMOOTHING, dt / 1000);
    this.offsetX += Math.max(Math.min((this.target.x - screenCenter.x) * r, CAMERA_MAX_SPEED), -CAMERA_MAX_SPEED);
    this.offsetY += Math.max(Math.min((this.target.y - screenCenter.y) * r, CAMERA_MAX_SPEED), -CAMERA_MAX_SPEED);
  }

  screenCenter(): { x: number; y: number } {
    const [upperLeft, bottomRight] = this.screenBoundingRect();
    return {
      x: upperLeft.x + Math.floor((bottomRight.x - upperLeft.x) / 2),
      y: upperLeft.y + Math.floor((bottomRight.y - upperLeft.y) / 2),
    };
  }

  screenToWorldCoordinates(screenX: number, screenY: number): Cell {
    const canvasX = screenX;
    const canvasY = screenY;

    const centerX = (canvasX - window.innerWidth / 2) / this.scale + this.offsetX;
    const centerY = (canvasY - window.innerHeight / 2) / this.scale + this.offsetY;

    const gameX = centerX + this.game.width() / 2;
    const gameY = centerY + this.game.height() / 2;

    return new Cell(Math.floor(gameX), Math.floor(gameY));
  }

  screenBoundingRect(): [Cell, Cell] {
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;

    const worldLeftX = (0 - canvasWidth / 2) / this.scale + this.offsetX;
    const worldTopY = (0 - canvasHeight / 2) / this.scale + this.offsetY;
    const worldRightX = (canvasWidth - canvasWidth / 2) / this.scale + this.offsetX;
    const worldBottomY = (canvasHeight - canvasHeight / 2) / this.scale + this.offsetY;

    return [
      new Cell(Math.floor(worldLeftX), Math.floor(worldTopY)),
      new Cell(Math.floor(worldRightX), Math.floor(worldBottomY)),
    ];
  }

  centerAll(fit: number = 1) {
    this.setTarget(null);
    const vpWidth = window.innerWidth;
    const vpHeight = window.innerHeight;
    const mapWidth = this.game.width();
    const mapHeight = this.game.height();

    const scHor = (vpWidth / mapWidth) * fit;
    const scVer = (vpHeight / mapHeight) * fit;
    this.scale = Math.min(scHor, scVer);

    this.offsetX = (mapWidth / 2);
    this.offsetY = (mapHeight / 2);
  }
}