export interface Layer {
  init?: () => void;
  tick?: () => void;
}