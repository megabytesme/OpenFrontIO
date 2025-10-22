import { UnitType } from "../../../core/game/Game";
import {
  BonusEventUpdate,
  ConquestUpdate,
  GameUpdateType,
  RailroadUpdate,
} from "../../../core/game/GameUpdates";
import { GameView, UnitView } from "../../../core/game/GameView";
import { renderNumber } from "../../Utils";
import { conquestFxFactory } from "../fx/ConquestFx";
import { Fx, FxType } from "../fx/Fx";
import { nukeFxFactory } from "../fx/NukeFx";
import { TargetFx } from "../fx/TargetFx";
import { TextFx } from "../fx/TextFx";
import { UnitExplosionFx } from "../fx/UnitExplosionFx";
import { Layer } from "./Layer";

export class FxLayer implements Layer {
  private allFx: Fx[] = [];
  private boatTargetFxByUnitId: Map<number, TargetFx> = new Map();

  constructor(private game: GameView) {}

  init() {}

  tick() {
    this.manageBoatTargetFx();
    const updates = this.game.updatesSinceLastTick();
    if (!updates) return;

    updates[GameUpdateType.Unit]
      ?.map((unit) => this.game.unit(unit.id))
      .forEach((unitView) => {
        if (unitView) this.onUnitEvent(unitView);
      });

    updates[GameUpdateType.BonusEvent]?.forEach((bonusEvent) => {
      this.onBonusEvent(bonusEvent);
    });

    updates[GameUpdateType.RailroadEvent]?.forEach((update) => {
      this.onRailroadEvent(update);
    });

    updates[GameUpdateType.ConquestEvent]?.forEach((update) => {
      this.onConquestEvent(update);
    });

    // The turn interval is not available in headless mode this way.
    // Use a fixed reasonable value for simulation.
    const mockDelta = 100; // ms per tick
    this.allFx = this.allFx.filter((fx) => fx.update(mockDelta));

    const fxStates = this.allFx.map((fx) => fx.getState());
    if (fxStates.length > 0) {
      window.chrome.webview.postMessage({
        type: "fxUpdate",
        payload: fxStates,
      });
    }
  }

  private manageBoatTargetFx() {
    for (const [unitId, fx] of this.boatTargetFxByUnitId.entries()) {
      const unit = this.game.unit(unitId);
      if (
        !unit ||
        !unit.isActive() ||
        unit.reachedTarget() ||
        unit.retreating()
      ) {
        fx.end();
        this.boatTargetFxByUnitId.delete(unitId);
      }
    }
  }

  onBonusEvent(bonus: BonusEventUpdate) {
    if (this.game.player(bonus.player) !== this.game.myPlayer()) return;
    const x = this.game.x(bonus.tile);
    let y = this.game.y(bonus.tile);

    if (bonus.gold > 0) {
      this.addTextFx(`+ ${renderNumber(bonus.gold, 0)}`, x, y);
      y += 10;
    }
    if (bonus.troops > 0) {
      this.addTextFx(`+ ${renderNumber(bonus.troops, 0)} troops`, x, y);
    }
  }

  addTextFx(text: string, x: number, y: number) {
    this.allFx.push(new TextFx(text, x, y, 1000, 20));
  }

  onUnitEvent(unit: UnitView) {
    if (unit.type() === UnitType.TransportShip) {
      const my = this.game.myPlayer();
      if (!my || unit.owner() !== my || !unit.isActive() || unit.retreating())
        return;
      if (this.boatTargetFxByUnitId.has(unit.id())) return;
      const t = unit.targetTile();
      if (t !== undefined) {
        const fx = new TargetFx(this.game.x(t), this.game.y(t), 0, true);
        this.allFx.push(fx);
        this.boatTargetFxByUnitId.set(unit.id(), fx);
      }
    } else if (
      [UnitType.AtomBomb, UnitType.MIRVWarhead].includes(unit.type())
    ) {
      this.onNukeEvent(unit, 70);
    } else if (unit.type() === UnitType.HydrogenBomb) {
      this.onNukeEvent(unit, 160);
    } else if (unit.type() === UnitType.Warship) {
      this.onWarshipEvent(unit);
    }
  }

  onRailroadEvent(railroad: RailroadUpdate) {
    for (const rail of railroad.railTiles) {
      if (Math.random() < 0.33) {
        const dustFx: Fx = {
          type: FxType.Dust,
          x: this.game.x(rail.tile),
          y: this.game.y(rail.tile),
          elapsedTime: 0,
          duration: 300,
          update(frameTime: number) {
            this.elapsedTime += frameTime;
            return this.elapsedTime < this.duration;
          },
          getState() {
            return {
              type: this.type,
              x: this.x,
              y: this.y,
              progress: this.elapsedTime / this.duration,
            };
          },
        };
        this.allFx.push(dustFx);
      }
    }
  }

  onConquestEvent(conquest: ConquestUpdate) {
    const conqueror = this.game.player(conquest.conquerorId);
    if (conqueror !== this.game.myPlayer()) return;
    window.chrome.webview.postMessage({
      type: "playSound",
      payload: { sound: "KaChing" },
    });
    this.allFx.push(...conquestFxFactory(conquest, this.game));
  }

  onWarshipEvent(unit: UnitView) {
    if (!unit.isActive()) {
      const x = this.game.x(unit.lastTile());
      const y = this.game.y(unit.lastTile());
      this.allFx.push(new UnitExplosionFx(x, y, this.game));
      const sinkingShip: Fx = {
        type: FxType.SinkingShip,
        x,
        y,
        ownerId: unit.owner().id(),
        elapsedTime: 0,
        duration: 1260,
        update(frameTime: number) {
          this.elapsedTime += frameTime;
          return this.elapsedTime < this.duration;
        },
        getState() {
          return {
            type: this.type,
            x: this.x,
            y: this.y,
            ownerId: (this as any).ownerId,
            progress: this.elapsedTime / this.duration,
          };
        },
      };
      this.allFx.push(sinkingShip);
    }
  }

  onNukeEvent(unit: UnitView, radius: number) {
    if (!unit.isActive()) {
      if (!unit.reachedTarget()) this.handleSAMInterception(unit);
      else this.handleNukeExplosion(unit, radius);
    }
  }

  handleNukeExplosion(unit: UnitView, radius: number) {
    const x = this.game.x(unit.lastTile());
    const y = this.game.y(unit.lastTile());
    this.allFx.push(...nukeFxFactory(x, y, radius, this.game));
  }

  handleSAMInterception(unit: UnitView) {
    const x = this.game.x(unit.lastTile());
    const y = this.game.y(unit.lastTile());
    const samExplosion: Fx = {
      type: FxType.SAMExplosion,
      x,
      y,
      elapsedTime: 0,
      duration: 630,
      update(frameTime: number) {
        this.elapsedTime += frameTime;
        return this.elapsedTime < this.duration;
      },
      getState() {
        return {
          type: this.type,
          x: this.x,
          y: this.y,
          progress: this.elapsedTime / this.duration,
        };
      },
    };
    this.allFx.push(samExplosion);
  }
}
