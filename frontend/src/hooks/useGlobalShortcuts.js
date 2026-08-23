import { useEffect } from "react";
import useConversation from "../zustand/useConversations";

const NARROW = "(max-width: 700px)";

// Typing "/" into the composer must insert a slash, not steal focus.
const isTyping = (target) => {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
};

const useGlobalShortcuts = () => {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/" && !isTyping(e.target)) {
        const search = document.getElementById("sidebar-search");
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
        return;
      }

      // Only on the narrow layout, where the thread covers the whole screen and
      // Esc is the keyboard equivalent of the back button. On desktop the
      // sidebar is already visible and Esc would just discard your place.
      if (e.key === "Escape" && window.matchMedia(NARROW).matches) {
        const { selectedConversation, setSelectedConversation } = useConversation.getState();
        if (selectedConversation) setSelectedConversation(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};

export default useGlobalShortcuts;
