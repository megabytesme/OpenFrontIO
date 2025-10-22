import { Fx, FxType } from "./Fx";

export class TargetFx implements Fx {
  type = FxType.Target;
  elapsedTime = 0;
  private ended = false;
  private endFade = 300;
  private offset = 0;
  private rotationSpeed = 14;
  private radius = 4;

  constructor(
    public x: number,
    public y: number,
    public duration = 0,
    private persistent = false,
  ) {}

  end() {
    if (this.persistent) {
      this.ended = true;
      this.elapsedTime = 0;
    }
  }

  update(frameTime: number): boolean {
    this.elapsedTime += frameTime;

    if (!this.persistent) {
      if (this.elapsedTime >= this.duration) return false;
    } else if (this.ended) {
      if (this.elapsedTime >= this.endFade) return false;
    }

    this.offset += this.rotationSpeed * (frameTime / 1000);
    return true;
  }

  getState(): Record<string, any> {
    const t = this.persistent
      ? (this.elapsedTime % 1000) / 1000
      : this.elapsedTime / this.duration;
    const baseAlpha = this.persistent ? 0.9 : 1 - t;
    const fadeAlpha =
      this.persistent && this.ended ? 1 - this.elapsedTime / this.endFade : 1;
    const alpha = Math.max(0, Math.min(1, baseAlpha * fadeAlpha));

    return {
      type: this.type,
      x: this.x,
      y: this.y,
      radius: this.radius,
      offset: this.offset,
      alpha,
    };
  }
}
