import { useState } from "react";
import { useChat } from "./hooks/useChat";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import Composer from "./components/Composer";
import ProfileModal from "./components/ProfileModal";
import FriendsModal from "./components/FriendsModal";

const EMPTY = [];

export default function ChatApp({ user, onUserChange, onLogout }) {
  const chat = useChat(user);
  const [modal, setModal] = useState(null); // "profile", "friends" or null
  const peerOffline =
    chat.active !== "group" && !chat.online.includes(chat.active);
  const peerName = chat.profiles[chat.active]?.display_name || chat.active;

  return (
    <div className="app">
      <Sidebar
        name={chat.name}
        me={user}
        profiles={chat.profiles}
        friends={chat.friendData.friends}
        requestCount={chat.friendData.incoming.length}
        active={chat.active}
        unread={chat.unread}
        online={chat.online}
        chats={chat.chats}
        onOpen={chat.openChat}
        onProfile={() => setModal("profile")}
        onFriends={() => setModal("friends")}
      />
      <main className="chat">
        {!chat.connected && (
          <div className="conn-banner" role="status">
            Connecting to the server...
          </div>
        )}
        {chat.problem && (
          <div className="conn-banner" role="alert">
            {chat.problem}
          </div>
        )}

        <ChatWindow
          name={chat.name}
          profiles={chat.profiles}
          active={chat.active}
          online={chat.online}
          lines={chat.chats[chat.active] || EMPTY}
          peerOffline={peerOffline}
          ready={chat.active === "group" || !!chat.loaded[chat.active]}
        />
        <Composer
          key={chat.active}
          onSend={chat.send}
          placeholder="Type a message"
        />
      </main>
      {modal === "profile" && (
        <ProfileModal
          user={user}
          onUserChange={onUserChange}
          onLogout={onLogout}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "friends" && (
        <FriendsModal
          data={chat.friendData}
          onChanged={chat.loadFriends}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
