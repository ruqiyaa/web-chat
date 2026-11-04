import logo from "../assets/raabta-logo.png";

export default function JoinScreen({ name, setName, error, onJoin }) {
  function submit(e) {
    e.preventDefault();
    onJoin();
  }

  return (
    <div className="join">
      <form className="join-card" onSubmit={submit}>
        <div className="brand">
          <img src={logo} alt="" className="brand-logo" />
          <h1 className="wordmark">Raabta</h1>
          <p className="tagline">Your people. Your tea.</p>
        </div>
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
