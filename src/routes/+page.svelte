<script lang="ts">
  const routes = [
    { path: "/games/pacman", name: "Pac-Man", available: true },
    { path: "#", name: "Space Invaders", available: false },
    { path: "#", name: "Tetris", available: false },
  ];
</script>

<main class="arcade-hub">
  <div class="arcade-hub__container">
    <div class="arcade-hub__glass">
      <div class="arcade-hub__monitor">
        <header class="arcade-hub__header">
          <h1 class="arcade-hub__title">JS ARCADE</h1>
          <div class="arcade-hub__divider">=========================</div>
          <p class="arcade-hub__status">SYSTEM STATUS: OK</p>
        </header>

        <ul class="arcade-hub__list">
          {#each routes as route}
            <li
              class="arcade-hub__item"
              class:arcade-hub__item--locked={!route.available}
            >
              {#if route.available}
                <a class="arcade-hub__link" href={route.path}>
                  <span class="arcade-hub__cursor">&gt;</span>
                  {route.name}
                </a>
              {:else}
                <span class="arcade-hub__link arcade-hub__link--disabled">
                  [ LOCKED ] {route.name}
                </span>
              {/if}
            </li>
          {/each}
        </ul>

        <footer class="arcade-hub__footer">
          <p class="arcade-hub__blink">PRESS START</p>
          <div class="arcade-hub__credits">
            <span>CREDITS [ 05 ]</span>
            <span>FREE PLAY</span>
          </div>
        </footer>
      </div>
    </div>
  </div>
</main>

<style lang="scss">
  $font-arcade: "Jersey-Regular", monospace;

  $color-amber: #ffb000;
  $color-muted: rgba(255, 176, 0, 0.4);
  $color-disabled: #2c2d30;

  .arcade-hub {
    font-family: $font-arcade;
    text-transform: uppercase;

    /* Center the monitor perfectly in the void */
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100vw;
    height: 100vh;
    background: #0c0d10;
    overflow: hidden;

    &__container {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    &__glass {
      filter: blur(0.4px);
    }

    &__monitor {
      border: 2px solid $color-amber;
      padding: 2.5rem;
      border-radius: 6px;
      width: 400px;
      text-align: center;
      background: #0e0f12;

      box-shadow:
        0 0 15px rgba(255, 176, 0, 0.15),
        inset 0 0 15px rgba(255, 176, 0, 0.15);
    }

    &__title {
      font-size: 3rem;
      color: $color-amber;
      margin-bottom: 0.2rem;
      line-height: 1;
      text-shadow: 0 0 8px $color-amber;
    }

    &__divider {
      color: $color-muted;
      letter-spacing: 2px;
      margin-bottom: 0.5rem;
    }

    &__status {
      font-size: 1rem;
      color: $color-muted;
      margin-bottom: 2rem;
    }

    &__list {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      margin-bottom: 3rem;
      text-align: left;
      padding-left: 1.5rem;
      list-style: none;
    }

    &__item {
      font-size: 1.6rem;

      &--locked {
        color: $color-disabled;
      }
    }

    &__link {
      display: flex;
      align-items: center;
      gap: 10px;
      color: $color-amber;
      text-decoration: none;

      &:hover:not(.arcade-hub__link--disabled) {
        background-color: $color-amber;
        color: #0c0d10;
        padding-left: 5px;
        text-shadow: none;

        .arcade-hub__cursor {
          color: #0c0d10;
        }
      }

      &--disabled {
        cursor: not-allowed;
      }
    }

    &__cursor {
      font-weight: bold;
      color: $color-amber;
    }

    &__footer {
      border-top: 1px dashed $color-muted;
      padding-top: 1.5rem;
    }

    &__blink {
      color: $color-amber;
      font-size: 1.4rem;
      margin-bottom: 0.5rem;
      animation: flash 1.2s steps(2, start) infinite;
    }

    &__credits {
      display: flex;
      justify-content: space-between;
      font-size: 1rem;
      color: $color-muted;
    }
  }

  @keyframes flash {
    to {
      visibility: hidden;
    }
  }
</style>
