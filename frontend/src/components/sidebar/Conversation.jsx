import { memo, useRef } from "react";
import Menu from "../ui/Menu";

const describe = ({ conversation, isOnline, unreadCount }) =>
  [
    conversation.username,
    conversation.pinned ? "pinned" : null,
    conversation.muted ? "muted" : null,
    isOnline ? "online" : "offline",
    unreadCount > 0 ? `${unreadCount} unread` : null,
  ]
    .filter(Boolean)
    .join(", ");

// The row is a button and the ⋯ menu is its sibling, not its child: a button
// inside a button is invalid and breaks keyboard and screen-reader use.
const Conversation = ({ conversation, isSelected, isOnline, unreadCount, onSelect, onChangePrefs }) => {
  const menuRef = useRef(null);
  const choose = (patch) => onChangePrefs(conversation._id, patch);

  return (
    <div className={`convo${isSelected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="convo-main"
        onClick={() => onSelect(conversation)}
        onContextMenu={(e) => {
          e.preventDefault();
          menuRef.current?.open();
        }}
        aria-current={isSelected ? "true" : undefined}
        aria-label={describe({ conversation, isOnline, unreadCount })}
      >
        {/* Always rendered so names stay aligned as presence flips. */}
        <span className={`convo-dot${isOnline ? "" : " is-off"}`} aria-hidden="true" />
        <span className="convo-name">{conversation.username}</span>
        {conversation.pinned && (
          <span className="convo-flag" aria-hidden="true">
            pin
          </span>
        )}
        {conversation.muted && (
          <span className="convo-flag" aria-hidden="true">
            muted
          </span>
        )}
        {unreadCount > 0 && (
          <span className="convo-unread" aria-hidden="true">
            {unreadCount}
          </span>
        )}
      </button>
      <Menu
        menuRef={menuRef}
        label={`Options for ${conversation.username}`}
        triggerClassName="convo-menu"
        items={[
          {
            label: conversation.pinned ? "Unpin" : "Pin to top",
            onSelect: () => choose({ pinned: !conversation.pinned }),
          },
          {
            label: conversation.muted ? "Unmute" : "Mute notifications",
            onSelect: () => choose({ muted: !conversation.muted }),
          },
          {
            label: conversation.archived ? "Unarchive" : "Archive",
            onSelect: () => choose({ archived: !conversation.archived }),
          },
        ]}
      />
    </div>
  );
};

export default memo(Conversation);
