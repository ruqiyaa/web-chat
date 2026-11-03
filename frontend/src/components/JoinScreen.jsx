export default function JoinScreen({ name, setName, error, onJoin }) {
  function submit(e) {
    e.preventDefault();
    onJoin();
  }

  return (
    <div className="join">
      <form className="join-card" onSubmit={submit}>
        <h1>Join the chat</h1>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          autoFocus
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary">
          Join
        </button>
      </form>
    </div>
  );
}
