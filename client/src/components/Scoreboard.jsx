import Avatar from "./Avatar.jsx";

// Wins for X and O, plus draws. `players` is the public seat info ({ name,
// avatarSeed, connected } or null for an empty seat); `youAre` is "X", "O" or null.
export default function Scoreboard({ scores, players, youAre }) {
  const seats = [
    { id: "X", mark: "x", value: scores.X, player: players?.X },
    { id: "O", mark: "o", value: scores.O, player: players?.O },
  ];

  const [x, o] = seats.map((seat) => {
    const name = seat.player?.name ?? "Waiting…";
    const you = youAre === seat.id;
    return (
      <div
        key={seat.id}
        role="group"
        aria-label={`${name}, ${seat.id}${you ? ", you" : ""}, ${seat.value} wins`}
        className={`scoreboard__cell scoreboard__cell--${seat.mark} ${you ? "scoreboard__cell--you" : ""}`}
      >
        <div className="scoreboard__top">
          <Avatar
            seed={seat.player?.avatarSeed}
            size={22}
            away={seat.player ? !seat.player.connected : false}
          />
          <span className="scoreboard__value">{seat.value}</span>
        </div>
        <span className="scoreboard__name" title={name}>
          <span className="scoreboard__mark">{seat.id}</span>
          {name}
        </span>
      </div>
    );
  });

  return (
    <div className="scoreboard" role="group" aria-label="Score">
      {x}
      <div
        role="group"
        aria-label={`Draws, ${scores.draws}`}
        className="scoreboard__cell"
      >
        <div className="scoreboard__top">
          <span className="scoreboard__value">{scores.draws}</span>
        </div>
        <span className="scoreboard__name">Draws</span>
      </div>
      {o}
    </div>
  );
}
