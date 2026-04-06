import { Renderer } from "./renderer.js";
import { GameState } from "./state.js";
import { EntityManager } from "../entities/entityManager.js";

class GameLoop {
  renderer: Renderer;
  private entityManager = EntityManager.getInstance(); // 🌟 ДОБАВИЛИ
  private static instance: GameLoop;
  private fps: number;
  private now: number | null = null;
  private then: number;
  private interval: number;
  private delta: number | null = null;
  private timer: number | null = null;

  constructor(fps: number = 60) {
    this.renderer = Renderer.getInstance();
    this.fps = fps;
    this.then = Date.now();
    this.interval = 1000 / this.fps;
  }

  static getInstance(): GameLoop {
    if (!GameLoop.instance) {
      GameLoop.instance = new GameLoop();
    }
    return GameLoop.instance;
  }

  // В методе loop() класса GameLoop
  public loop() {
    this.timer = requestAnimationFrame(() => this.loop());

    this.now = Date.now();
    this.delta = this.now - this.then;

    if (this.delta > this.interval) {
      this.then = this.now - (this.delta % this.interval);

      const gameState = GameState.getInstance();

      // 🌟 ФАЗА UPDATE 🌟
      if (gameState.mode === "PLAYING") {
        this.entityManager
          .getAllDynamic()
          .forEach((entity) => entity.update(this.delta!));
        this.entityManager
          .getAllStatic()
          .forEach((entity) => entity.update(this.delta!));
      } else if (gameState.mode === "INTERMISSION") {
        // Здесь мы обновляем только координаты персонажей в мультфильме!
        const ui = this.entityManager.getUI();
        const intermission = ui.getIntermission();
        if (intermission) {
          intermission.update(this.delta!);
        }
      }

      // 🌟 ФАЗА RENDER 🌟
      if (
        gameState.mode !== "PAUSED" &&
        gameState.mode !== "LEVEL_TRANSITION"
      ) {
        this.renderer.render(this.delta!);
      }
    }
  }

  public start() {
    if (!this.timer) {
      this.loop();
    }
  }

  public stop() {
    if (this.timer) {
      cancelAnimationFrame(this.timer);
      this.timer = null;
    }
  }
}

export { GameLoop };
