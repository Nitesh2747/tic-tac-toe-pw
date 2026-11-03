// The two ways to play without a server.
export default function OfflineLinks({ onPlayLocal, onPlayComputer }) {
  return (
    <div className="offline-links">
      <button type="button" className="link-button" onClick={onPlayLocal}>
        Play on this device instead
      </button>
      <button type="button" className="link-button" onClick={onPlayComputer}>
        Play vs computer
      </button>
    </div>
  );
}
