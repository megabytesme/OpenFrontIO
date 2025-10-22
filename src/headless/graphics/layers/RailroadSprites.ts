import { RailType } from "../../../core/game/GameUpdates";

function horizontalRailroadRects(): number[][] {
  return [
    [-1, -1, 2, 1],
    [-1, 1, 2, 1],
    [-1, 0, 1, 1],
  ];
}
function verticalRailroadRects(): number[][] {
  return [
    [-1, -2, 1, 2],
    [1, -2, 1, 2],
    [0, -1, 1, 1],
  ];
}
function topRightRailroadCornerRects(): number[][] {
  return [
    [-1, -2, 1, 2],
    [0, -1, 1, 2],
    [1, -2, 1, 4],
  ];
}
function topLeftRailroadCornerRects(): number[][] {
  return [
    [-1, -2, 1, 4],
    [0, -1, 1, 2],
    [1, -2, 1, 2],
  ];
}
function bottomRightRailroadCornerRects(): number[][] {
  return [
    [-1, 1, 1, 2],
    [0, 0, 1, 2],
    [1, -1, 1, 4],
  ];
}
function bottomLeftRailroadCornerRects(): number[][] {
  return [
    [-1, -1, 1, 4],
    [0, 0, 1, 2],
    [1, 1, 1, 2],
  ];
}
function horizontalBridge(): number[][] {
  return [
    [-1, -2, 3, 1],
    [-1, 2, 3, 1],
    [-1, 3, 1, 1],
    [1, 3, 1, 1],
  ];
}
function verticalBridge(): number[][] {
  return [
    [-2, -2, 1, 3],
    [2, -2, 1, 3],
  ];
}
function topRightBridgeCornerRects(): number[][] {
  return [
    [-2, -2, 1, 2],
    [-1, 0, 1, 1],
    [0, 1, 1, 1],
    [1, 2, 2, 1],
    [2, -2, 1, 1],
  ];
}
function bottomLeftBridgeCornerRects(): number[][] {
  return [
    [-2, -2, 2, 1],
    [0, -1, 1, 1],
    [1, 0, 1, 1],
    [2, 1, 1, 2],
    [-2, 2, 1, 1],
  ];
}
function topLeftBridgeCornerRects(): number[][] {
  return [
    [-2, -2, 1, 1],
    [-2, 2, 2, 1],
    [0, 1, 1, 1],
    [1, 0, 1, 1],
    [2, -2, 1, 2],
  ];
}
function bottomRightBridgeCornerRects(): number[][] {
  return [
    [-2, 1, 1, 2],
    [-1, 0, 1, 1],
    [0, -1, 1, 1],
    [1, -2, 2, 1],
    [2, 2, 1, 1],
  ];
}

const railTypeToFunctionMap: Record<RailType, () => number[][]> = {
  [RailType.TOP_RIGHT]: topRightRailroadCornerRects,
  [RailType.BOTTOM_LEFT]: bottomLeftRailroadCornerRects,
  [RailType.TOP_LEFT]: topLeftRailroadCornerRects,
  [RailType.BOTTOM_RIGHT]: bottomRightRailroadCornerRects,
  [RailType.HORIZONTAL]: horizontalRailroadRects,
  [RailType.VERTICAL]: verticalRailroadRects,
};

const railTypeToBridgeFunctionMap: Record<RailType, () => number[][]> = {
  [RailType.TOP_RIGHT]: topRightBridgeCornerRects,
  [RailType.BOTTOM_LEFT]: bottomLeftBridgeCornerRects,
  [RailType.TOP_LEFT]: topLeftBridgeCornerRects,
  [RailType.BOTTOM_RIGHT]: bottomRightBridgeCornerRects,
  [RailType.HORIZONTAL]: horizontalBridge,
  [RailType.VERTICAL]: verticalBridge,
};

export function getRailroadRects(type: RailType): number[][] {
  const func = railTypeToFunctionMap[type];
  if (!func) throw new Error(`Unsupported RailType: ${type}`);
  return func();
}

export function getBridgeRects(type: RailType): number[][] {
  const func = railTypeToBridgeFunctionMap[type];
  if (!func) throw new Error(`Unsupported RailType: ${type}`);
  return func();
}
