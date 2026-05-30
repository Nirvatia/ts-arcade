<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    gameName: string;
    screenWidth: number;
    screenHeight: number;
    game: Snippet;
    hud?: Snippet;
  }

  let { gameName, screenWidth, screenHeight, game, hud }: Props = $props();
  let marqueeText = $derived(gameName.toUpperCase() + " ARCADE");

  let totalHeight = $derived(screenHeight + 52);
</script>

<div class="tron-grid">
  <!-- Background grid layer -->
  <div class="grid-layer"></div>

  <!-- Floating cabinet -->
  <div class="cabinet">
    <div class="cabinet-glow"></div>

    <!-- Title -->
    <div class="title">{marqueeText}</div>

    <!-- Screen -->
    <div class="screen-frame">
      <div class="screen">
        <div class="scanlines"></div>

        <div class="game-slot" style="width: {screenWidth}px; height: {totalHeight}px;">
          <div class="game-area">{@render game()}</div>
          {#if hud}<div class="hud-area">{@render hud()}</div>{/if}
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="controls">
      <div class="control">
        <div class="ring small"></div>
        <span class="label">P1</span>
      </div>
      <div class="control">
        <div class="ring large"></div>
        <span class="label">MOVE</span>
      </div>
      <div class="control">
        <div class="ring small"></div>
        <div class="ring small"></div>
        <span class="label">FIRE</span>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .tron-grid {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    width: 100vw;
    background: #010812;
    font-family: "Jersey-Regular", monospace;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
  }

  .grid-layer {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(0, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 60px 60px;
    background-position: center center;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
    pointer-events: none;
  }

  .cabinet {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px 20px 16px 20px;
    background: rgba(1, 10, 20, 0.9);
    border: 1px solid rgba(0, 255, 255, 0.15);
  }

  .cabinet-glow {
    position: absolute;
    inset: -1px;
    border: 1px solid rgba(0, 255, 255, 0.06);
    box-shadow: 0 0 60px rgba(0, 255, 255, 0.04);
    pointer-events: none;
  }

  .title {
    font-size: 1.2rem;
    color: rgba(0, 255, 255, 0.5);
    letter-spacing: 6px;
    text-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
  }

  .screen-frame {
    padding: 6px;
    border: 1px solid rgba(0, 255, 255, 0.2);
  }

  .screen {
    position: relative;
    background: #010812;
    border: 1px solid rgba(0, 255, 255, 0.1);
    overflow: hidden;
    box-shadow: inset 0 0 40px rgba(0, 0, 0, 0.5);
  }

  .scanlines {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
  }

  .game-slot {
    position: relative;
    display: flex;
    flex-direction: column;
    z-index: 1;
    :global(*){ box-sizing: border-box; }
  }

  .game-area { position: relative; overflow: hidden; }
  .hud-area { width: 100%; flex: 1; display: flex; align-items: center; justify-content: center; padding: 4px 8px; }

  .controls {
    display: flex;
    align-items: flex-end;
    gap: 24px;
  }

  .control {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .ring {
    border: 1px solid rgba(0, 255, 255, 0.2);
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(0, 255, 255, 0.06);
    &.small { width: 20px; height: 20px; }
    &.large { width: 36px; height: 36px; }
  }

  .label {
    font-size: 0.4rem;
    color: rgba(0, 255, 255, 0.3);
    letter-spacing: 3px;
  }
</style>