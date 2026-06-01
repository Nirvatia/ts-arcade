<script lang="ts">
  const routes = [
    { id: "01", path: "/games/pacman", name: "Pac-Man", available: true },
    { id: "02", path: "#", name: "Snake", available: false },
    { id: "03", path: "#", name: "Tetris", available: false },
  ];
</script>

<main class="neon-axis">
  <!-- 1. Centralized Hero Branding Header -->
  <header class="axis-header">
    <span class="system-tag">// CH_DIRECT_ACCESS_SYSTEM</span>
    <h1 class="main-title">JS_ARCADE</h1>
    <div class="horizon-beam"></div>
  </header>

  <!-- 2. Dead-Center Zero-Jank Scrollable Menu -->
  <section class="axis-viewport">
    <div class="axis-list">
      {#each routes as route}
        <div 
          class="axis-row" 
          class:axis-row--active={route.available}
          class:axis-row--locked={!route.available}
        >
          {#if route.available}
            <a class="axis-link" href={route.path}>
              <!-- Symmetrical center-out laser explosion backdrop -->
              <div class="laser-burst"></div>
              
              <div class="link-wrap">
                <span class="item-id">{route.id}</span>
                <h2 class="item-name">{route.name}</h2>
                <span class="item-status">READY</span>
              </div>
            </a>
          {:else}
            <div class="axis-link">
              <div class="laser-burst"></div>
              
              <div class="link-wrap">
                <span class="item-id">{route.id}</span>
                <h2 class="item-name">{route.name}</h2>
                <span class="item-status">LOCKED</span>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>
</main>

<style lang="scss">
  $font-arcade: "Jersey-Regular", monospace;
  
  $cyan: #00f3ff;
  $orange: #ff5500;
  $void: #000000;

  .neon-axis {
    font-family: $font-arcade;
    text-transform: uppercase;
    background: $void;
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;

    /* --- HERO TOP BRANDING --- */
    .axis-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4rem 2rem 2rem 2rem;
      background: linear-gradient(to bottom, #010612 0%, $void 100%);
      z-index: 10;

      .system-tag {
        font-size: 1rem;
        letter-spacing: 3px;
        color: rgba(0, 243, 255, 0.4);
        margin-bottom: 0.5rem;
      }

      .main-title {
        font-size: 4.5rem;
        font-weight: 900;
        margin: 0;
        color: #ffffff;
        letter-spacing: 8px;
        text-shadow: 0 0 20px rgba(0, 243, 255, 0.6);
      }

      /* Clean structural visual accent splitting the view */
      .horizon-beam {
        width: 100%;
        max-width: 700px;
        height: 2px;
        background: linear-gradient(90deg, transparent, $cyan, transparent);
        box-shadow: 0 0 10px $cyan;
        margin-top: 1.5rem;
      }
    }

    /* --- VERTICALLY ALIGNED VIEWPORT --- */
    .axis-viewport {
      flex-grow: 1;
      overflow-y: auto;
      padding: 0 2rem 4rem 2rem;
      display: flex;
      justify-content: center;

      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-track { background: transparent; }
      &::-webkit-scrollbar-thumb { background: rgba(0, 243, 255, 0.1); }
    }

    .axis-list {
      display: flex;
      flex-direction: column;
      gap: 4px; // Dense mechanical stacking
      width: 100%;
      max-width: 700px;
    }

    .axis-row {
      position: relative;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.01);

      .axis-link {
        display: block;
        text-decoration: none;
        width: 100%;
        box-sizing: border-box;
        position: relative;
        z-index: 5;
      }

      /* Symmetrical, clean inner row flexbox alignment */
      .link-wrap {
        display: grid;
        grid-template-columns: 60px 1fr 100px;
        align-items: center;
        padding: 1.2rem 2rem;
      }

      .item-id {
        font-size: 1.1rem;
        font-weight: bold;
        transition: color 0.15s ease;
      }

      .item-name {
        font-size: 2.5rem;
        font-weight: 900;
        margin: 0;
        letter-spacing: 2px;
        text-align: left;
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.15s ease;
      }

      .item-status {
        font-size: 1.1rem;
        font-weight: bold;
        letter-spacing: 1px;
        text-align: right;
        transition: color 0.15s ease;
      }

      /* Hardware-accelerated symmetrical scaling background layer */
      .laser-burst {
        position: absolute;
        inset: 0;
        transform: scaleX(0);
        transform-origin: center; /* Animates smoothly inside-out! */
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: -1;
      }

      /* --- ACTIVE CYAN SPECIFICATION --- */
      &--active {
        .item-id { color: rgba(0, 243, 255, 0.3); }
        .item-name { color: #ffffff; }
        .item-status { color: rgba(0, 243, 255, 0.5); }
        .laser-burst { background: radial-gradient(circle, rgba(0, 243, 255, 0.18) 0%, transparent 85%); }

        &:hover {
          .laser-burst { transform: scaleX(1); }
          
          .item-name {
            color: $cyan;
            text-shadow: 0 0 15px $cyan, 0 0 30px rgba(0, 243, 255, 0.5);
            transform: translateX(6px);
          }
          
          .item-id { color: #ffffff; text-shadow: 0 0 8px $cyan; }
          .item-status { color: #ffffff; text-shadow: 0 0 8px $cyan; }
        }
      }

      /* --- LOCKED ORANGE SPECIFICATION --- */
      &--locked {
        .item-id { color: #161616; }
        .item-name { color: #161616; }
        .item-status { color: #161616; }
        .laser-burst { background: radial-gradient(circle, rgba(255, 85, 0, 0.15) 0%, transparent 85%); }

        &:hover {
          .laser-burst { transform: scaleX(1); }

          .item-name {
            color: $orange;
            text-shadow: 0 0 15px $orange;
            transform: translateX(6px);
          }

          .item-id { color: $orange; }
          .item-status { color: #ffffff; text-shadow: 0 0 8px $orange; }
        }
      }
    }
  }
</style>