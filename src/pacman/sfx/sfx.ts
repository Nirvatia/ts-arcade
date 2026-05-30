import { eventBus } from "../core/eventBus.js";
import { GameRegistry } from "../game/gameRegistry.js";
import { GameState } from "../game/gameState.svelte.js";

/**
 * Управляет всеми звуковыми эффектами и музыкой в игре.
 * Объединяет функциональность AudioManager и AudioController.
 */
export class SFX {
  private static instance: SFX;
  private context!: AudioContext;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private audioDataCache: Map<string, ArrayBuffer> = new Map();

  private _isMuted: boolean = false;
  private previousMusicVolume: number = 0.15;
  private previousSfxVolume: number = 0.25;

  private buffers: Map<string, AudioBuffer> = new Map();
  private activeMusicSource: AudioBufferSourceNode | null = null;
  private isInitialized: boolean = false;
  private currentMusicName: string | null = null;

  private wakaToggle: boolean = false;

  private constructor() {}

  static getInstance(): SFX {
    if (!SFX.instance) {
      SFX.instance = new SFX();
    }
    return SFX.instance;
  }

  /** Инициализация аудиоконтекста и слушателей событий */
  init(): void {
    if (this.isInitialized || typeof window === "undefined") return;

    this.context = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();

    // Сразу проверяем состояние, если заблокировано - resume()
    if (this.context.state === "suspended") {
      this.context.resume();
    }

    this.musicGain = this.context.createGain();
    this.musicGain.connect(this.context.destination);
    this.musicGain.gain.value = 0.15;

    this.sfxGain = this.context.createGain();
    this.sfxGain.connect(this.context.destination);
    this.sfxGain.gain.value = 0.25;

    this.isInitialized = true;
    this.initEventListeners();
  }

  /** Получить muted состояние */
  get isMuted(): boolean {
    return this._isMuted;
  }

  /** Включить/выключить звук */
  toggleMute(): void {
    if (!this.isInitialized) return;

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

  /**
   * Загружаем только ArrayBuffer, не трогая AudioContext!
   */
  async loadSound(name: string, url: string): Promise<void> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    this.audioDataCache.set(name, arrayBuffer);

    // Если контекст уже есть (например, загружаем новый уровень), декодируем сразу
    if (this.isInitialized) {
      await this.decodeFromCache(name);
    }
  }

  /** Вспомогательный метод для декодирования */
  private async decodeFromCache(name: string): Promise<void> {
    const data = this.audioDataCache.get(name);
    if (data && !this.buffers.has(name)) {
      // slice() нужен, так как decodeAudioData "съедает" буфер
      const buffer = await this.context.decodeAudioData(data.slice(0));
      this.buffers.set(name, buffer);
    }
  }

  /** Метод для массового декодирования при старте */
  async decodeAll(): Promise<void> {
    this.init(); // Создаем контекст (здесь это легально, т.к. вызов из контроллера)
    const promises = Array.from(this.audioDataCache.keys()).map((name) =>
      this.decodeFromCache(name),
    );
    await Promise.all(promises);
  }

  async unlockAudio(): Promise<void> {
    if (!this.isInitialized) {
      await this.decodeAll(); // Инициализация и декодирование
    }
    if (this.context && this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  /** Получить длительность трека в секундах */
  getTrackDuration(name: string): number {
    if (!this.isInitialized) return 0;
    const buffer = this.buffers.get(name);
    return buffer ? buffer.duration : 0;
  }

  /** Воспроизвести звуковой эффект */
  playSFX(name: string): void {
    if (!this.isInitialized) return;
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

  /** Воспроизвести фоновую музыку */
  playMusic(name: string, loop: boolean = true): void {
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

  /** Остановить музыку */
  stopMusic(): void {
    if (this.activeMusicSource) {
      try {
        this.activeMusicSource.stop();
        this.activeMusicSource.disconnect();
      } catch (e) {
        // Игнорируем ошибки при остановке
      }
      this.activeMusicSource = null;
      this.currentMusicName = null;
    }
  }

  /** Установить общую громкость */
  setVolume(val: number): void {
    if (!this.isInitialized) return;
    const clampedVal = Math.max(0, Math.min(1, val));
    this.musicGain.gain.value = clampedVal * 0.6;
    this.sfxGain.gain.value = clampedVal;
  }

  // --- Слушатели событий ---

  private initEventListeners(): void {
    const registry = GameRegistry.getInstance();
    const gameState = GameState.getInstance();

    let currentMusic: string | null = null;

    const switchMusic = (newTrack: string, loop: boolean) => {
      if (currentMusic === newTrack) return;
      this.stopMusic();
      this.playMusic(newTrack, loop);
      currentMusic = newTrack;
    };

    eventBus.on("game:over", () => {
      this.stopMusic();
      currentMusic = null;
    });

    eventBus.on("level:transition_start", () => {
      this.stopMusic();
      currentMusic = null;
      switchMusic("start", false);
    });

    eventBus.on("game:started", () => {
      switchMusic("siren_0", true);
    });

    eventBus.on("game:resumed", () => {
      switchMusic("siren_0", true);
    });

    eventBus.on("power_pill:activated", () => {
      const runningEyes = registry.getGhosts().some((g) => g.state === "EATEN");
      if (runningEyes) {
        currentMusic = "fright";
        return;
      }
      switchMusic("fright", true);
    });

    eventBus.on("power_pill:expired", () => {
      const runningEyes = registry.getGhosts().some((g) => g.state === "EATEN");
      if (runningEyes) return;
      switchMusic("siren_0", true);
    });

    eventBus.on("ghost:eaten", () => {
      this.stopMusic();
      currentMusic = null;
      this.playSFX("eat_ghost");
      switchMusic("eyes", true);
    });

    eventBus.on("ghost:returned_home", () => {
      const runningEyes = registry.getGhosts().some((g) => g.state === "EATEN");
      if (runningEyes) return;
      if (gameState.isBuffed) {
        switchMusic("fright", true);
      } else {
        switchMusic("siren_0", true);
      }
    });

    eventBus.on("pacman:death_animation_start", () => {
      this.stopMusic();
      currentMusic = null;
      this.playSFX("death");
    });

    eventBus.on("dot:eaten", () => {
      const ghosts = registry.getGhosts();
      const abnormalStateActive = ghosts.some(
        (g) => g.state === "FRIGHTENED" || g.state === "EATEN",
      );
      if (abnormalStateActive) return;

      const soundToPlay = this.wakaToggle ? "waka_1" : "waka_0";
      this.playSFX(soundToPlay);
      this.wakaToggle = !this.wakaToggle;
    });

    eventBus.on("power_pill:eaten", () => {
      this.playSFX("fruit");
    });

    eventBus.on("level:intermission_start", () => {
      switchMusic("intermission", false);
    });
  }
}

export const sfx = SFX.getInstance();
