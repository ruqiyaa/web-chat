import logo from "../assets/raabta-logo.png";

// Shown on the right when no chat is open.
export default function Welcome() {
  return (
    <div className="welcome">
      <img src={logo} alt="" />
      <h2>Welcome to Raabta</h2>
      <p>Your people. Your vibe.</p>
      <p>Pick a chat on the left, or start a new group.</p>
    </div>
  );
}
