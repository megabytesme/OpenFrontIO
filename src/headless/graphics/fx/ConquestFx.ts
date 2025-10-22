import { ConquestUpdate } from "../../../core/game/GameUpdates";
import { GameView } from "../../../core/game/GameView";
import { renderNumber } from "../../Utils";
import { Fx, FxType } from "./Fx";

export function conquestFxFactory(
  conquest: ConquestUpdate,
  game: GameView,
): Fx[] {
  const fxList: Fx[] = [];
  const conquered = game.player(conquest.conqueredId);
  const x = conquered.nameLocation().x;
  const y = conquered.nameLocation().y;

  const swordAnimation: Fx = {
    type: FxType.Conquest,
    elapsedTime: 0,
    duration: 2500,
    x,
    y,
    update(frameTime: number) {
      this.elapsedTime += frameTime;
      return this.elapsedTime < this.duration;
    },
    getState() {
      const t = this.elapsedTime / this.duration;
      const fadeIn = 0.1;
      const fadeOut = 0.6;
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
        progress: this.elapsedTime / this.duration,
        alpha,
      };
    },
  };
  fxList.push(swordAnimation);

  const shortenedGold = renderNumber(conquest.gold);
  const goldText: Fx = {
    type: FxType.Text,
    text: `+ ${shortenedGold}`,
    x,
    y: y + 8,
    elapsedTime: 0,
    duration: 2500,
    riseDistance: 0,
    update(frameTime: number) {
      this.elapsedTime += frameTime;
      return this.elapsedTime < this.duration;
    },
    getState() {
      const t = this.elapsedTime / this.duration;
      return {
        type: this.type,
        text: this.text,
        x: this.x,
        y: this.y,
        alpha: 1 - t,
      };
    },
  };
  fxList.push(goldText);

  return fxList;
}