export class AudioManager {
  private static music: HTMLAudioElement | null = null;
  private static sounds: Record<string, HTMLAudioElement> = {};
  private static isInitialized = false;
  private static isMusicPlaying = false;
  private static musicVolume = 0.5;
  private static sfxVolume = 1.0;

  private static looping: Record<string, HTMLAudioElement> = {};

  static assets: Record<string, string> = {
    music: "/assets/music.mp3",
    reel: "/assets/reel.mp3",      
    win: "/assets/win.mp3",       
  };

  static async init() {
    if (this.isInitialized) return;

    this.music = new Audio(this.assets["music"]);
    this.music.loop = true;
    this.music.volume = this.musicVolume;

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
    const audio = this.sounds[sfx];
    if (!audio) return;
    try {
      if (!audio.paused) {
        const clone = audio.cloneNode(true) as HTMLAudioElement;
        clone.volume = audio.volume;
        clone.play();
      } else {
        audio.currentTime = 0;
        audio.play();
      }
    } catch (e) {  }
  }

  static playLoop(sfx: string) {
    this.stopLoop(sfx);

    const orig = this.sounds[sfx];
    if (!orig) return;

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

  static stop(sfx: string) {
    this.stopLoop(sfx);
    const s = this.sounds[sfx];
    if (s) {
      s.pause();
      s.currentTime = 0;
    }
  }
}