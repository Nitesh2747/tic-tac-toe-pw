// Pick how hard the computer plays. Clicking a level starts the game at once.
const LEVELS = [
  { id: "easy", title: "Easy", hint: "Plays at random" },
  { id: "medium", title: "Medium", hint: "Takes wins and blocks yours" },
  { id: "hard", title: "Hard", hint: "Never loses" },
];

export default function ComputerSetup({ onStart, onBack }) {
  return (
    <section className="lobby">
      <h2 className="setup__title">Play vs computer</h2>
      <ul className="level-list">
        {LEVELS.map((level) => (
          <li key={level.id}>
            <button type="button" className="level-button" onClick={() => onStart(level.id)}>
              <span className="level-button__title">{level.title}</span>
              <span className="level-button__hint">{level.hint}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="link-button" onClick={onBack}>
        ← Back to lobby
      </button>
    </section>
  );
}
