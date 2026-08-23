// Two bars per placeholder: a short author line and a longer body line. Widths
// live in CSS so the app ships no inline styles and the CSP can forbid them.
const MessageSkeleton = () => (
  <div className="skeleton-msg">
    <div className="skeleton skeleton-author" />
    <div className="skeleton skeleton-body" />
  </div>
);

export default MessageSkeleton;
