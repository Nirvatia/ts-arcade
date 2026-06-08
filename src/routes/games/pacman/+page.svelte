<script lang="ts">
  import { onMount, tick } from "svelte";
  import fontUrl from "$lib/assets/fonts/Jersey-Regular.ttf?url";
  import ArcadeCabinet from "$lib/layout/ArcadeCabinet.svelte";

  import { CFG_CANVAS } from "../../../pacman/config/canvas.config.js";
  import { eventBus } from "../../../pacman/core/EventBus.js";
  import { GameMain } from "../../../pacman/game/GameMain.js";
  import { debugMaze } from "../../../pacman/debug/debugMaze.js";
  import { CFG_GRID_0 } from "../../../pacman/config/grid.config.js";

  let isLoading = $state(true);
  let audioUnlocked = $state(false);
  const game = new GameMain();

  let canvasWidth = $derived.by(() => {
    const grid = game.gameState.levelData?.map as string[][];
    return grid && grid[0]?.length
      ? grid[0].length * CFG_CANVAS.tile.size
      : 448;
  });

  let canvasHeight = $derived.by(() => {
    const grid = game.gameState.levelData?.map as string[][];
    return grid?.length ? grid.length * CFG_CANVAS.tile.size : 496;
  });

  let countdown = $derived.by(() => {
    const activeClock = game.director.currentClock;
    return activeClock && activeClock.isRunning
      ? activeClock.getRemaining()
      : 0;
  });

  let gameOverTimer = $state(0);
  let showRestartPrompt = $state(false);

  onMount(() => {
    const initGame = async () => {
      // Load font and preload audio in parallel
      const gameFont = new FontFace("Jersey-Regular", `url(${fontUrl})`);
      document.fonts.add(gameFont);

      await Promise.all([
        gameFont.load().catch(() => {}),
        game.sfx.preloadAll(),
      ]);

      isLoading = false;
      await tick();
      game.controller.init();
      await game.loadAsync();
    };
    initGame();
    return () => {
      game.destroy();
    };
  });

  $effect(() => {
    if (game.gameState.mode === "GAME_OVER") {
      gameOverTimer = 0;
      showRestartPrompt = false;
      const interval = setInterval(() => {
        gameOverTimer += 0.1;
        if (gameOverTimer >= 1.5) showRestartPrompt = true;
        if (gameOverTimer >= 2) clearInterval(interval);
      }, 100);
      return () => clearInterval(interval);
    }
  });

  async function handleStart() {
    await game.sfx.unlockAudio();
    audioUnlocked = true;
    eventBus.emit("game:start");
  }

  async function handleRestart() {
    if (!showRestartPrompt) return;
    if (!audioUnlocked) {
      await game.sfx.unlockAudio();
      audioUnlocked = true;
    }
    await game.director.restartGame();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      if (game.gameState.mode === "INIT") handleStart();
      else if (game.gameState.mode === "GAME_OVER" && showRestartPrompt)
        handleRestart();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<ArcadeCabinet
  gameName="Pac-Man"
  screenWidth={canvasWidth}
  screenHeight={canvasHeight}
>
  {#snippet matrix()}
    <div
      class="game-wrapper"
      style="width: {canvasWidth}px; height: {canvasHeight}px;"
    >
      {#if isLoading}
        <div class="state-overlay"><span class="faint-text">LOADING</span></div>
      {:else}
        <canvas id={CFG_CANVAS.canvasIds.grid}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.dots}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.pills}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.pacman}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.vignette}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.scene}></canvas>
        <canvas id={CFG_CANVAS.canvasIds.ghosts}></canvas>

        {#if game.gameState.mode === "INIT"}
          <div class="state-overlay fogged">
            <div class="transmission-ripples">
              <span class="ripple r1"></span>
              <span class="ripple r2"></span>
              <span class="ripple r3"></span>
            </div>
            <h1 class="title">PAC-MAN</h1>
            <span class="hint">AWAITING OBSERVER</span>
            <button class="btn" onclick={handleStart}>ENGAGE</button>
          </div>
        {/if}

        {#if game.gameState.mode === "GAME_OVER"}
          <div class="state-overlay fractured">
            <div class="fracture-cracks">
              <span class="crack c1"></span>
              <span class="crack c2"></span>
              <span class="crack c3"></span>
              <span class="crack c4"></span>
              <span class="crack c5"></span>
            </div>
            <h1 class="title">SIGNAL LOST</h1>
            <span class="score-display"
              >{game.tally.score.toLocaleString()}</span
            >
            {#if showRestartPrompt}
              <span class="hint pulse">TRANSMIT AGAIN?</span>
              <button class="btn" onclick={handleRestart}>REESTABLISH</button>
            {/if}
          </div>
        {/if}

        {#if game.gameState.mode === "LEVEL_TRANSITION"}
          <div class="state-overlay">
            <div class="sonar-rings">
              <span class="sonar s1"></span>
              <span class="sonar s2"></span>
              <span class="sonar s3"></span>
            </div>
            <span class="big-number"
              >{countdown > 1 ? Math.ceil(countdown) : "GO"}</span
            >
          </div>
        {/if}

        {#if game.gameState.mode === "PAUSED"}
          <div class="state-overlay dimmed">
            <span class="stasis-text">PAUSED</span>
          </div>
        {/if}
      {/if}
    </div>
  {/snippet}

  {#snippet hud()}
    <div class="hud">
      <p class="hud-score">SCORE: {game.tally.score.toLocaleString()}</p>
      <p class="hud-lives">LIVES &times;{game.gameState.lives}</p>
    </div>
  {/snippet}
</ArcadeCabinet>

<style lang="scss">
  $void: #040410;
  $violet: #8877cc;
  $violet-dim: rgba(150, 120, 200, 0.55);
  $violet-faint: rgba(130, 100, 180, 0.22);
  $white: #eeeedd;

  .game-wrapper {
    position: relative;
    background: #000;

    canvas {
      position: absolute;
      top: 0;
      left: 0;
      image-rendering: pixelated;
    }
  }

  .state-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba($void, 0.88);

    &.fogged {
      background: rgba($void, 0.75);
    }
    &.dimmed {
      background: rgba($void, 0.7);
    }
  }

  .title {
    margin: 0;
    font-size: 2.8rem;
    color: $white;
    letter-spacing: 8px;
    text-shadow:
      0 0 30px $violet-dim,
      0 0 60px rgba($violet, 0.25);
    z-index: 1;
  }

  .hint {
    color: $violet-dim;
    font-size: 1.1rem;
    letter-spacing: 5px;
    text-transform: uppercase;
    z-index: 1;

    &.pulse {
      animation: pulse 2s ease-in-out infinite;
    }
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.85;
    }
  }

  .score-display {
    color: $white;
    font-size: 2.4rem;
    letter-spacing: 4px;
    text-shadow: 0 0 18px $violet-dim;
    z-index: 1;
  }

  .big-number {
    color: $white;
    font-size: 3.5rem;
    letter-spacing: 8px;
    text-shadow: 0 0 28px $violet-dim;
    z-index: 1;
  }

  .faint-text {
    color: $violet-dim;
    font-size: 1.1rem;
    letter-spacing: 6px;
  }

  .stasis-text {
    color: $white;
    font-size: 2.6rem;
    letter-spacing: 8px;
    text-shadow: 0 0 18px $violet-dim;
    animation: flicker 0.2s ease-in-out infinite alternate;
  }

  @keyframes flicker {
    0% {
      opacity: 0.8;
    }
    100% {
      opacity: 1;
    }
  }

  .btn {
    background: transparent;
    border: 1px solid $violet-dim;
    padding: 10px 30px;
    color: $white;
    font-family: "Jersey-Regular", monospace;
    font-size: 1.55rem;
    letter-spacing: 4px;
    cursor: pointer;
    z-index: 1;
    transition:
      background 0.2s,
      border-color 0.2s;

    &:hover {
      background: $violet-faint;
      border-color: $violet;
    }

    &:focus-visible {
      outline: 1px solid $violet;
      outline-offset: 2px;
    }
  }

  .transmission-ripples {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .ripple {
    position: absolute;
    border-radius: 50%;
    border: 1px solid $violet-faint;
    animation: ripple-out 3s ease-out infinite;

    &.r1 {
      width: 100px;
      height: 100px;
      animation-delay: 0s;
    }
    &.r2 {
      width: 100px;
      height: 100px;
      animation-delay: 1s;
    }
    &.r3 {
      width: 100px;
      height: 100px;
      animation-delay: 2s;
    }
  }

  @keyframes ripple-out {
    0% {
      transform: scale(1);
      opacity: 0.45;
    }
    100% {
      transform: scale(5);
      opacity: 0;
    }
  }

  .fracture-cracks {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .crack {
    position: absolute;
    height: 1px;
    background: linear-gradient(90deg, transparent, $violet-dim, transparent);

    &.c1 {
      top: 38%;
      left: 18%;
      width: 64%;
      transform: rotate(-12deg);
    }
    &.c2 {
      top: 52%;
      left: 22%;
      width: 56%;
      transform: rotate(6deg);
    }
    &.c3 {
      top: 44%;
      left: 28%;
      width: 44%;
      transform: rotate(-28deg);
    }
    &.c4 {
      top: 56%;
      left: 32%;
      width: 38%;
      transform: rotate(18deg);
    }
    &.c5 {
      top: 49%;
      left: 25%;
      width: 50%;
      transform: rotate(-3deg);
    }
  }

  .sonar-rings {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .sonar {
    position: absolute;
    border-radius: 50%;
    border: 1px solid $violet-faint;
    animation: sonar-out 1.8s ease-out infinite;

    &.s1 {
      width: 50px;
      height: 50px;
      animation-delay: 0s;
    }
    &.s2 {
      width: 50px;
      height: 50px;
      animation-delay: 0.6s;
    }
    &.s3 {
      width: 50px;
      height: 50px;
      animation-delay: 1.2s;
    }
  }

  @keyframes sonar-out {
    0% {
      transform: scale(1);
      opacity: 0.5;
    }
    100% {
      transform: scale(6);
      opacity: 0;
    }
  }

  .hud {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 6px;
    font-size: 1.35rem;
    letter-spacing: 2px;
  }

  .hud-score {
    color: rgba($white, 0.8);
  }
  .hud-lives {
    color: rgba($white, 0.8);
  }
</style>
