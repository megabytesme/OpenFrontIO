export enum SoundEffect {
  KaChing = "ka-ching",
}

class SoundManager {
  private soundEffectsVolume: number = 1;
  private backgroundMusicVolume: number = 0;

  constructor() {}

  public playBackgroundMusic(): void {
    window.chrome.webview.postMessage({
      type: "playMusic",
      payload: {},
    });
  }

  public stopBackgroundMusic(): void {
    window.chrome.webview.postMessage({
      type: "stopMusic",
      payload: {},
    });
  }

  public setBackgroundMusicVolume(volume: number): void {
    this.backgroundMusicVolume = Math.max(0, Math.min(1, volume));
    window.chrome.webview.postMessage({
      type: "setMusicVolume",
      payload: { volume: this.backgroundMusicVolume },
    });
  }

  public playSoundEffect(name: SoundEffect): void {
    window.chrome.webview.postMessage({
      type: "playSound",
      payload: { sound: name },
    });
  }

  public setSoundEffectsVolume(volume: number): void {
    this.soundEffectsVolume = Math.max(0, Math.min(1, volume));
    window.chrome.webview.postMessage({
      type: "setSfxVolume",
      payload: { volume: this.soundEffectsVolume },
    });
  }
}

export default new SoundManager();