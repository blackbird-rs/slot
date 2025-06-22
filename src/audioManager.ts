/**
 * AudioManager for handling background music and sound effects.
 * Usage:
 *   await AudioManager.init();
 *   AudioManager.playMusic();
 *   AudioManager.play('spin');
 *   AudioManager.play('reel');
 *   AudioManager.play('win');
 *   AudioManager.stopMusic();
 *   AudioManager.stop('win');
 */
export class AudioManager {
  private static music: HTMLAudioElement | null = null;
  private static sounds: Record<string, HTMLAudioElement> = {};
  private static isInitialized = false;
  private static isMusicPlaying = false;
  private static musicVolume = 0.5;
  private static sfxVolume = 1.0;

  // Track which sounds are currently looping (e.g. win, reel)
  private static looping: Record<string, HTMLAudioElement> = {};

  // Set up your sound asset paths here!
  static assets: Record<string, string> = {
    music: "/assets/music.mp3",     // Looping background music
    //spin: "/assets/spin.mp3",       // Button press sound (spin start)
    reel: "/assets/reel.mp3",       // Reels spinning sound (looped, or per reel)
    win: "/assets/win.mp3",         // Win sound (to be looped until next spin)
    // Add more as needed
  };

  static async init() {
    if (this.isInitialized) return;

    // Preload music
    this.music = new Audio(this.assets["music"]);
    this.music.loop = true;
    this.music.volume = this.musicVolume;

    // Preload SFX
    for (const [key, path] of Object.entries(this.assets)) {
      if (key === "music") continue;
      const audio = new Audio(path);
      audio.volume = this.sfxVolume;
      this.sounds[key] = audio;
    }

    this.isInitialized = true;
  }

  static playMusic() {
    if (!this.music) return;
    if (!this.isMusicPlaying) {
      this.music.currentTime = 0;
      this.music.play();
      this.isMusicPlaying = true;
    }
  }
  static stopMusic() {
    if (this.music && this.isMusicPlaying) {
      this.music.pause();
      this.isMusicPlaying = false;
    }
  }

  static setMusicVolume(vol: number) {
    this.musicVolume = vol;
    if (this.music) this.music.volume = vol;
  }
  static setSfxVolume(vol: number) {
    this.sfxVolume = vol;
    for (const snd of Object.values(this.sounds)) snd.volume = vol;
  }

  static play(sfx: string) {
    // For one-shot effects, not looped
    const audio = this.sounds[sfx];
    if (!audio) return;
    try {
      // To allow overlapping, clone and play, or rewind and play
      if (!audio.paused) {
        const clone = audio.cloneNode(true) as HTMLAudioElement;
        clone.volume = audio.volume;
        clone.play();
      } else {
        audio.currentTime = 0;
        audio.play();
      }
    } catch (e) { /* ignore playback errors */ }
  }

  static playLoop(sfx: string) {
    // Stop existing loop if any
    this.stopLoop(sfx);

    const orig = this.sounds[sfx];
    if (!orig) return;

    // Clone for looping, so you can interrupt at any time
    const loopAudio = orig.cloneNode(true) as HTMLAudioElement;
    loopAudio.loop = true;
    loopAudio.volume = orig.volume;
    loopAudio.currentTime = 0;
    loopAudio.play();
    this.looping[sfx] = loopAudio;
  }

  static stopLoop(sfx: string) {
    const loopAudio = this.looping[sfx];
    if (loopAudio) {
      loopAudio.pause();
      loopAudio.currentTime = 0;
      delete this.looping[sfx];
    }
  }

  /** Convenience: stop any sound (including non-looped) */
  static stop(sfx: string) {
    this.stopLoop(sfx);
    const s = this.sounds[sfx];
    if (s) {
      s.pause();
      s.currentTime = 0;
    }
  }
}