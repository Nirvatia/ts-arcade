<script lang="ts">
  import { onMount } from "svelte";

  interface GameRoute {
    id: string;
    path: string;
    name: string;
    color: string;
    available: boolean;
  }

  const routes: GameRoute[] = [
    {
      id: "01",
      path: "/games/pacman",
      name: "PAC-MAN",
      color: "#ddaa44",
      available: true,
    },
    { id: "02", path: "#", name: "SNAKE", color: "#44aa44", available: false },
    { id: "03", path: "#", name: "TETRIS", color: "#aa4444", available: false },
    { id: "04", path: "#", name: "PONG", color: "#aaaa44", available: false },
    {
      id: "05",
      path: "#",
      name: "BREAKOUT",
      color: "#aa44aa",
      available: false,
    },
    {
      id: "06",
      path: "#",
      name: "SPACE INVADERS",
      color: "#44aaaa",
      available: false,
    },
    {
      id: "07",
      path: "#",
      name: "FROGGER",
      color: "#88aa44",
      available: false,
    },
    {
      id: "08",
      path: "#",
      name: "DIG DUG",
      color: "#aa8844",
      available: false,
    },
    { id: "09", path: "#", name: "GALAGA", color: "#4488aa", available: false },
    {
      id: "10",
      path: "#",
      name: "ASTEROIDS",
      color: "#884488",
      available: false,
    },
  ];

  let selectedIndex = $state(0);
  let transitioning = $state(false);

  const availableIndices = routes
    .map((r, i) => (r.available ? i : -1))
    .filter((i) => i >= 0);

  function selectNext() {
    if (availableIndices.length === 0) return;
    const pos = availableIndices.indexOf(selectedIndex);
    selectedIndex = availableIndices[(pos + 1) % availableIndices.length];
  }

  function selectPrev() {
    if (availableIndices.length === 0) return;
    const pos = availableIndices.indexOf(selectedIndex);
    selectedIndex =
      availableIndices[
        (pos - 1 + availableIndices.length) % availableIndices.length
      ];
  }

  function activate() {
    const route = routes[selectedIndex];
    if (route?.available && !transitioning) {
      window.location.href = route.path;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectNext();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectPrev();
    } else if (e.key === "Enter") {
      e.preventDefault();
      activate();
    }
  }

  onMount(() => {
    if (availableIndices.length > 0) selectedIndex = availableIndices[0];
  });
</script>

<svelte:window onkeydown={onKeydown} />

