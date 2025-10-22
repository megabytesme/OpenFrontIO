import { GameView } from "../../../core/game/GameView";
import { Fx, FxType } from "./Fx";

class ShockwaveFx implements Fx {
  type = FxType.Shockwave;
  elapsedTime: number = 0;

  constructor(
    public x: number,
    public y: number,
    public duration: number,
    private maxRadius: number,
  ) {}

  update(frameTime: number): boolean {
    this.elapsedTime += frameTime;
    return this.elapsedTime < this.duration;
  }

  getState(): Record<string, any> {
    const t = this.elapsedTime / this.duration;
    return {
      type: this.type,
      x: this.x,
      y: this.y,
      radius: t * this.maxRadius,
      alpha: 1 - t,
    };
  }
}

function addSpriteInCircle(
  x: number,
  y: number,
  radius: number,
  num: number,
  type: FxType,
  result: Fx[],
  game: GameView,
) {
  const count = Math.max(0, Math.floor(num));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * (radius / 2);
    const spawnX = Math.floor(x + Math.cos(angle) * distance);
    const spawnY = Math.floor(y + Math.sin(angle) * distance);
    if (
      game.isValidCoord(spawnX, spawnY) &&
      game.isLand(game.ref(spawnX, spawnY))
    ) {
      const spriteFx: Fx = {
        type: type,
        x: spawnX,
        y: spawnY,
        elapsedTime: 0,
        duration: 6000,
        update(frameTime: number): boolean {
          this.elapsedTime! += frameTime;
          return this.elapsedTime! < this.duration!;
        },
        getState() {
          const t = this.elapsedTime! / this.duration!;
          const fadeIn = 0.1;
          const fadeOut = 0.8;
          let alpha = 1;
          if (t < fadeIn) {
            alpha = (t / fadeIn) ** 2;
          } else if (t > fadeOut) {
            alpha = 1 - ((t - fadeOut) / (1 - fadeOut)) ** 2;
          }
          return {
            type: this.type,
            x: this.x,
            y: this.y,
            alpha,
            progress: this.elapsedTime! / this.duration!,
          };
        },
      };
      result.push(spriteFx);
    }
  }
}

export function nukeFxFactory(
  x: number,
  y: number,
  radius: number,
  game: GameView,
): Fx[] {
  const nukeFx: Fx[] = [];

  const nukeExplosion: Fx = {
    type: FxType.Nuke,
    x,
    y,
    elapsedTime: 0,
    duration: 630,
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
  nukeFx.push(nukeExplosion);
  nukeFx.push(new ShockwaveFx(x, y, 1500, radius * 1.5));

  const debrisPlan = [
    { type: FxType.MiniFire, radiusFactor: 1.0, density: 1 / 25 },
    { type: FxType.MiniSmoke, radiusFactor: 1.0, density: 1 / 28 },
    { type: FxType.MiniBigSmoke, radiusFactor: 0.9, density: 1 / 70 },
    { type: FxType.MiniSmokeAndFire, radiusFactor: 0.9, density: 1 / 70 },
  ];

  for (const { type, radiusFactor, density } of debrisPlan) {
    addSpriteInCircle(
      x,
      y,
      radius * radiusFactor,
      radius * density,
      type,
      nukeFx,
      game,
    );
  }
  return nukeFx;
}
