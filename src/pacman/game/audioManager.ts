class AudioManager {
  private static instance: AudioManager;
  private context!: AudioContext;

  // 🌟 Kept your exact properties
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private currentMusicVolume: number = 0.3; // Default to 30% to avoid overloading ears

  private buffers: Map<string, AudioBuffer> = new Map();
  private activeMusicSource: AudioBufferSourceNode | null = null;
  private isInitialized = false;
  private currentMusicName: string | null = null;

  private constructor() {
    // Keep constructor empty so it doesn't crash on the server!
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init() {
    if (this.isInitialized || typeof window === "undefined") return;

    this.context = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();

    // Setup independent lanes
    this.musicGain = this.context.createGain();
    this.musicGain.connect(this.context.destination);
    this.musicGain.gain.value = 0.15; // 🌟 Siren/Fright/Eyes sit quietly in the back

    this.sfxGain = this.context.createGain();
    this.sfxGain.connect(this.context.destination);
    this.sfxGain.gain.value = 0.25; // 🌟 Default SFX volume (perfect for constant Wakas)

    this.isInitialized = true;
  }

  public async unlockAudio(): Promise<void> {
    if (this.context && this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  public async loadSound(name: string, url: string): Promise<void> {
    this.init();

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

    this.buffers.set(name, audioBuffer);
  }

  public playSFX(name: string) {
    if (!this.isInitialized) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    // Create a temporary gain node for this specific sound clip
    const clipGain = this.context.createGain();
    source.connect(clipGain);
    clipGain.connect(this.sfxGain);

    // 🌟 SCALE SPECIFIC SOUNDS
    // We can bump up heavy, rare sound events independently of the wakas!
    if (name === "eat_ghost" || name === "death" || name === "fruit") {
      clipGain.gain.value = 2.2; // Multiplies with sfxGain to reach ~0.55
    } else {
      clipGain.gain.value = 1.0;
    }

    source.start(0);
  }

  public playMusic(name: string, loop: boolean = true) {
    if (this.currentMusicName === name) return;

    this.stopMusic();

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    // 🌟 THE FIX: Connect directly to the music lane instead of missing masterGain
    source.connect(this.musicGain);
    source.start(0);

    this.activeMusicSource = source;
    this.currentMusicName = name;
  }

  public stopMusic() {
    if (this.activeMusicSource) {
      try {
        this.activeMusicSource.stop();
        this.activeMusicSource.disconnect();
      } catch (e) {
        // Suppress node connection errors
      }
      this.activeMusicSource = null;
      this.currentMusicName = null;
    }
  }

  // 🌟 THE FIX: Adjusted this to set both volumes proportionally
  public setVolume(val: number) {
    if (!this.isInitialized) return;
    const clampedVal = Math.max(0, Math.min(1, val));

    this.musicGain.gain.value = clampedVal * 0.6; // Scale music slightly lower
    this.sfxGain.gain.value = clampedVal;
  }
}

export const getAudio = () => AudioManager.getInstance();
