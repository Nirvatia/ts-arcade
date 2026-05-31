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
  let marqueeText = $derived(gameName.toUpperCase());

  let totalHeight = $derived(screenHeight + 52);
</script>

<div class="vector-terminal">
  <div class="static-grid-overlay"></div>

  <div class="chassis-container">
    
    <div class="system-marquee">
      <div class="status-tag">SYS // LINK_01</div>
      <h1 class="marquee-text">{marqueeText}</h1>
    </div>

    <div class="crt-frame">
      <div class="raster-scanlines"></div>
      <div class="phosphor-glare"></div>

      <div class="game-viewport" style="width: {screenWidth}px; height: {totalHeight}px;">
        <div class="game-content">{@render game()}</div>
        {#if hud}
          <div class="hud-content">{@render hud()}</div>
        {/if}
      </div>
    </div>

    <div class="interface-panel">
      <div class="control-lane">
        <div class="vector-node-dot"></div>
        <span class="panel-tag">P1</span>
      </div>

      <div class="control-lane">
        <div class="cross-axis"></div>
        <span class="panel-tag">MOVE</span>
      </div>

      <div class="control-lane">
        <div class="action-gate-group">
          <div class="gate-switch"></div>
          <div class="gate-switch"></div>
        </div>
        <span class="panel-tag">ACTION</span>
      </div>
    </div>

  </div>
</div>

<style lang="scss">
  // --- Pure Monochromatic Cyan System Archetype ---
  $void-black: #000205;
  $matrix-dark: #01070e;
  $neon-cyan: #00f0ff;

  :global(body) {
    margin: 0;
    background: $void-black;
    overflow: hidden;
  }

  .vector-terminal {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    width: 100vw;
    background: radial-gradient(circle at center, #020914 0%, $void-black 100%);
    font-family: "Jersey-Regular", "Courier New", monospace;
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
  }

  // --- Background Grid Matrix ---
  .static-grid-overlay {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba($neon-cyan, 0.015) 1px, transparent 1px),
      linear-gradient(90deg, rgba($neon-cyan, 0.015) 1px, transparent 1px);
    background-size: 50px 50px;
    background-position: center center;
    mask-image: radial-gradient(circle at center, black 10%, transparent 80%);
    pointer-events: none;
    z-index: 0;
  }

  // --- Single Unified Outer Frame ---
  .chassis-container {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    background: $matrix-dark;
    border: 1px solid rgba($neon-cyan, 0.3);
    padding: 20px;
    box-sizing: border-box;
    box-shadow: 0 0 30px rgba($neon-cyan, 0.05);
  }

  // --- Frameless Header Marquee ---
  .system-marquee {
    display: flex;
    flex-direction: column;
    margin-bottom: 20px;
    padding-left: 4px;

    .status-tag {
      font-size: 0.55rem;
      color: rgba($neon-cyan, 0.4);
      letting-spacing: 2px;
      letter-spacing: 2px;
    }

    .marquee-text {
      font-size: 1.6rem;
      color: #ffffff;
      margin: 0;
      letter-spacing: 6px;
      text-transform: uppercase;
      font-weight: bold;
      text-shadow: 0 0 8px rgba($neon-cyan, 0.5);
    }
  }

  // --- Screen Viewport Frame ---
  .crt-frame {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba($neon-cyan, 0.15); // The only screen barrier remaining
    margin-bottom: 20px;
  }

  // --- Flat Scanlines Filter ---
  .raster-scanlines {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.25) 0px,
      rgba(0, 0, 0, 0.25) 1px,
      transparent 2px,
      transparent 2px
    );
  }

  .phosphor-glare {
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    background: radial-gradient(circle at center, rgba($neon-cyan, 0.02) 0%, transparent 85%);
  }

  .game-viewport {
    position: relative;
    display: flex;
    flex-direction: column;
    z-index: 1;
    background: #000000;
    
    :global(*) { box-sizing: border-box; }
  }

  .game-content {
    position: relative;
    overflow: hidden;
  }

  .hud-content {
    width: 100%;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    background: #000104;
    border-top: 1px solid rgba($neon-cyan, 0.1);
    color: rgba($neon-cyan, 0.8);
  }

  // --- Minimalist Control Strip ---
  .interface-panel {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;
    box-sizing: border-box;
  }

  .control-lane {
    display: flex;
    align-items: center;
    gap: 8px;

    .panel-tag {
      font-size: 0.5rem;
      color: rgba($neon-cyan, 0.4);
      letter-spacing: 1.5px;
      font-weight: bold;
    }
  }

  // Clean 2D Wire Indicators
  .vector-node-dot {
    width: 8px;
    height: 8px;
    background: $neon-cyan;
    box-shadow: 0 0 6px $neon-cyan;
  }

  .cross-axis {
    width: 12px;
    height: 12px;
    position: relative;

    &::before, &::after {
      content: '';
      position: absolute;
      background: rgba($neon-cyan, 0.6);
    }
    &::before {
      top: 5px;
      left: 0;
      width: 12px;
      height: 2px;
    }
    &::after {
      left: 5px;
      top: 0;
      width: 2px;
      height: 12px;
    }
  }

  .action-gate-group {
    display: flex;
    gap: 4px;

    .gate-switch {
      width: 8px;
      height: 8px;
      border: 1px solid rgba($neon-cyan, 0.6);
    }
  }
</style>