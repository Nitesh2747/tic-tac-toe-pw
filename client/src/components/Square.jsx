export default function Square({ value, onClick, disabled, isWinning, label }) {
  const classes = [
    "square",
    value ? `square--${value.toLowerCase()}` : "",
    isWinning ? "square--winning" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {value}
    </button>
  );
}
