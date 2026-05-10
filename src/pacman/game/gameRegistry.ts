// src/core/GameRegistry.ts

import { Ghost } from "../actors/ghost.js";
import { Pacman } from "../actors/pacman.js";
import { CFG_GHOSTS } from "../config/ghosts.js";
import { eventBus } from "../core/eventBus.js";
import type { Drawable, Updatable } from "../interfaces.js";
import { Dot } from "../world/dot.js";
import { Maze } from "../world/maze.js";
import { Pill } from "../world/pill.js";

/**
 * Центральный реестр всех игровых объектов.
 * Управляет созданием, доступом и жизненным циклом сущностей.
 * Разделяет объекты на статические (Drawable) и динамические (Updatable).
 */
export class GameRegistry {
  private static instance: GameRegistry | null = null;

  /** Статические объекты (только отрисовка, перерисовка по флагу) */
  private _staticDrawables: Map<string, Drawable[]> = new Map();

  /** Динамические объекты (обновление + отрисовка каждый кадр) */
  private _dynamicUpdatables: Map<string, Updatable[]> = new Map();

  private constructor() {
    this.initEventListeners();
  }

  /** Получить единственный экземпляр реестра */
  static getInstance(): GameRegistry {
    if (!GameRegistry.instance) {
      GameRegistry.instance = new GameRegistry();
    }
    return GameRegistry.instance;
  }

  private initEventListeners(): void {
    eventBus.on("command:create_entities", () => this.createEntities());
    eventBus.on("command:reset_all", () => this.resetAll());
    eventBus.on("command:spawn_entities", () => this.spawnEntities());
    eventBus.on("command:exit_lair_all", () => this.exitLairAll());
    eventBus.on("command:init_all", () => this.initAll());
    eventBus.on("command:reset_positions", () => this.resetPositionsForDeath());
    eventBus.on("command:clear_canvases", () => this.clearAllCanvases());
  }

  /**
   * Создаёт все игровые объекты и регистрирует их.
   * Вызывается один раз при загрузке игры.
   */
  createEntities(): void {
    // Статические объекты (Drawable)
    this._staticDrawables.set("maze", [new Maze()]);
    this._staticDrawables.set("dot", [new Dot()]);

    // Динамические объекты (Updatable)
    this._dynamicUpdatables.set("pacman", [new Pacman()]);
    this._dynamicUpdatables.set(
      "ghosts",
      Object.values(CFG_GHOSTS).map(
        ({ name, color }) => new Ghost(name, color),
      ),
    );
    this._dynamicUpdatables.set("pill", [new Pill()]);
  }

  /** Получить все динамические сущности (Updatable) */
  getAllUpdatable(): Updatable[] {
    return Array.from(this._dynamicUpdatables.values()).flat();
  }

  /** Получить все статические сущности (Drawable) */
  getAllDrawable(): Drawable[] {
    return Array.from(this._staticDrawables.values()).flat();
  }

  /** Получить Пакмана */
  getPacman(): Pacman {
    return this._dynamicUpdatables.get("pacman")![0] as Pacman;
  }

  /** Получить всех призраков */
  getGhosts(): Ghost[] {
    return (this._dynamicUpdatables.get("ghosts") || []) as Ghost[];
  }

  /** Получить все точки (Dot) */
  getDots(): Dot {
    return this._staticDrawables.get("dot")![0] as Dot;
  }

  /** Получить все энерджайзеры (Pill) */
  getPills(): Pill {
    return this._dynamicUpdatables.get("pill")![0] as Pill;
  }

  /** Получить лабиринт (Maze) */
  getMaze(): Maze {
    return this._staticDrawables.get("maze")![0] as Maze;
  }

  // --- Жизненный цикл ---

  /** Инициализировать все сущности */
  initAll(): void {
    [...this.getAllDrawable(), ...this.getAllUpdatable()].forEach((e) => {
      if ("init" in e && typeof (e as any).init === "function") {
        (e as any).init();
      }
    });
  }

  /** Сбросить все сущности */
  resetAll(): void {
    [...this.getAllDrawable(), ...this.getAllUpdatable()].forEach((e) => {
      if ("reset" in e && typeof (e as any).reset === "function") {
        (e as any).reset();
      }
    });
  }

  /** Сбросить и заспавнить объекты для нового уровня */
  spawnObjects(): void {
    const dot = this.getDots();
    const pill = this.getPills();

    if (dot && typeof dot.spawn === "function") dot.spawn();
    if (pill && typeof pill.spawn === "function") pill.spawn();
  }

  /** Заспавнить всех акторов (Пакман + призраки) */
  spawnEntities(): void {
    this.getPacman().spawn();
    this.getGhosts().forEach((g) => g.spawn());
  }

  /** Запустить выход призраков из логова */
  exitLairAll(): void {
    this.getGhosts().forEach((ghost: Ghost) => {
      ghost.calculateExitPath();
    });
  }

  /** Сброс позиций после смерти Пакмана */
  resetPositionsForDeath(): void {
    const pacman = this.getPacman();
    const ghosts = this.getGhosts();

    pacman.reset();
    ghosts.forEach((ghost) => {
      ghost.spawn();
      ghost.reset();
    });
  }

  /** Сброс позиций для нового уровня */
  resetPositionsForLevel(): void {
    this.getPacman().spawn();
    this.getGhosts().forEach((g: Ghost) => g.spawn());
  }

  /** Очистить холсты всех сущностей */
  clearAllCanvases(): void {
    [...this.getAllDrawable(), ...this.getAllUpdatable()].forEach((e) => {
      if ("canvas" in e && (e as any).canvas) {
        const canvas = (e as any).canvas as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
  }
}