<main class="void-library">
  <div class="starfield"></div>

  <header class="library-header">
    <span class="archive-label">ARCHIVE</span>
  </header>

  <div class="transmissions">
    {#each routes as route, i}
      {@const isAvailable = route.available}
      {@const isSelected = i === selectedIndex}

      <button
        class="transmission"
        class:available={isAvailable}
        class:locked={!isAvailable}
        class:selected={isSelected}
        style="--sig-color: {route.color};"
        disabled={!isAvailable}
        onclick={activate}
        onmouseenter={() => {
          if (isAvailable) selectedIndex = i;
        }}
        onfocus={() => {
          if (isAvailable) selectedIndex = i;
        }}
        onkeydown={(e) => {
          if (e.key === "Enter") activate();
        }}
        aria-label={`${route.name}${isAvailable ? "" : " — dormant"}`}
      >
        <span class="transmission-name">{route.name}</span>
        {#if !isAvailable}
          <span class="transmission-status">DORMANT</span>
        {/if}
        {#if isSelected && isAvailable}
          <span class="focus-stars">
            <span class="fstar f1"></span>
            <span class="fstar f2"></span>
            <span class="fstar f3"></span>
            <span class="fstar f4"></span>
          </span>
        {/if}
      </button>
    {/each}
  </div>
</main>

<style lang="scss">
  $void: #040410;
  $violet: #6655aa;
  $violet-dim: rgba(120, 100, 180, 0.45);
  $white: #eeeedd;
  $white-dim: #8888aa;

  :global(body) {
    margin: 0;
    background: $void;
    overflow: hidden;
  }

  .void-library {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    width: 100vw;
    background: radial-gradient(ellipse at center, #0c0c24 0%, $void 55%);
    font-family: "Jersey-Regular", "Courier New", monospace;
    position: relative;
    overflow: hidden;
  }

  // ── Starfield ───────────────────────────────────────────
  .starfield {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(
        1px 1px at 8% 12%,
        rgba(150, 120, 220, 0.5),
        transparent
      ),
      radial-gradient(1px 1px at 18% 50%, rgba(150, 120, 220, 0.3), transparent),
      radial-gradient(
        1.2px 1.2px at 30% 8%,
        rgba(180, 150, 240, 0.55),
        transparent
      ),
      radial-gradient(
        1px 1px at 44% 60%,
        rgba(150, 120, 220, 0.35),
        transparent
      ),
      radial-gradient(
        1.5px 1.5px at 55% 18%,
        rgba(200, 170, 255, 0.5),
        transparent
      ),
      radial-gradient(1px 1px at 62% 72%, rgba(150, 120, 220, 0.3), transparent),
      radial-gradient(1px 1px at 72% 38%, rgba(150, 120, 220, 0.4), transparent),
      radial-gradient(
        1.3px 1.3px at 82% 10%,
        rgba(180, 150, 240, 0.5),
        transparent
      ),
      radial-gradient(1px 1px at 90% 55%, rgba(150, 120, 220, 0.3), transparent),
      radial-gradient(1px 1px at 4% 78%, rgba(150, 120, 220, 0.35), transparent),
      radial-gradient(
        1.2px 1.2px at 25% 32%,
        rgba(180, 150, 240, 0.45),
        transparent
      ),
      radial-gradient(1px 1px at 40% 80%, rgba(150, 120, 220, 0.3), transparent),
      radial-gradient(
        1.4px 1.4px at 52% 45%,
        rgba(200, 170, 255, 0.4),
        transparent
      ),
      radial-gradient(1px 1px at 68% 6%, rgba(150, 120, 220, 0.45), transparent),
      radial-gradient(1px 1px at 85% 68%, rgba(150, 120, 220, 0.3), transparent);
    pointer-events: none;
    z-index: 0;
  }

  // ── Header ──────────────────────────────────────────────
  .library-header {
    position: relative;
    z-index: 1;
    padding: 3.5rem 1rem 3rem;
  }

  .archive-label {
    font-size: 0.65rem;
    color: rgba($violet, 0.35);
    letter-spacing: 8px;
    text-transform: uppercase;
  }

  // ── Transmissions ───────────────────────────────────────
  .transmissions {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.2rem;
    padding: 1rem 2rem 6rem;
    width: 100%;
    max-width: 500px;
    overflow-y: auto;
    flex: 1;

    &::-webkit-scrollbar {
      width: 3px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: rgba($violet, 0.15);
      border-radius: 2px;
    }
  }

  .transmission {
    background: none;
    border: none;
    cursor: default;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 1rem 1.5rem;
    position: relative;
    font-family: inherit;
    width: 100%;
    transition: transform 0.3s ease;
    outline-offset: 4px;

    &.available {
      cursor: pointer;

      &:hover .transmission-name,
      &:focus-visible .transmission-name {
        color: $white;
        text-shadow:
          0 0 12px var(--sig-color),
          0 0 30px var(--sig-color),
          0 0 50px rgba(0, 0, 0, 0);
        letter-spacing: 10px;
        transition:
          letter-spacing 0.3s ease,
          text-shadow 0.3s ease;
      }

      &:hover,
      &:focus-visible {
        transform: scale(1.06);
      }

      &:hover .focus-stars .fstar,
      &:focus-visible .focus-stars .fstar {
        opacity: 1;
        animation-duration: 0.8s;
      }
    }

    &.selected {
      transform: scale(1.08);
    }

    &.available:focus-visible {
      box-shadow: 0 0 0 2px $violet-dim;
      border-radius: 3px;
    }
  }

  .transmission-name {
    font-size: 2rem;
    letter-spacing: 6px;
    color: #1a1a2e;
    transition:
      color 0.4s ease,
      text-shadow 0.4s ease,
      letter-spacing 0.3s ease;
  }

  .available .transmission-name {
    color: $white-dim;
  }

  .selected.available .transmission-name {
    color: $white;
    text-shadow:
      0 0 18px var(--sig-color),
      0 0 40px var(--sig-color);
  }

  .locked .transmission-name {
    color: #141428;
  }

  .transmission-status {
    font-size: 0.55rem;
    letter-spacing: 4px;
    color: #1a1a2e;
  }

  // ── Focus stars ─────────────────────────────────────────
  .focus-stars {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fstar {
    position: absolute;
    width: 2px;
    height: 2px;
    background: $white;
    border-radius: 50%;
    box-shadow: 0 0 6px var(--sig-color);
    opacity: 0.3;
    animation: star-twinkle 1.5s ease-in-out infinite;
  }

  .f1 {
    top: 8%;
    left: 12%;
    animation-delay: 0s;
  }
  .f2 {
    top: 10%;
    right: 15%;
    animation-delay: 0.4s;
  }
  .f3 {
    bottom: 10%;
    left: 20%;
    animation-delay: 0.8s;
  }
  .f4 {
    bottom: 12%;
    right: 15%;
    animation-delay: 1.2s;
  }

  @keyframes star-twinkle {
    0%,
    100% {
      opacity: 0.2;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.8);
    }
  }
</style>
