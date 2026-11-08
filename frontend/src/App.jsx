import "./App.css";
import { useAuth } from "./hooks/useAuth";
import AuthScreen from "./components/AuthScreen";
import ChatApp from "./ChatApp";

export default function App() {
  const auth = useAuth();

  if (auth.loading) return <p className="center-note">Loading...</p>;
  if (!auth.user) return <AuthScreen onAuth={auth.setUser} />;

  return (
    <ChatApp
      key={auth.user.id}
      user={auth.user}
      onUserChange={auth.setUser}
      onLogout={auth.logout}
    />
  );
}
