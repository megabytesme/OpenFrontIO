import { GameView } from "../../../core/game/GameView";
import { Fx, FxType } from "./Fx";
import { Timeline } from "./Timeline";

export class UnitExplosionFx implements Fx {
  type = FxType.UnitExplosion;
  private timeline = new Timeline();
  private explosions: Fx[] = [];
  private active = true;
  elapsedTime = 0;
  duration = 280 + 160;

  constructor(
    public x: number,
    public y: number,
    game: GameView,
  ) {
    const config = [
      { dx: 0, dy: 0, delay: 0, type: FxType.UnitExplosion },
      { dx: 4, dy: -6, delay: 80, type: FxType.UnitExplosion },
      { dx: -6, dy: 4, delay: 160, type: FxType.UnitExplosion },
    ];
    for (const { dx, dy, delay, type } of config) {
      this.timeline.add(delay, () => {
        if (game.isValidCoord(x + dx, y + dy)) {
          const explosionFx: Fx = {
            type: type,
            x: x + dx,
            y: y + dy,
            elapsedTime: 0,
            duration: 280,
            update(frameTime: number) {
              this.elapsedTime! += frameTime;
              return this.elapsedTime! < this.duration!;
            },
            getState() {
              return {
                type: this.type,
                x: this.x,
                y: this.y,
                progress: this.elapsedTime! / this.duration!,
              };
            },
          };
          this.explosions.push(explosionFx);
        }
      });
    }
  }

  update(frameTime: number): boolean {
    this.elapsedTime += frameTime;
    this.timeline.update(frameTime);
    this.explosions = this.explosions.filter((fx) => fx.update(frameTime));

    this.active = !(this.explosions.length === 0 && this.timeline.isComplete());
    return this.active;
  }

  getState(): Record<string, any> {
    return {
      type: this.type,
      explosions: this.explosions.map((fx) => fx.getState()),
    };
  }
}
