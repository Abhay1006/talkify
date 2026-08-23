import Conversations from "./Conversations";
import SearchInput from "./SearchInput";

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <SearchInput />
      <div className="sidebar-heading">Conversations</div>
      <Conversations />
    </aside>
  );
};

export default Sidebar;
