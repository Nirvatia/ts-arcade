<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    gameName: string;
    screenWidth: number;
    screenHeight: number;
    matrix: Snippet;
    hud?: Snippet;
  }

  let { gameName, screenWidth, screenHeight, matrix, hud }: Props = $props();
  let totalHeight = $derived(screenHeight + 48);
  const layers = [0, 1, 2];
</script>

<div class="void-expanse">
  <div class="starfield"></div>

  <div class="cabinet-scaler-box" style="width: {screenWidth}px; height: {totalHeight}px;">
    <div class="fracture-well">
      {#each layers as i}
        <div
          class="fracture-frame"
          style="
            --frame-w: {screenWidth + 40 + i * 36}px;
            --frame-h: {totalHeight + 40 + i * 36}px;
            --delay: {i * 1.5}s;
          "
        ></div>
      {/each}

      <div class="viewport" style="width: {screenWidth}px; height: {totalHeight}px;">
        <div class="game-layer">{@render matrix()}</div>
        {#if hud}
          <div class="hud-bar">{@render hud()}</div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  // 1. RESPONSIVE DESIGN SCSS MIXIN DEF
  @mixin respond-to($max-width) {
    @media (max-width: #{$max-width}) {
      @content;
    }
  }

  $void: #040410;
  $violet: #6655aa;
  $white-dim: #9999bb;

  // 2. SCALE PROPERTY CONFIGURATION DEGRADATION
  :root {
    --cabinet-scale: 1;
  }
  @include respond-to(1920px) { :root { --cabinet-scale: 0.85; } }
  @include respond-to(1440px) { :root { --cabinet-scale: 0.72; } }
  @include respond-to(1024px) { :root { --cabinet-scale: 0.55; } }
  @include respond-to(480px)  { :root { --cabinet-scale: 0.42; } }

  :global(body) {
    margin: 0;
    background: $void;
    overflow: hidden;
  }

  .void-expanse {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    width: 100vw;
    background: radial-gradient(ellipse at center, #0c0c24 0%, $void 55%);
    font-family: "Jersey-Regular", "Courier New", monospace;
    position: relative;
    overflow: hidden;
  }

  // 3. COLLAPSE EMPTY BOUNDING FOOTPRINT WHITESPACE
  .cabinet-scaler-box {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    
    // Updates layout allocation boundary framework sizes dynamically
    width: calc(100% * var(--cabinet-scale)) !important;
    height: calc(100% * var(--cabinet-scale)) !important;
  }

  // 4. UNIFIED GROUP TRANSFORM CONTROLLER
  .fracture-well {
    position: absolute;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    
    // Scales the cabinet canvas slot and surrounding ambient backgrounds flawlessly
    transform: scale(var(--cabinet-scale));
    transform-origin: center center;
  }

  .starfield {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(1px 1px at 8% 12%, rgba(150, 120, 220, 0.25), transparent),
      radial-gradient(1px 1px at 18% 50%, rgba(150, 120, 220, 0.15), transparent),
      radial-gradient(1.2px 1.2px at 30% 8%, rgba(180, 150, 240, 0.3), transparent),
      radial-gradient(1px 1px at 44% 60%, rgba(150, 120, 220, 0.18), transparent),
      radial-gradient(1.5px 1.5px at 55% 18%, rgba(200, 170, 255, 0.25), transparent),
      radial-gradient(1px 1px at 62% 72%, rgba(150, 120, 220, 0.15), transparent),
      radial-gradient(1px 1px at 72% 38%, rgba(150, 120, 220, 0.2), transparent),
      radial-gradient(1px 1px at 82% 10%, rgba(180, 150, 240, 0.25), transparent),
      radial-gradient(1px 1px at 90% 55%, rgba(150, 120, 220, 0.15), transparent),
      radial-gradient(1px 1px at 4% 78%, rgba(150, 120, 220, 0.18), transparent),
      radial-gradient(1px 1px at 25% 32%, rgba(180, 140, 240, 0.2), transparent),
      radial-gradient(1px 1px at 40% 80%, rgba(150, 120, 220, 0.15), transparent),
      radial-gradient(1px 1px at 52% 45%, rgba(200, 170, 255, 0.2), transparent),
      radial-gradient(1px 1px at 68% 6%, rgba(150, 120, 220, 0.2), transparent),
      radial-gradient(1px 1px at 85% 68%, rgba(150, 120, 220, 0.15), transparent);
    pointer-events: none;
    z-index: 0;
  }

  .fracture-frame {
    position: absolute;
    width: var(--frame-w);
    height: var(--frame-h);
    border: 1px solid rgba(100, 85, 160, 0.1);
    pointer-events: none;
    animation: slow-wave 8s ease-in-out infinite;
    animation-delay: var(--delay);
  }

  @keyframes slow-wave {
    0%, 100% {
      border-color: rgba(100, 85, 160, 0.06);
    }
    50% {
      border-color: rgba(130, 110, 190, 0.25);
    }
  }

  .viewport {
    position: relative;
    display: flex;
    flex-direction: column;
    z-index: 2;
    background: #000000;
    border: 1px solid rgba($violet, 0.15);

    :global(*) { box-sizing: border-box; }
  }

  .game-layer {
    position: relative;
    overflow: hidden;
    flex: 1;
  }

  .hud-bar {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px 14px;
    background: rgba(4, 4, 16, 0.85);
    border-top: 1px solid rgba($violet, 0.05);
    color: $white-dim;
  }
</style>