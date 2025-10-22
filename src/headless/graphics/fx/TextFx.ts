import { Fx, FxType } from "./Fx";

export class TextFx implements Fx {
  type = FxType.Text;
  elapsedTime: number = 0;

  constructor(
    public text: string,
    public x: number,
    public y: number,
    public duration: number,
    public riseDistance: number = 30,
  ) {}

  update(frameTime: number): boolean {
    this.elapsedTime += frameTime;
    return this.elapsedTime < this.duration;
  }

  getState(): Record<string, any> {
    const t = this.elapsedTime / this.duration;
    const currentY = this.y - t * this.riseDistance;
    const alpha = 1 - t;

    return {
      type: this.type,
      text: this.text,
      x: this.x,
      y: currentY,
      alpha,
    };
  }
}
