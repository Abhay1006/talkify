import MessageContainer from "../../components/messages/MessageContainer";
import Sidebar from "../../components/sidebar/Sidebar";
import TopBar from "../../components/TopBar";
import useConversation from "../../zustand/useConversations.js";
import useGlobalShortcuts from "../../hooks/useGlobalShortcuts";

const Home = () => {
  const { selectedConversation } = useConversation();
  useGlobalShortcuts();

  return (
    <div className="app">
      <TopBar />
      {/* Both panes stay mounted; on narrow screens CSS shows one at a time,
          so going back to the list never remounts the chat. */}
      <div className={`workspace${selectedConversation ? " show-chat" : ""}`}>
        <Sidebar />
        <MessageContainer />
      </div>
    </div>
  );
};

export default Home;
