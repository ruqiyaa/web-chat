import { useState } from "react";
import { useChat } from "./hooks/useChat";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import Composer from "./components/Composer";
import Welcome from "./components/Welcome";
import ProfileModal from "./components/ProfileModal";
import FriendsModal from "./components/FriendsModal";
import CreateGroupModal from "./components/CreateGroupModal";
import GroupInfoModal from "./components/GroupInfoModal";

const EMPTY = [];

export default function ChatApp({ user, onUserChange, onLogout }) {
  const chat = useChat(user);
  const [modal, setModal] = useState(null); // "profile", "friends", "newgroup", "groupinfo" or null

  const isGroup = chat.active.startsWith("g:");
  const group = isGroup
    ? chat.groups.find((g) => `g:${g.id}` === chat.active)
    : undefined;
  const peerOffline =
    !!chat.active && !isGroup && !chat.online.includes(chat.active);

  return (
    <div className="app">
      <Sidebar
        name={chat.name}
        me={user}
        profiles={chat.profiles}
        friends={chat.friendData.friends}
        groups={chat.groups}
        requestCount={chat.friendData.incoming.length}
        active={chat.active}
        unread={chat.unread}
        online={chat.online}
        chats={chat.chats}
        typingFrom={chat.typingFrom}
        onOpen={chat.openChat}
        onProfile={() => setModal("profile")}
        onFriends={() => setModal("friends")}
        onNewGroup={() => setModal("newgroup")}
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
        {chat.active ? (
          <>
            <ChatWindow
              name={chat.name}
              profiles={chat.profiles}
              active={chat.active}
              group={group}
              lines={chat.chats[chat.active] || EMPTY}
              peerOffline={peerOffline}
              ready={!!chat.loaded[chat.active]}
              typing={!!chat.typingFrom[chat.active]}
              onGroupInfo={() => setModal("groupinfo")}
            />
            <Composer
              key={chat.active}
              onSend={chat.send}
              onTyping={chat.typing}
              placeholder="Type a message"
            />
          </>
        ) : (
          <Welcome />
        )}
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
      {modal === "newgroup" && (
        <CreateGroupModal
          friends={chat.friendData.friends}
          onCreated={async (g) => {
            await chat.loadGroups(); // make sure the new group is in the list first
            chat.openChat(`g:${g.id}`);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "groupinfo" && group && (
        <GroupInfoModal
          groupId={group.id}
          groups={chat.groups}
          me={chat.name}
          friends={chat.friendData.friends}
          onChanged={chat.loadGroups}
          onLeft={() => {
            chat.openChat("");
            setModal(null);
            chat.loadGroups();
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
