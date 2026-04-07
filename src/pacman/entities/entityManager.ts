import type { Entity } from "./entity.js";
import { Food } from "../map/food.js";
import { Map } from "../map/map.js";
import { Pill } from "../map/pill.js";
import { Pacman } from "./pacman.js";
import { Ghost } from "./ghost.js";
import { GHOSTS_CONFIG } from "../config/entities.js";

type EntityArray = Entity[];

class EntityManager {
  private static instance: EntityManager | null = null;

  public dynamicEntities: Record<string, EntityArray> = {};
  public staticEntities: Record<string, EntityArray> = {};

  private constructor() {}

  public static getInstance(): EntityManager {
    if (!EntityManager.instance) {
      EntityManager.instance = new EntityManager();
    }
    return EntityManager.instance;
  }

  public createEntities(): void {
    this.staticEntities = {
      food: [new Food()],
      map: [new Map()], // 🌟 Cleaned out UI from static entities!
    };

    this.dynamicEntities = {
      pacman: [new Pacman()],
      ghosts: Object.values(GHOSTS_CONFIG).map(
        ({ name, color }) => new Ghost(name, color),
      ),
      pill: [new Pill()],
    };
  }

  public getAllDynamic(): Entity[] {
    return Object.values(this.dynamicEntities).flat();
  }

  public getAllStatic(): Entity[] {
    return Object.values(this.staticEntities).flat();
  }

  public getFood(): Food {
    return this.staticEntities.food[0] as Food;
  }

  public getPill(): Pill {
    return this.dynamicEntities.pill[0] as Pill;
  }

  // 🌟 Removed getUI() getter entirely!

  public getPacman(): Pacman {
    return this.dynamicEntities.pacman[0] as Pacman;
  }

  public getGhosts(): Ghost[] {
    return this.dynamicEntities.ghosts as Ghost[];
  }

  public initAll(): void {
    [...this.getAllStatic(), ...this.getAllDynamic()].forEach((e) => e.init());
  }

  public resetAll(): void {
    [...this.getAllStatic(), ...this.getAllDynamic()].forEach((e) => e.reset());
  }

  public resetPositionsForDeath(): void {
    const pacman = this.getPacman();
    const ghosts = this.getGhosts();

    // 🌟 CHANGE: Use reset() instead of just spawn()
    // This triggers the direction clearing we added above
    pacman.reset();

    ghosts.forEach((ghost) => {
      ghost.spawn();
      ghost.reset();
    });
  }
  public spawnObjects(): void {
    const food = this.getFood();
    const pill = this.getPill();

    if (food && typeof food.spawn === "function") food.spawn();
    if (pill && typeof pill.spawn === "function") pill.spawn();
  }

  public exitLairAll(): void {
    this.getGhosts().forEach((ghost: Ghost) => {
      ghost.calculateExitPath();
    });
  }

  public spawnEntities(): void {
    this.getPacman().spawn();
    this.getGhosts().forEach((g: Ghost) => g.spawn());
  }

  public resetPositionsForLevel(): void {
    this.getPacman().spawn();
    this.getGhosts().forEach((g: Ghost) => g.spawn());
  }
}

export { EntityManager };
