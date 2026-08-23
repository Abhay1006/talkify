import { useState } from "react";
import useConversation from "../../zustand/useConversations.js";
import { useToast } from "../../context/ToastContext";
import { apiClient } from "../../api/client.js";

const SearchInput = () => {
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const { setSelectedConversation } = useConversation();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const term = search.trim();
    if (!term) return;
    if (term.length < 3) {
      toast("Search needs at least 3 characters", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.get(`/api/users/search?q=${encodeURIComponent(term)}`);
      if (data.length > 0) {
        setSelectedConversation(data[0]);
        setSearch("");
      } else {
        toast("No such user", "error");
      }
    } catch (error) {
      toast(error.message || "Search failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="sidebar-search" onSubmit={handleSubmit}>
      <input
        className="input"
        type="search"
        placeholder="username"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={loading}
        aria-label="Search usernames"
      />
      <button type="submit" className="btn" disabled={loading}>
        Go
      </button>
    </form>
  );
};

export default SearchInput;
