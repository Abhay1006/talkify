import Conversations from "./Conversations";
import SearchInput from "./SearchInput";

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <SearchInput />
      <Conversations />
    </aside>
  );
};

export default Sidebar;
