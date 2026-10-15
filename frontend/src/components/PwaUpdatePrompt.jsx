import { usePwaStore, applyUpdate } from "../pwa";

// A new version was deployed and its service worker is waiting. Reloading
// is the user's call: it would interrupt a call or a half-typed message.
const PwaUpdatePrompt = () => {
  const updateReady = usePwaStore((s) => s.updateReady);
  if (!updateReady) return null;
  return (
    <div className="banner is-top" role="status">
      <span className="banner-text">A new version of talkify is available.</span>
      <button type="button" className="btn btn-primary" onClick={applyUpdate}>
        Update
      </button>
    </div>
  );
};

export default PwaUpdatePrompt;
