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

  // Add padding space inside the CRT for HUD
  let totalHeight = $derived(screenHeight + 52);
</script>

<div class="arcade-cabinet">
  <div class="machine-frame">
    <div class="marquee">
      <span class="marquee-text">{marqueeText}</span>
    </div>
    <div class="screen-bezel">
      <div class="crt-screen">
        <div class="scanlines"></div>
        <div class="screen-glare"></div>

        <div
          class="game-slot"
          style="width: {screenWidth}px; height: {totalHeight}px;"
        >
          <div class="game-area">
            {@render game()}
          </div>

          {#if hud}
            <div class="hud-area">
              {@render hud()}
            </div>
          {/if}
        </div>

        <div class="screen-vignette"></div>
      </div>
    </div>

    <div class="control-panel">
      <div class="panel-label">PLAYER 1</div>
      <div class="joystick-base">
        <div class="joystick-shaft">
          <div class="joystick-ball"></div>
        </div>
      </div>
      <div class="action-buttons">
        <div class="action-btn red"></div>
        <div class="action-btn blue"></div>
      </div>
    </div>

    <div class="cabinet-bottom">
      <div class="coin-slot">
        <div class="coin-slit"></div>
        <span class="coin-label">INSERT COIN</span>
      </div>
    </div>
  </div>
</div>

<style lang="scss">
  .arcade-cabinet {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    width: 100vw;
    background: radial-gradient(ellipse at center, #14141e 0%, #0a0a0a 70%);
    font-family: "Jersey-Regular", monospace;
    box-sizing: border-box;
  }

  .machine-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: linear-gradient(180deg, #1a1a1a 0%, #1e1e1e 30%, #151515 70%, #111 100%);
    border: 2px solid #2a2a2a;
    border-radius: 8px;
    box-shadow: 0 0 0 4px #151515, 0 0 0 6px #222, 0 10px 30px rgba(0,0,0,0.6);
    padding: 0;
  }

  .marquee {
    width: 100%;
    background: #111;
    border-bottom: 2px solid #cc9900;
    padding: 10px 0;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .marquee-text {
    font-size: 1.8rem;
    color: #ffd700;
    letter-spacing: 10px;
    text-shadow: 0 0 8px rgba(255,215,0,0.4), 0 1px 2px rgba(0,0,0,0.8);
    white-space: nowrap;
  }

  .screen-bezel {
    background: #1a1a1a;
    border: 5px solid #222;
    border-top-color: #2a2a2a;
    border-left-color: #252525;
    border-radius: 6px;
    padding: 16px;
    position: relative;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.6);
  }

  .crt-screen {
    position: relative;
    background: #0a0a0a;
    border: 2px solid #111;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: inset 0 0 30px rgba(0,0,0,0.7);
  }

  .scanlines {
    position: absolute;
    inset: 0;
    z-index: 12;
    pointer-events: none;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px);
  }

  .screen-glare {
    position: absolute;
    inset: 0;
    z-index: 13;
    pointer-events: none;
    background: radial-gradient(ellipse at 60% 30%, rgba(255,255,255,0.03) 0%, transparent 50%);
    border-radius: 12px;
  }

  .screen-vignette {
    position: absolute;
    inset: 0;
    z-index: 14;
    pointer-events: none;
    background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.35) 100%);
    border-radius: 12px;
  }

  .game-slot {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    z-index: 1;

    :global(*) { box-sizing: border-box; }
  }

  .game-area {
    position: relative;
    flex-shrink: 0;
    overflow: hidden;
  }

  .hud-area {
    width: 100%;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    box-sizing: border-box;
  }

  .control-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 48px;
    padding: 16px 32px;
    background: linear-gradient(180deg, #181818 0%, #111 100%);
    border-top: 2px solid #2a2a2a;
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }

  .panel-label {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: #181818;
    color: #cc9900;
    font-size: 0.75rem;
    letter-spacing: 3px;
    padding: 2px 10px;
    border: 1px solid #2a2a2a;
    border-radius: 2px;
  }

  .joystick-base {
    width: 52px; height: 52px;
    background: radial-gradient(circle, #1e1e1e 0%, #111 100%);
    border: 2px solid #2a2a2a;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: inset 0 1px 4px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4);
  }

  .joystick-shaft {
    width: 6px; height: 24px;
    background: linear-gradient(180deg, #3a3a3a 0%, #1e1e1e 100%);
    border-radius: 2px;
    position: relative;
  }

  .joystick-ball {
    width: 24px; height: 24px;
    background: radial-gradient(circle at 40% 35%, #dd1111 0%, #aa0000 50%, #550000 100%);
    border-radius: 50%;
    position: absolute;
    top: -14px; left: 50%;
    transform: translateX(-50%);
    box-shadow: 0 3px 6px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(0,0,0,0.3);
  }

  .action-buttons { display: flex; gap: 16px; }

  .action-btn {
    width: 34px; height: 34px;
    border: 2px solid #2a2a2a;
    border-radius: 50%;
    box-shadow: 0 3px 0 #000, 0 4px 6px rgba(0,0,0,0.4);

    &.red { background: radial-gradient(circle at 40% 35%, #ee3333 0%, #bb1111 50%, #550000 100%); }
    &.blue { background: radial-gradient(circle at 40% 35%, #3333ee 0%, #1111bb 50%, #000055 100%); }
  }

  .cabinet-bottom {
    padding: 12px 32px;
    background: #111;
    border-top: 1px solid #1e1e1e;
    display: flex;
    justify-content: center;
  }

  .coin-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .coin-slit {
    width: 32px; height: 4px;
    background: #000;
    border: 1px solid #333;
    border-radius: 2px;
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.6);
  }

  .coin-label {
    color: #555;
    font-size: 0.7rem;
    letter-spacing: 2px;
  }
</style>
