import type { PixiScene } from "../shared/types.js";
import { observerScene } from "./observerScene.js";

export const pixiScenes: Record<string, PixiScene> = {
  the_observer: observerScene,
};
