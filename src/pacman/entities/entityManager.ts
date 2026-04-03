import type { Entity } from "./entity.js";
import { Food } from "../map/food.js";
import { Map } from "../map/map.js";
import { Pill } from "../map/pill.js";
import { UI } from "../ui/ui.js";
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
      ui: [new UI()],
      map: [new Map()],
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

  public getUI(): UI {
    return this.staticEntities.ui[0] as UI;
  }

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

  // Call this when Pac-man dies to snap positions back without resetting score/dots
  public resetPositionsForDeath(): void {
    const pacman = this.getPacman();
    const ghosts = this.getGhosts();

    // 1. Respawn Pacman at his starting tile
    pacman.spawn();
    pacman.state = "ALIVE";

    // 2. Respawn ghosts and clear their AI brains so they don't wander through walls
    ghosts.forEach((ghost) => {
      ghost.spawn();
      ghost.reset(); // This clears direction, speed, and color
    });
  }
  // 1. Call this in GameState's loadLevel()
  // This ensures the screen isn't empty on the title screen!
  public spawnObjects(): void {
    const food = this.getFood();
    const pill = this.getPill();

    // If your Food/Pill classes have separate spawn or setup methods,
    // call them here! Otherwise, making sure they exist in the array is enough.
    if (food && typeof food.spawn === "function") food.spawn();
    if (pill && typeof pill.spawn === "function") pill.spawn();
  }

  public exitLairAll(): void {
    this.getGhosts().forEach((ghost: Ghost) => {
      ghost.calculateExitPath();
    });
  }

  // 2. Call this in GameState's startGame() on Enter.
  // This drops the characters in and cleans up the map array!
  public spawnEntities(): void {
    this.getPacman().spawn();
    this.getGhosts().forEach((g: Ghost) => g.spawn());
  }

  // 3. Keep this for when Pacman dies and you just need to reset positions
  public resetPositionsForLevel(): void {
    this.getPacman().spawn();
    this.getGhosts().forEach((g: Ghost) => g.spawn());
  }
}

export { EntityManager };
