export default function Status({ winner, isDraw, nextPlayer }) {
  let text;
  let tone = "playing";

  if (winner) {
    text = `${winner} wins!`;
    tone = "won";
  } else if (isDraw) {
    text = "It's a draw.";
    tone = "draw";
  } else {
    text = `${nextPlayer}'s turn`;
  }

  return (
    <p className={`status status--${tone}`} role="status" aria-live="polite">
      {text}
    </p>
  );
}
