const URL_SPLIT = /(\bhttps?:\/\/[^\s<>"']+)/gi;
const TRAILING = /[.,;:!?)\]}'"]+$/;

// Message text with http(s) links made clickable. Built from text nodes and
// <a> elements, never innerHTML, so message content can't inject markup.
export const LinkifiedText = ({ text }) => {
  const parts = text.split(URL_SPLIT);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const url = part.replace(TRAILING, "");
        const trailing = part.slice(url.length);
        return (
          <span key={i}>
            <a className="msg-link" href={url} target="_blank" rel="noopener noreferrer nofollow">
              {url}
            </a>
            {trailing}
          </span>
        );
      })}
    </>
  );
};

// Title/description card for a link. Text only; see backend/utils/linkPreview.js.
export const LinkPreviewCard = ({ preview }) => {
  let host = "";
  try {
    host = new URL(preview.url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return (
    <a className="link-preview" href={preview.url} target="_blank" rel="noopener noreferrer nofollow">
      <span className="link-preview-site">{preview.siteName || host}</span>
      <span className="link-preview-title">{preview.title}</span>
      {preview.description && <span className="link-preview-desc">{preview.description}</span>}
    </a>
  );
};
