<script lang="ts">
  import { onMount, tick } from "svelte";

  import fontUrl from "$lib/assets/fonts/Jersey-Regular.ttf?url";
  import ArcadeCabinet from "$lib/layout/ArcadeCabinet.svelte";

  import { CFG_CANVAS } from "../../../pacman/config/canvas.config.js";
  import { Director } from "../../../pacman/game/Director.svelte.js";
  import { sfx } from "../../../pacman/sfx/SFX.js";
  import { eventBus } from "../../../pacman/core/EventBus.js";
  import { Environment } from "../../../pacman/world/Environment.js";
  import { GameLoop } from "../../../pacman/core/GameLoop.js";
  import { Tally } from "../../../pacman/game/Tally.svelte.js";
  import { GameState } from "../../../pacman/game/GameState.svelte.js";
  import { Controller } from "../../../pacman/controller/Controller.js";
  import { initAudio } from "../../../pacman/shared/utils.js";

  let isLoading = $state(true);
  let canvasWidth = $state(448);
  let canvasHeight = $state(496);

  const gameState = GameState.getInstance();
  const tally = Tally.getInstance();
  const director = Director.getInstance();
  const gameLoop = GameLoop.getInstance();
  const environment = Environment.getInstance();

  let countdown = $derived.by(() => {
    const activeClock = director.currentClock;
    if (!activeClock || !activeClock.isRunning) return 0;

    const remaining = activeClock.getRemaining();

    return remaining;
  });

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

    eventBus.emit("game:load");

    const mapCanvas = document.getElementById(
      CFG_CANVAS.canvasIds.maze,
    ) as HTMLCanvasElement;
    if (mapCanvas) {
      canvasWidth = mapCanvas.width;
      canvasHeight = mapCanvas.height;
    }

    const controller = new Controller();
    controller.init();
  });

  async function handleStart() {
    await sfx.unlockAudio();
    eventBus.emit("game:start");
  }

  async function handleRestart() {
    await sfx.unlockAudio();
    eventBus.emit("game:restart");
  }
</script>

<ArcadeCabinet
  gameName="Pac-Man"
  screenWidth={canvasWidth}
  screenHeight={canvasHeight}
