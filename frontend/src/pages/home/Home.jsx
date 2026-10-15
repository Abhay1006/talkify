import MessageContainer from "../../components/messages/MessageContainer";
import Sidebar from "../../components/sidebar/Sidebar";
import TopBar from "../../components/TopBar";
import useConversation from "../../zustand/useConversations.js";
import useGlobalShortcuts from "../../hooks/useGlobalShortcuts";
import useListenMessages from "../../hooks/useListenMessages";
import useDeepLinks from "../../hooks/useDeepLinks";

const Home = () => {
  const hasSelection = useConversation((state) => Boolean(state.selectedConversation));
  useGlobalShortcuts();
  // Here, not in the message pane, so it runs whether or not a chat is open.
  useListenMessages();
  // Profile QR links (?add=) and notification taps (?chat=).
  useDeepLinks();

  return (
    <div className="app">
      <TopBar />
      {/* Both panes stay mounted; on narrow screens CSS shows one at a time. */}
      <div className={`workspace${hasSelection ? " show-chat" : ""}`}>
        <Sidebar />
        <MessageContainer />
      </div>
    </div>
  );
};

export default Home;
