<script lang="ts">
  import { onMount, tick } from "svelte";
  import { Controller } from "../../../pacman/controller/controller.js";
  import { GameState } from "../../../pacman/game/state.js";
  import { Intermission } from "../../../pacman/game/intermission.js";
  import { audioController } from "../../../pacman/game/audioController.js";
  import { initAudio } from "../../../pacman/utils.js";
  import fontUrl from "$lib/assets/fonts/Jersey-Regular.ttf?url";

  let isLoading = $state(true);
  let score = $state(0);
  let lives = $state(3);
  let gameMode = $state("INIT");
  let countdown = $state(0);

  // 🌟 Dynamic canvas size bounds!
  let canvasWidth = $state(448); // Default fallback
  let canvasHeight = $state(496); // Default fallback

  let intermissionCanvas: HTMLCanvasElement | null = $state(null);
  let intermissionInstance: Intermission | null = null;

  onMount(async () => {
    const gameFont = new FontFace("Jersey-Regular", `url(${fontUrl})`);
    document.fonts.add(gameFont);

    try {
      await Promise.all([gameFont.load(), initAudio()]);
    } catch (error) {
      console.error("Failed to preload assets:", error);
    }

    isLoading = false;
    await tick();

    audioController.init();

    const gameState = GameState.getInstance();
    gameState.loadGame();

    // 🌟 AFTER loadGame() runs, your Entity calls resizeCanvas().
    // We can immediately steal the true calculated widths here!
    const mapCanvas = document.getElementById("map-cvs") as HTMLCanvasElement;
    if (mapCanvas) {
      canvasWidth = mapCanvas.width;
      canvasHeight = mapCanvas.height;
    }

    const loop = (gameState as any).gameLoop;
    if (loop) {
      const originalLoop = loop.loop;

      loop.loop = function () {
        originalLoop.call(loop);

        score = gameState.score;
        lives = gameState.lives;
        gameMode = gameState.mode;

        // 🌟 If Game Over, force countdown to 0 so the UI hides it
        if (gameMode === "GAME_OVER") {
          countdown = 0;
          return;
        }

        // If the map changes during gameplay, read the new dynamic sizes
        if (
          mapCanvas &&
          (mapCanvas.width !== canvasWidth || mapCanvas.height !== canvasHeight)
        ) {
          canvasWidth = mapCanvas.width;
          canvasHeight = mapCanvas.height;
        }

        const activeTimer = (gameState as any).activeTimer;
        if (activeTimer && typeof activeTimer.getRemaining === "function") {
          countdown = activeTimer.getRemaining();
        } else {
          countdown = 0;
        }
      };
    }

    const controller = new Controller();
    controller.init();
  });

  $effect(() => {
    if (gameMode === "INTERMISSION" && intermissionCanvas) {
      const ctx = intermissionCanvas.getContext("2d");
      if (ctx) {
        intermissionInstance = new Intermission(
          intermissionCanvas,
          ctx,
          "Jersey-Regular",
        );
        intermissionInstance.start(5, async () => {
          // 1. Wait for Svelte to process the state change
          await tick();
          // 2. The GameState.nextLevel() call will handle the rest
        });

        let lastTime = performance.now();
        const animate = (currentTime: number) => {
          if (gameMode !== "INTERMISSION") return;

          const dt = currentTime - lastTime;
          lastTime = currentTime;

          intermissionInstance?.update(dt);
          intermissionInstance?.draw();

          requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }
  });
</script>

<main class="game-wrapper">
  {#if isLoading}
    <div class="loader-container">
      <div class="spinner"></div>
      <p>LOADING SOUNDS...</p>
    </div>
  {:else}
    <div
      class="pacman-container"
      style="width: {canvasWidth}px; height: {canvasHeight}px;"
    >
      <canvas id="map-cvs"></canvas>
      <canvas id="food-cvs"></canvas>
      <canvas id="pill-cvs"></canvas>
      <canvas id="pacman-cvs"></canvas>
      <canvas id="ghosts-cvs"></canvas>

      {#if gameMode === "GAME_OVER"}
        <div class="game-over-screen">
          <h1>GAME OVER</h1>
          <p>FINAL SCORE: {score}</p>
          <button on:click={() => GameState.getInstance().restartGame()}>
            TRY AGAIN
          </button>
        </div>
      {:else}
        {#if gameMode === "LEVEL_TRANSITION"}
          <div class="overlay ready-text">
            {countdown > 1 ? countdown : "READY!"}
          </div>
        {/if}

        {#if gameMode === "PAUSED"}
          <div class="overlay paused-text">PAUSED</div>
        {/if}

        {#if gameMode === "INTERMISSION"}
          <div class="overlay intermission-wrapper">
            <canvas
              bind:this={intermissionCanvas}
              width={canvasWidth}
              height={canvasHeight}
            ></canvas>
          </div>
        {/if}

        <div class="html-hud">
          <div class="ui-section">
            <span class="label">SCORE:</span>
            <span class="value">{score}</span>
          </div>

          <div class="ui-section">
            <span class="label">LIVES:</span>
            <div class="lives-wrapper">
              <div class="pacman-icon"></div>
              <span class="value">x {lives}</span>
            </div>
          </div>
        </div>
      {/if}
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

  .pacman-container {
    position: relative;

    canvas {
      position: absolute;
      top: 0;
      left: 0;
      image-rendering: auto;
    }

    #map-cvs {
      position: relative;
      z-index: 1;
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
  }

  /* 🌟 Absolute Overlay Styles */
  .overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10;
    pointer-events: none;
  }

  .ready-text {
    color: #ffff00;
    font-size: 4rem;
    text-shadow: 2px 2px 0px #000;
  }

  .paused-text,
  .game-over-text {
    color: #ff0000;
    font-size: 4rem;
    background: rgba(0, 0, 0, 0.6);
  }

  .intermission-wrapper {
    canvas {
      position: relative;
    }
  }

  /* 🌟 HUD Bar at the Bottom */
  .html-hud {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 12px 10px; /* Reduced padding slightly for clean alignment */
    box-sizing: border-box;
    letter-spacing: 1.5px;

    /* 🌟 REMOVED background: rgba(0, 0, 0, 0.85); */

    position: absolute;
    bottom: -50px;
    left: 0;
  }

  .ui-section {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .label,
  .value {
    color: rgba(250, 240, 98, 0.85);
    font-size: 1.8rem;
  }

  .lives-wrapper {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Renders Pac-Man purely in CSS! */
  .pacman-icon {
    width: 22px;
    height: 22px;
    background: rgba(250, 240, 98, 0.85);
    border-radius: 50%;
    clip-path: polygon(
      100% 20%,
      50% 50%,
      100% 80%,
      100% 100%,
      0 100%,
      0 0,
      100% 0
    );
  }

  /* Retro Spinner Styling */
  .loader-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    color: #ffff00;
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

  .game-over-screen {
    position: absolute;
    inset: 0;
    background-color: #0c0d10;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 100;
    color: #ffff00;
    font-family: "Jersey-Regular", sans-serif;
  }

  button {
    margin-top: 20px;
    padding: 10px 30px;
    background: transparent;
    border: 2px solid #ffff00;
    color: #ffff00;
    font-size: 2rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  button:hover {
    background: #ffff00;
    color: #000;
  }
</style>
