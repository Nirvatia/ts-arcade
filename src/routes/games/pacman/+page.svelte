<script lang="ts">
  import { onMount, tick } from "svelte";
  import { Controller } from "../../../pacman/controller/controller.js";
  import { GameState } from "../../../pacman/game/state.js";

  // Tell Vite to resolve the font file's finalized URL
  import fontUrl from "$lib/assets/fonts/Jersey-Regular.ttf?url";
  import { initAudio } from "../../../pacman/utils.js";
  import { audioController } from "../../../pacman/game/audioController.js";

  // 🌟 1. IMPORT THE AUDIO CONTROLLER HERE!

  let isLoading = $state(true);

  onMount(async () => {
    const gameFont = new FontFace("Jersey-Regular", `url(${fontUrl})`);
    document.fonts.add(gameFont);

    try {
      await Promise.all([gameFont.load(), initAudio()]);
      console.log("All assets (Font & SFX) loaded successfully!");
    } catch (error) {
      console.error("Failed to preload assets:", error);
    }

    isLoading = false;
    await tick();

    // 🌟 2. INITIALIZE THE AUDIO CONTROLLER HERE!
    // This turns on the ears of your game before loadGame() runs.
    audioController.init();

    const gameState = GameState.getInstance();
    gameState.loadGame();

    const controller = new Controller();
    controller.init();
  });
</script>

<main class="game-wrapper">
  {#if isLoading}
    <div class="loader-container">
      <div class="spinner"></div>
      <p>LOADING SOUNDS...</p>
    </div>
  {:else}
    <div class="pacman">
      <canvas id="map-cvs"></canvas>
      <canvas id="food-cvs"></canvas>
      <canvas id="pill-cvs"></canvas>
      <canvas id="pacman-cvs"></canvas>
      <canvas id="ghosts-cvs"></canvas>
      <canvas id="ui-cvs"></canvas>
    </div>
  {/if}
</main>

<style lang="scss">
  .game-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background-color: #0c0d10;
    width: 100vw;
    font-family: "Jersey-Regular", monospace;
  }

  /* Retro Spinner Styling */
  .loader-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    color: #ffff00; /* Pac-man Yellow */
    font-size: 1.5rem;
    letter-spacing: 2px;

    .spinner {
      width: 50px;
      height: 50px;
      border: 5px solid #333;
      border-top: 5px solid #ffff00;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .pacman {
    position: relative;

    canvas {
      position: absolute;
      top: 0;
      left: 0;
      image-rendering: auto;
    }

    #map-cvs {
      z-index: 1;
      position: relative;
    }
    #food-cvs {
      z-index: 2;
    }
    #pill-cvs {
      z-index: 3;
    }
    #pacman-cvs {
      z-index: 4;
    }
    #ghosts-cvs {
      z-index: 5;
    }
    #ui-cvs {
      z-index: 6;
    }
  }
</style>
