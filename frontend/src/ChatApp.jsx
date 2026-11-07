import { useChat } from "./hooks/useChat";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import Composer from "./components/Composer";

const EMPTY = [];

export default function ChatApp({ user }) {
  const chat = useChat(user);

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
        {!chat.connected && (
          <div className="conn-banner" role="status">
            Connecting to the server...
          </div>
        )}
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
