<script lang="ts">
  import { onMount, tick } from "svelte";
  import { initAudio } from "../../../pacman/utils.js";
  import fontUrl from "$lib/assets/fonts/Jersey-Regular.ttf?url";
  import { Director } from "../../../pacman/game/director.js";
  import { GameState } from "../../../pacman/game/gameState.js";
  import { sfx } from "../../../pacman/sfx/sfx.js";
  import { Controller } from "../../../pacman/controller/controller.js";
  import { Intermission } from "../../../pacman/scenes/intermission.js";
  import { Tally } from "../../../pacman/game/tally.js";
  import { eventBus } from "../../../pacman/core/eventBus.js";
  import ArcadeCabinet from "$lib/layout/ArcadeCabinet.svelte";
  import { CFG_CANVAS } from "../../../pacman/config/canvas.js";
  import { Environment } from "../../../pacman/world/environment.js";
  import { CanvasLayer } from "../../../pacman/core/canvasLayer.js";

  let isLoading = $state(true);
  let score = $state(0);
  let lives = $state(3);
  let gameMode = $state("INIT");
  let countdown = $state(0);

  let canvasWidth = $state(448);
  let canvasHeight = $state(496);

  let intermissionCanvas: HTMLCanvasElement | null = $state(null);
  let intermissionInstance: Intermission | null = null;

  let gameState: GameState;
  let director: Director;
  let environment: Environment;
  let tally: Tally;

  let uiUpdateInterval: number | null = null;

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

    gameState = GameState.getInstance();
    director = Director.getInstance();
    environment = Environment.getInstance();
    tally = Tally.getInstance();

    // FIXED: Use new event name
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

    // FIXED: Listen to new events to update UI reactively instead of polling
    eventBus.on("score:updated", (data) => {
      score = data.score;
    });

    eventBus.on("lives:changed", (data) => {
      lives = data.lives;
    });

    eventBus.on("bonus_life:acquired", (data) => {
      lives = data.lives;
    });

    eventBus.on("game:over", (data) => {
      score = data.finalScore;
      gameMode = "GAME_OVER";
      countdown = 0;
    });

    eventBus.on("game:started", () => {
      gameMode = "PLAYING";
    });

    eventBus.on("game:resumed", () => {
      gameMode = "PLAYING";
    });

    eventBus.on("pacman:death_triggered", () => {
      gameMode = "PACMAN_DEAD";
    });

    eventBus.on("level:transition_start", () => {
      gameMode = "LEVEL_TRANSITION";
    });

    eventBus.on("level:transition_end", () => {
      gameMode = "PLAYING";
    });

    eventBus.on("level:complete", () => {
      gameMode = "LEVEL_COMPLETE";
    });

    eventBus.on("level:intermission_start", () => {
      gameMode = "INTERMISSION";
    });

    // Keep polling for countdown (since it's time-sensitive UI)
    // But we can also update other stats reactively now
    uiUpdateInterval = window.setInterval(() => {
      // Update score/lives from Tally as fallback (in case we missed an event)
      if (tally) {
        score = tally.score;
        lives = gameState.lives;
      }

      // Update game mode from GameState as source of truth
      if (gameState) {
        gameMode = gameState.mode;
      }

      if (gameMode === "GAME_OVER") {
        countdown = 0;
        return;
      }

      if (director) {
        const activeClock = director.currentClock;
        countdown =
          activeClock && activeClock.isRunning ? activeClock.getRemaining() : 0;
      }
    }, 1000 / 30);
  });

  $effect(() => {
    return () => {
      if (uiUpdateInterval !== null) clearInterval(uiUpdateInterval);
    };
  });

  $effect(() => {
    if (gameMode === "INTERMISSION" && intermissionCanvas) {
      const ctx = intermissionCanvas.getContext("2d");
      if (!ctx) return;

      intermissionInstance = new Intermission();
      intermissionInstance.start(5, () => {});

      let animationId: number;
      const animate = () => {
        if (gameState.mode !== "INTERMISSION") return;
        intermissionInstance?.update(16);
        intermissionInstance?.draw();
        animationId = requestAnimationFrame(animate);
      };
      animationId = requestAnimationFrame(animate);

      return () => cancelAnimationFrame(animationId);
    }
  });

  // FIXED: Use new event names
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
        <div class="spinner-ring"><div class="spinner-dot"></div></div>
        <p class="loading-text">INSERT COIN</p>
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
        <canvas id={CFG_CANVAS.canvasIds.scene}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.ghosts}></canvas>

        {#if gameMode === "INIT" || gameMode === "GAME_OVER"}
          <div
            class="screen-overlay {gameMode === 'INIT'
              ? 'attract-mode'
              : 'death-mode'}"
          >
            {#if gameMode === "GAME_OVER"}
              <div class="death-header">
                <span class="skull">☠</span>
                <h1 class="game-over-title">GAME OVER</h1>
                <span class="skull">☠</span>
              </div>
              <div class="final-score-box">
                <span class="score-label">FINAL SCORE</span>
                <span class="score-number">{score.toLocaleString()}</span>
              </div>
              <button class="cabinet-button" onclick={handleRestart}
                >▶ CONTINUE</button
              >
              <div class="credit-text">INSERT COIN TO CONTINUE</div>
            {:else}
              <div class="attract-content">
                <div class="title-arc">
                  <span class="char">P</span><span class="char">A</span><span
                    class="char">C</span
                  >
                  <span class="char">-</span><span class="char">M</span><span
                    class="char">A</span
                  ><span class="char">N</span>
                </div>
                <div class="character-row">
                  <div class="ghost-dot red"></div>
                  <div class="ghost-dot pink"></div>
                  <div class="ghost-dot cyan"></div>
                  <div class="ghost-dot orange"></div>
                </div>
                <button class="cabinet-button start-btn" onclick={handleStart}
                  >● START GAME</button
                >
                <div class="credit-text blink">CREDIT 1</div>
              </div>
            {/if}
          </div>
        {:else}
          {#if gameMode === "LEVEL_TRANSITION"}
            <div class="game-overlay ready-text">
              {countdown > 1 ? countdown : "READY!"}
            </div>
          {/if}
          {#if gameMode === "PAUSED"}
            <div class="game-overlay paused-overlay">
              <span class="paused-text">PAUSED</span>
            </div>
          {/if}
          {#if gameMode === "INTERMISSION"}
            <div class="game-overlay intermission-wrapper">
              <canvas
                bind:this={intermissionCanvas}
                width={canvasWidth}
                height={canvasHeight}
              ></canvas>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet hud()}
    <div class="game-hud">
      <div class="hud-item">
        <span class="hud-label">SCORE</span>
        <span class="hud-value">{score.toLocaleString()}</span>
      </div>
      <div class="hud-item">
        <span class="hud-label">LIVES</span>
        <div class="lives-display">
          <span class="hud-value">×{lives}</span>
        </div>
      </div>
    </div>
  {/snippet}
</ArcadeCabinet>

<style lang="scss">
  // --- Game Loader ---
  .game-loader {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    background: #0a0a0a;
  }

  .spinner-ring {
    width: 60px;
    height: 60px;
    border: 3px solid #222;
    border-top: 3px solid #ffff00;
    border-right: 3px solid #ffd700;
    border-radius: 50%;
    animation: coinSpin 1.5s linear infinite;
    position: relative;
    box-shadow: 0 0 15px rgba(255, 255, 0, 0.2);
  }

  .spinner-dot {
    width: 10px;
    height: 10px;
    background: #ffff00;
    border-radius: 50%;
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    box-shadow: 0 0 8px rgba(255, 255, 0, 0.6);
  }

  @keyframes coinSpin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .loading-text {
    color: #ffd700;
    font-size: 1.4rem;
    letter-spacing: 6px;
    animation: blinkText 1s infinite;
  }

  // --- Game Container ---
  .game-container {
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

  // --- Game Overlays ---
  .game-overlay {
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
    font-size: 3.5rem;
    text-shadow:
      0 0 15px rgba(255, 255, 0, 0.6),
      3px 3px 0 #000;
    animation: readyPulse 0.5s ease-in-out;
  }

  @keyframes readyPulse {
    0% {
      transform: scale(1.4);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .paused-overlay {
    background: rgba(0, 0, 0, 0.7);
  }

  .paused-text {
    color: #ff4444;
    font-size: 4rem;
    text-shadow:
      0 0 20px rgba(255, 68, 68, 0.6),
      3px 3px 0 #000;
    letter-spacing: 6px;
  }

  .intermission-wrapper {
    pointer-events: auto;

    canvas {
      position: relative;
    }
  }

  // --- Screen Overlays (Init / Game Over) ---
  .screen-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 100;
    font-family: "Jersey-Regular", sans-serif;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(2px);
  }

  .attract-mode {
    background: rgba(0, 0, 0, 0.85);
  }

  // --- Death Screen ---
  .death-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
  }

  .skull {
    font-size: 3rem;
    filter: grayscale(1);
  }

  .game-over-title {
    font-size: 3.5rem;
    color: #ff2222;
    margin: 0;
    text-shadow:
      0 0 20px rgba(255, 34, 34, 0.7),
      0 0 40px rgba(255, 34, 34, 0.3),
      3px 3px 0 #000;
    letter-spacing: 6px;
    animation: glitchText 3s infinite;
  }

  @keyframes glitchText {
    0%,
    90%,
    100% {
      transform: translate(0);
    }
    92% {
      transform: translate(-2px, 1px);
    }
    94% {
      transform: translate(2px, -1px);
    }
    96% {
      transform: translate(-1px, -1px);
    }
    98% {
      transform: translate(1px, 1px);
    }
  }

  .final-score-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-bottom: 24px;
    padding: 16px 40px;
    border: 2px solid #ffd700;
    border-radius: 4px;
    background: rgba(255, 215, 0, 0.05);
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.1);
  }

  .score-label {
    color: #ffd700;
    font-size: 1.2rem;
    letter-spacing: 4px;
    opacity: 0.8;
  }

  .score-number {
    color: #fff;
    font-size: 2.5rem;
    letter-spacing: 2px;
    text-shadow: 0 0 15px rgba(255, 255, 255, 0.4);
  }

  .credit-text {
    color: #ffd700;
    font-size: 1.1rem;
    letter-spacing: 3px;
    margin-top: 16px;
    opacity: 0.7;
  }

  .credit-text.blink {
    animation: blinkText 1s infinite;
  }

  @keyframes blinkText {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.2;
    }
  }

  // --- Attract Mode ---
  .attract-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .title-arc {
    display: flex;
    gap: 6px;
    font-size: 4rem;
    letter-spacing: 4px;

    .char {
      color: #ffff00;
      text-shadow:
        0 0 15px rgba(255, 255, 0, 0.6),
        3px 3px 0 #000;
      animation: charBounce 2s infinite;
    }

    .char:nth-child(1) {
      animation-delay: 0s;
    }
    .char:nth-child(2) {
      animation-delay: 0.1s;
    }
    .char:nth-child(3) {
      animation-delay: 0.2s;
    }
    .char:nth-child(4) {
      animation-delay: 0.3s;
    }
    .char:nth-child(5) {
      animation-delay: 0.4s;
    }
    .char:nth-child(6) {
      animation-delay: 0.5s;
    }
    .char:nth-child(7) {
      animation-delay: 0.6s;
    }
  }

  @keyframes charBounce {
    0%,
    100% {
      transform: translateY(0);
    }
    30% {
      transform: translateY(-8px);
    }
    50% {
      transform: translateY(0);
    }
  }

  .character-row {
    display: flex;
    gap: 10px;
  }

  .ghost-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    animation: dotPulse 2s ease-in-out infinite;

    &.red {
      background: #ff0000;
      box-shadow: 0 0 8px #ff0000;
      animation-delay: 0s;
    }
    &.pink {
      background: #ffb8de;
      box-shadow: 0 0 8px #ffb8de;
      animation-delay: 0.3s;
    }
    &.cyan {
      background: #00ffff;
      box-shadow: 0 0 8px #00ffff;
      animation-delay: 0.6s;
    }
    &.orange {
      background: #ffb852;
      box-shadow: 0 0 8px #ffb852;
      animation-delay: 0.9s;
    }
  }

  @keyframes dotPulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.3);
      opacity: 1;
    }
  }

  // --- Buttons ---
  .cabinet-button {
    margin-top: 8px;
    padding: 14px 40px;
    background: linear-gradient(180deg, #333 0%, #1a1a1a 100%);
    border: 3px solid #ffd700;
    border-radius: 30px;
    color: #ffd700;
    font-family: "Jersey-Regular", sans-serif;
    font-size: 1.6rem;
    letter-spacing: 4px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.15s ease;
    box-shadow:
      0 4px 0 #000,
      0 6px 12px rgba(0, 0, 0, 0.5);

    &:hover {
      background: linear-gradient(180deg, #ffd700 0%, #cc9900 100%);
      color: #000;
      border-color: #fff;
      box-shadow:
        0 2px 0 #000,
        0 0 20px rgba(255, 215, 0, 0.4);
      transform: translateY(2px);
    }

    &:active {
      transform: translateY(4px);
      box-shadow:
        0 0 0 #000,
        0 2px 4px rgba(0, 0, 0, 0.5);
    }
  }

  .start-btn {
    padding: 16px 50px;
    font-size: 1.8rem;
    border-color: #ffff00;
    color: #ffff00;
    box-shadow:
      0 4px 0 #000,
      0 0 20px rgba(255, 255, 0, 0.15);
    animation: flashBtn 0.8s infinite;
  }

  @keyframes flashBtn {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  // --- HUD ---
  .game-hud {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .hud-item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hud-label {
    color: #ffd700;
    font-size: 1.5rem;
    letter-spacing: 3px;
  }

  .hud-value {
    color: #fff;
    font-size: 1.5rem;
    letter-spacing: 2px;
    text-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
  }

  .lives-display {
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>
