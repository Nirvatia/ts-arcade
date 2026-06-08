import { eventBus } from "../core/EventBus.js";
import type { GameRegistry } from "../game/GameRegistry.js";

interface SfxConfigEntry {
  name: string;
  url: string;
}

export class SFX {
  private readonly gameRegistry: GameRegistry;
  private readonly config: SfxConfigEntry[];
  private context: AudioContext | null = null;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private audioDataCache: Map<string, ArrayBuffer> = new Map();

  private _isMuted: boolean = false;
  private previousMusicVolume: number = 0.15;
  private previousSfxVolume: number = 0.25;

  private buffers: Map<string, AudioBuffer> = new Map();
  private activeMusicSource: AudioBufferSourceNode | null = null;
  private currentMusicName: string | null = null;

  private wakaToggle: boolean = false;
  private listenersInitialized: boolean = false;
  private pendingMusic: { name: string; loop: boolean } | null = null;
  private loaded: boolean = false;

  constructor(gameRegistry: GameRegistry, config: SfxConfigEntry[]) {
    this.gameRegistry = gameRegistry;
    this.config = config;
  }

  private get activeContext() {
    return this.gameRegistry.getActiveLevel();
  }

  /**
   * Load all audio files from config into cache without decoding.
   * Call this early so files are ready when unlockAudio runs.
   */
  public async preloadAll(): Promise<void> {
    if (this.loaded) return;
    await Promise.all(
      this.config.map((entry) => this.loadSound(entry.name, entry.url)),
    );
    this.loaded = true;
  }

