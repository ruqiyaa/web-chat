import "./App.css";
import { useChat } from "./hooks/useChat";
import JoinScreen from "./components/JoinScreen";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import Composer from "./components/Composer";

const EMPTY = [];

export default function App() {
  const chat = useChat();

  if (!chat.joined) {
    return (
      <JoinScreen
        name={chat.name}
        setName={chat.setName}
        error={chat.error}
        onJoin={chat.join}
      />
    );
  }

  const peerOffline =
    chat.active !== "group" && !chat.online.includes(chat.active);

  return (
    <div className="app">
      <Sidebar
        name={chat.name}
        active={chat.active}
        unread={chat.unread}
        online={chat.online}
        chats={chat.chats}
        onOpen={chat.openChat}
      />
      <main className="chat">
        <ChatWindow
          name={chat.name}
          active={chat.active}
          online={chat.online}
          lines={chat.chats[chat.active] || EMPTY}
          peerOffline={peerOffline}
        />
        <Composer
          key={chat.active}
          onSend={chat.send}
          disabled={peerOffline}
          placeholder={
            peerOffline ? `${chat.active} is offline` : "Type a message"
          }
        />
      </main>
    </div>
  );
}
