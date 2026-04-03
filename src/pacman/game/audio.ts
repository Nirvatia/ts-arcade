class AudioManager {
  private static instance: AudioManager;
  private context!: AudioContext;
  private masterGain!: GainNode;

  private buffers: Map<string, AudioBuffer> = new Map();
  private activeMusicSource: AudioBufferSourceNode | null = null;
  private isInitialized = false;

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

    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.masterGain.gain.value = 0.5;

    this.isInitialized = true;
  }

  // Wakes up the suspended audio context on user gesture
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
    source.connect(this.masterGain);
    source.start(0);
  }

  public playMusic(name: string, loop: boolean = true) {
    this.stopMusic();

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop; // 🔥 Dynamically use the passed boolean!

    source.connect(this.masterGain);
    source.start(0);

    this.activeMusicSource = source;
  }

  public stopMusic() {
    if (this.activeMusicSource) {
      this.activeMusicSource.stop();
      this.activeMusicSource = null;
    }
  }

  public setVolume(val: number) {
    if (!this.isInitialized) return;
    this.masterGain.gain.value = Math.max(0, Math.min(1, val));
  }
}

export const audio = AudioManager.getInstance();
export { AudioManager };
