import { GameEvent } from "../core/EventBus";
import { UnitType } from "../core/game/Game";
import { UnitView } from "../core/game/GameView";
import { ReplaySpeedMultiplier } from "./utilities/ReplaySpeedMultiplier";

export class MouseUpEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class MouseOverEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class UnitSelectionEvent implements GameEvent {
  constructor(public readonly unit: UnitView | null, public readonly isSelected: boolean) {}
}
export class MouseDownEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class MouseMoveEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class ContextMenuEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class ZoomEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number, public readonly delta: number) {}
}
export class DragEvent implements GameEvent {
  constructor(public readonly deltaX: number, public readonly deltaY: number) {}
}
export class AlternateViewEvent implements GameEvent {
  constructor(public readonly alternateView: boolean) {}
}
export class CloseViewEvent implements GameEvent {}
export class RefreshGraphicsEvent implements GameEvent {}
export class TogglePerformanceOverlayEvent implements GameEvent {}
export class ToggleStructureEvent implements GameEvent {
  constructor(public readonly structureTypes: UnitType[] | null) {}
}
export class ShowBuildMenuEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class ShowEmojiMenuEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class DoBoatAttackEvent implements GameEvent {}
export class DoGroundAttackEvent implements GameEvent {}
export class AttackRatioEvent implements GameEvent {
  constructor(public readonly attackRatio: number) {}
}
export class ReplaySpeedChangeEvent implements GameEvent {
  constructor(public readonly replaySpeedMultiplier: ReplaySpeedMultiplier) {}
}
export class CenterCameraEvent implements GameEvent {}
export class AutoUpgradeEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}