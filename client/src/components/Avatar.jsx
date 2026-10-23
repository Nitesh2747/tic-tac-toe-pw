import { getAvatar } from "../game/avatar.js";

// size is in pixels. With no seed (an empty seat) it draws a dashed "?" placeholder.
// `away` fades it out, for a player who is disconnected.
export default function Avatar({ seed, size = 24, away = false }) {
  if (!seed) {
    return (
      <span
        className="avatar avatar--empty"
        style={{ width: size, height: size, fontSize: size * 0.55 }}
        aria-hidden="true"
      >
        ?
      </span>
    );
  }

  const { cells, hue } = getAvatar(seed);
  return (
    <svg
      className={`avatar ${away ? "avatar--away" : ""}`}
      viewBox="0 0 7 7" // the 5x5 pattern plus a one-cell margin
      width={size}
      height={size}
      style={{ "--h": hue }}
      aria-hidden="true"
    >
      <rect className="avatar__bg" width="7" height="7" />
      {cells.map((row, y) =>
        row.map(
          (filled, x) =>
            filled && (
              <rect
                key={`${x}-${y}`}
                className="avatar__cell"
                x={x + 1}
                y={y + 1}
                width="1"
                height="1"
              />
            )
        )
      )}
    </svg>
  );
}
