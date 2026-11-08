import { useState } from "react";
import { useChat } from "./hooks/useChat";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import Composer from "./components/Composer";
import ProfileModal from "./components/ProfileModal";

const EMPTY = [];

export default function ChatApp({ user, onUserChange, onLogout }) {
  const chat = useChat(user);
  const [showProfile, setShowProfile] = useState(false);
  const peerOffline =
    chat.active !== "group" && !chat.online.includes(chat.active);
  const peerName = chat.profiles[chat.active]?.display_name || chat.active;

  return (
    <div className="app">
      <Sidebar
        name={chat.name}
        me={user}
        profiles={chat.profiles}
        active={chat.active}
        unread={chat.unread}
        online={chat.online}
        chats={chat.chats}
        onOpen={chat.openChat}
        onProfile={() => setShowProfile(true)}
      />
      <main className="chat">
        {!chat.connected && (
          <div className="conn-banner" role="status">
            Connecting to the server...
          </div>
        )}
        <ChatWindow
          name={chat.name}
          profiles={chat.profiles}
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
            peerOffline ? `${peerName} is offline` : "Type a message"
          }
        />
      </main>
      {showProfile && (
        <ProfileModal
          user={user}
          onUserChange={onUserChange}
          onLogout={onLogout}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
