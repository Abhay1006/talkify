import { useEffect, useRef, useState } from "react";
import useConversation from "../../zustand/useConversations.js";
import { useToast } from "../../context/ToastContext";
import { apiClient } from "../../api/client.js";

// Mirrors SEARCH_MIN_LENGTH in backend/controllers/user.controller.js.
const MIN_LENGTH = 3;

const SearchInput = () => {
  const [search, setSearch] = useState("");
  // null = no search run yet; [] = searched, nothing found.
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const setSelectedConversation = useConversation((state) => state.setSelectedConversation);
  const { toast } = useToast();
  const formRef = useRef(null);

  const closeResults = () => setResults(null);

  // Results close on any press outside the search box.
  useEffect(() => {
    if (!results) return;
    const onPointerDown = (e) => {
      if (!formRef.current?.contains(e.target)) setResults(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [results]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const term = search.trim();
    if (!term) return;
    if (term.length < MIN_LENGTH) {
      toast(`Search needs at least ${MIN_LENGTH} characters`, "error");
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.get(`/api/users/search?q=${encodeURIComponent(term)}`);
      setResults(data);
    } catch (error) {
      toast(error.message || "Search failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // Every match is listed to choose from; a prefix search can match several.
  const choose = (user) => {
    setSelectedConversation(user);
    setSearch("");
    closeResults();
  };

  return (
    <form
      ref={formRef}
      className="sidebar-search"
      role="search"
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === "Escape" && results) {
          e.stopPropagation();
          closeResults();
        }
      }}
    >
      <input
        id="sidebar-search"
        className="input"
        type="search"
        placeholder="username  /"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Search usernames"
        enterKeyHint="search"
        autoComplete="off"
      />
      <button type="submit" className="btn" disabled={loading}>
        {loading ? "…" : "Go"}
      </button>

      {results && (
        <div className="search-results">
          {results.length === 0 ? (
            <div className="sidebar-empty" role="status">
              No users found
            </div>
          ) : (
            <ul aria-label="Search results">
              {results.map((user) => (
                <li key={user._id}>
                  <button type="button" className="search-result" onClick={() => choose(user)}>
                    <span className="convo-name">{user.username}</span>
                    <span className="search-result-name">{user.fullName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
};

export default SearchInput;
