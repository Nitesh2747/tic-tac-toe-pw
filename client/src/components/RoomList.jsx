// Public rooms, live. Click Join to enter one: no code needed.
// (Private rooms are never listed: they are joined with a code or a link.)
//
// rejoinId is the room this browser was last in. If you closed your tab you
// still hold your seat for a while, so that row says "Rejoin" even when full.
export default function RoomList({ rooms, onJoin, disabled, rejoinId }) {
  if (rooms === null) {
    return <p className="room-list__empty">Loading rooms…</p>;
  }
  if (rooms.length === 0) {
    return <p className="room-list__empty">No public rooms yet. Create one!</p>;
  }

  return (
    <ul className="room-list" aria-label="Public rooms">
      {rooms.map((room) => {
        const rejoin = room.full && room.id === rejoinId;
        const label = rejoin ? "Rejoin" : room.full ? "Full" : "Join";
        const description = rejoin
          ? `Rejoin ${room.name}`
          : room.full
            ? `${room.name} is full`
            : `Join ${room.name}`;

        return (
          <li key={room.id} className="room-list__row">
            <span className="room-list__name" title={room.name}>
              {room.name}
            </span>
            <span className="room-list__meta">
              <span className="badge badge--public">Public</span> {room.players}/2
            </span>
            <button
              type="button"
              className="reset room-list__join"
              onClick={() => onJoin(room.id)}
              disabled={disabled || (room.full && !rejoin)}
              aria-label={description}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
