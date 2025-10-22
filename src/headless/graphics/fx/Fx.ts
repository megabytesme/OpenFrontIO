export interface Fx {
  type: FxType;
  update(duration: number): boolean;
  getState(): Record<string, any>;

  elapsedTime?: number;
  duration?: number;
  x?: number;
  y?: number;
  text?: string;
  ownerId?: string;
  riseDistance?: number;
}

export enum FxType {
  MiniFire = "MiniFire",
  MiniSmoke = "MiniSmoke",
  MiniBigSmoke = "MiniBigSmoke",
  MiniSmokeAndFire = "MiniSmokeAndFire",
  MiniExplosion = "MiniExplosion",
  UnitExplosion = "UnitExplosion",
  SinkingShip = "SinkingShip",
  Nuke = "Nuke",
  SAMExplosion = "SAMExplosion",
  UnderConstruction = "UnderConstruction",
  Dust = "Dust",
  Conquest = "Conquest",
  Shockwave = "Shockwave",
  Text = "Text",
  Target = "Target",
}