  public async unlockAudio(): Promise<void> {
    if (typeof window === "undefined") return;

    if (!this.context) {
      this.context = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();

      this.musicGain = this.context.createGain();
      this.musicGain.connect(this.context.destination);
      this.musicGain.gain.value = this._isMuted ? 0 : 0.15;

      this.sfxGain = this.context.createGain();
      this.sfxGain.connect(this.context.destination);
      this.sfxGain.gain.value = this._isMuted ? 0 : 0.25;
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    await this.decodeAll();

    if (!this.listenersInitialized) {
      this.initEventListeners();
      this.listenersInitialized = true;
    }

    if (this.pendingMusic) {
      this.playMusic(this.pendingMusic.name, this.pendingMusic.loop);
      this.pendingMusic = null;
    }
  }

  get isMuted(): boolean {
    return this._isMuted;
  }

  public toggleMute(): void {
    if (!this.context) return;
    this._isMuted = !this._isMuted;
    if (this._isMuted) {
      this.previousMusicVolume = this.musicGain.gain.value;
      this.previousSfxVolume = this.sfxGain.gain.value;
      this.musicGain.gain.value = 0;
      this.sfxGain.gain.value = 0;
    } else {
      this.musicGain.gain.value = this.previousMusicVolume;
      this.sfxGain.gain.value = this.previousSfxVolume;
    }
  }

  public async loadSound(name: string, url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`HTTP audio failure: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      this.audioDataCache.set(name, arrayBuffer);
      if (this.context) {
        await this.decodeFromCache(name);
      }
    } catch (err) {
      console.error(`Failed to stage sound asset: ${name}`, err);
    }
  }

  private async decodeFromCache(name: string): Promise<void> {
    if (!this.context || this.buffers.has(name)) return;
    const data = this.audioDataCache.get(name);
    if (data) {
      try {
        const buffer = await this.context.decodeAudioData(data.slice(0));
        this.buffers.set(name, buffer);
      } catch (err) {
        console.error(`Audio translation failure on track: ${name}`, err);
      }
    }
  }

  private async decodeAll(): Promise<void> {
    if (!this.context) return;
    const promises = Array.from(this.audioDataCache.keys()).map((name) =>
      this.decodeFromCache(name),
    );
    await Promise.all(promises);
  }

  public getTrackDuration(name: string): number {
    const buffer = this.buffers.get(name);
    return buffer ? buffer.duration : 0;
  }

  public playSFX(name: string): void {
    if (!this.context) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const clipGain = this.context.createGain();
    source.connect(clipGain);
    clipGain.connect(this.sfxGain);

    if (name === "eat_ghost" || name === "death" || name === "fruit") {
      clipGain.gain.value = 2.2;
    } else {
      clipGain.gain.value = 1.0;
    }

    source.start(0);
  }

  public playMusic(name: string, loop: boolean = true): void {
    if (!this.context) {
      this.pendingMusic = { name, loop };
      return;
    }

    if (this.currentMusicName === name) return;
    this.stopMusic();

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(this.musicGain);
    source.start(0);

    this.activeMusicSource = source;
    this.currentMusicName = name;
  }

  public stopMusic(): void {
    if (this.activeMusicSource) {
      try {
        this.activeMusicSource.stop();
        this.activeMusicSource.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.activeMusicSource = null;
      this.currentMusicName = null;
    }
  }

  public setVolume(val: number): void {
    if (!this.context) return;
    const clampedVal = Math.max(0, Math.min(1, val));
    this.musicGain.gain.value = clampedVal * 0.6;
    this.sfxGain.gain.value = clampedVal;
  }

  private initEventListeners(): void {
    const switchMusic = (newTrack: string, loop: boolean) => {
      if (this.currentMusicName === newTrack) return;
      this.playMusic(newTrack, loop);
    };

    eventBus.on("game:over", () => this.stopMusic());
    eventBus.on("level:complete", () => this.stopMusic());

    eventBus.on("level:countdown_start", () => {
      switchMusic("start", false);
    });

    eventBus.on("game:resume", () => {
      if (
        !this.activeContext ||
        this.activeContext.gameState.mode === "LEVEL_TRANSITION" ||
        this.activeContext.gameState.mode === "LEVEL_COMPLETE"
      )
        return;
      switchMusic("siren_0", true);
    });

    eventBus.on("power_pill:activated", () => {
      if (
        !this.activeContext ||
        this.activeContext.gameState.mode === "LEVEL_TRANSITION" ||
        this.activeContext.gameState.mode === "LEVEL_COMPLETE"
      )
        return;

      const runningEyes = this.activeContext.ghosts.some(
        (g) => g.state === "EATEN",
      );
      if (runningEyes) {
        this.currentMusicName = "fright";
        return;
      }
      switchMusic("fright", true);
    });

    eventBus.on("power_pill:expired", () => {
      if (
        !this.activeContext ||
        this.activeContext.gameState.mode === "LEVEL_TRANSITION" ||
        this.activeContext.gameState.mode === "LEVEL_COMPLETE"
      )
        return;
      if (this.activeContext.ghosts.some((g) => g.state === "EATEN")) return;
      switchMusic("siren_0", true);
    });

    eventBus.on("ghost:eaten", (_payload) => {
      this.stopMusic();
      this.playSFX("eat_ghost");
      switchMusic("eyes", true);
    });

    eventBus.on("ghost:returned_home", () => {
      if (
        !this.activeContext ||
        this.activeContext.gameState.mode === "LEVEL_TRANSITION" ||
        this.activeContext.gameState.mode === "LEVEL_COMPLETE"
      )
        return;
      if (this.activeContext.ghosts.some((g) => g.state === "EATEN")) return;

      if (this.activeContext.gameState.isBuffed) {
        switchMusic("fright", true);
      } else {
        switchMusic("siren_0", true);
      }
    });

    eventBus.on("pacman:death_animation_start", () => {
      this.stopMusic();
      this.playSFX("death");
    });

    eventBus.on("dot:eaten", () => {
      if (!this.activeContext) return;
      if (
        this.activeContext.ghosts.some(
          (g) => g.state === "FRIGHTENED" || g.state === "EATEN",
        )
      )
        return;

      const soundToPlay = this.wakaToggle ? "waka_1" : "waka_0";
      this.playSFX(soundToPlay);
      this.wakaToggle = !this.wakaToggle;
    });

    eventBus.on("power_pill:eaten", () => this.playSFX("fruit"));

    eventBus.on("level:intermission_start", () =>
      switchMusic("intermission", false),
    );
  }
}