>
  {#snippet game()}
    {#if isLoading}
      <div class="game-loader">
        <div class="vector-spinner"></div>
        <p class="loading-text">SYSTEM_INITIALIZE...</p>
      </div>
    {:else}
      <div
        class="game-container"
        style="width: {canvasWidth}px; height: {canvasHeight}px;"
      >
        <canvas id={CFG_CANVAS.canvasIds.maze}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.dots}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.pills}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.pacman}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.vignette}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.scene}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.ghosts}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.ui}></canvas>

        {#if gameState.mode === "INIT" || gameState.mode === "GAME_OVER"}
          <div class="screen-overlay">
            {#if gameState.mode === "GAME_OVER"}
              <div class="terminal-header">
                <h1 class="game-over-title">CONNECTION_LOST // GAME_OVER</h1>
              </div>
              <div class="final-score-box">
                <span class="score-label">DATA_RETRIEVED</span>
                <span class="score-number">{tally.score.toLocaleString()}</span>
              </div>
              <button class="cabinet-button" onclick={handleRestart}>
                [ RESTART ]
              </button>
              <div class="credit-text">TERMINAL_READY // INSERT_COIN</div>
            {:else}
              <div class="attract-content">
                <h1 class="attract-title">PAC-MAN // VECTOR_OS</h1>
                <div class="character-row">
                  <div class="vector-node"></div>
                  <div class="vector-node"></div>
                  <div class="vector-node"></div>
                  <div class="vector-node"></div>
                </div>
                <button class="cabinet-button start-btn" onclick={handleStart}>
                  [ START ]
                </button>
                <div class="credit-text blink">CREDIT // 01</div>
              </div>
            {/if}
          </div>
        {:else}
          {#if gameState.mode === "LEVEL_TRANSITION"}
            <div class="game-overlay ready-text">
              {countdown > 1 ? Math.ceil(countdown) : "RUN_PROGRAM"}
            </div>
          {/if}
          {#if gameState.mode === "PAUSED"}
            <div class="game-overlay paused-overlay">
              <span class="paused-text">EXECUTION_HALTED</span>
            </div>
          {/if}
          {#if gameState.mode === "INTERMISSION"}
            <div class="game-overlay intermission-wrapper"></div>
          {/if}
        {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet hud()}
    <div class="game-hud">
      <div class="hud-item">
        <span class="hud-label">SCORE:</span>
        <span class="hud-value">{tally.score.toLocaleString()}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">REPLICAS:</span>
        <span class="hud-value">×{gameState.lives}</span>
      </div>
    </div>
  {/snippet}
</ArcadeCabinet>

<style lang="scss">
  // --- Global Monochromatic Configuration Archetypes ---
  $void-black: #000000;
  $neon-cyan: #00f0ff;
  $trans-cyan: rgba(0, 240, 255, 0.1);

  // --- Game Loader ---
  .game-loader {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    background: $void-black;
  }

  .vector-spinner {
    width: 40px;
    height: 40px;
    border: 1px solid rgba($neon-cyan, 0.2);
    border-top: 1px solid $neon-cyan;
    animation: vectorSpin 1s steps(8) infinite;
  }

  @keyframes vectorSpin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    color: $neon-cyan;
    font-size: 1.2rem;
    letter-spacing: 4px;
    text-shadow: 0 0 6px rgba($neon-cyan, 0.5);
  }

  // --- Game Container ---
  .game-container {
    position: relative;

    canvas {
      position: absolute;
      top: 0;
      left: 0;
      image-rendering: pixelated;
    }
  }

  // --- Game Overlays ---
  .game-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10;
    pointer-events: none;
  }

  .ready-text {
    color: #ffffff;
    font-size: 2.5rem;
    letter-spacing: 4px;
    text-transform: uppercase;
    text-shadow: 0 0 10px $neon-cyan;
  }

  .paused-overlay {
    background: rgba($void-black, 0.85);
  }

  .paused-text {
    color: $neon-cyan;
    font-size: 2.2rem;
    letter-spacing: 6px;
    text-shadow: 0 0 12px $neon-cyan;
  }

  // --- Minimalist Screen Overlays ---
  .screen-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 100;
    font-family: "Jersey-Regular", monospace;
    background: rgba($void-black, 0.9);
  }

  // --- End Cycle Layouts ---
  .terminal-header {
    margin-bottom: 24px;
  }

  .game-over-title {
    font-size: 2rem;
    color: #ffffff;
    margin: 0;
    letter-spacing: 4px;
    text-shadow: 0 0 10px rgba($neon-cyan, 0.8);
  }

  .final-score-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-bottom: 32px;
    padding: 12px 32px;
    border: 1px solid rgba($neon-cyan, 0.3);
    background: rgba($neon-cyan, 0.02);
  }

  .score-label {
    color: rgba($neon-cyan, 0.5);
    font-size: 0.9rem;
    letter-spacing: 2px;
  }

  .score-number {
    color: #ffffff;
    font-size: 2.2rem;
    letter-spacing: 2px;
    text-shadow: 0 0 8px $neon-cyan;
  }

  .credit-text {
    color: rgba($neon-cyan, 0.4);
    font-size: 0.85rem;
    letter-spacing: 2px;
    margin-top: 20px;
  }

  .credit-text.blink {
    animation: vectorPulse 1.5s infinite steps(2);
  }

  @keyframes vectorPulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  // --- Attract Mode Layouts ---
  .attract-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
  }

  .attract-title {
    font-size: 2.2rem;
    color: #ffffff;
    letter-spacing: 4px;
    margin: 0;
    text-shadow: 0 0 10px $neon-cyan;
  }

  .character-row {
    display: flex;
    gap: 16px;
  }

  .vector-node {
    width: 10px;
    height: 10px;
    border: 1px solid $neon-cyan;
    background: transparent;
    box-shadow: 0 0 4px rgba($neon-cyan, 0.3);
  }

  // --- Monochromatic Wireframe Command Buttons ---
  .cabinet-button {
    background: transparent;
    border: 1px solid $neon-cyan;
    padding: 12px 32px;
    color: #ffffff;
    font-family: "Jersey-Regular", monospace;
    font-size: 1.3rem;
    letter-spacing: 3px;
    cursor: pointer;
    transition:
      background 0.15s ease,
      text-shadow 0.15s ease;
    box-shadow: 0 0 15px rgba($neon-cyan, 0.05);

    &:hover {
      background: rgba($neon-cyan, 0.15);
      text-shadow: 0 0 6px #ffffff;
    }

    &:active {
      background: rgba($neon-cyan, 0.3);
    }
  }

  .start-btn {
    font-size: 1.4rem;
    padding: 14px 40px;
    animation: buttonGlowSync 2s infinite ease-in-out;
  }

  @keyframes buttonGlowSync {
    0%,
    100% {
      box-shadow: 0 0 10px rgba($neon-cyan, 0.1);
    }
    50% {
      box-shadow: 0 0 20px rgba($neon-cyan, 0.3);
      border-color: #ffffff;
    }
  }

  // --- Minimalist Integrated HUD Layout ---
  .game-hud {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0 4px;
  }

  .hud-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .hud-label {
    color: rgba($neon-cyan, 0.5);
    font-size: 1.1rem;
    letter-spacing: 2px;
  }

  .hud-value {
    color: #ffffff;
    font-size: 1.2rem;
    letter-spacing: 1.5px;
    text-shadow: 0 0 6px rgba($neon-cyan, 0.4);
  }
</style>
