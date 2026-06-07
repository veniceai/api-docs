export const CopyMarkdownButton = (props = {}) => {
  const {
    className = "",
    label = "Copy article to Markdown",
    sourcePath,
  } = props;
  const statusText = {
    loading: "Copying...",
    copied: "Copied!",
    error: "Could not copy",
    localUnavailable: "Unavailable locally",
  };

  const getMarkdownUrl = () => {
    const baseUrl = new URL(window.location.href);

    if (sourcePath) {
      return new URL(sourcePath, baseUrl).toString();
    }

    const pathname = baseUrl.pathname.replace(/\/$/, "") || "/";
    const markdownPath =
      pathname === "/"
        ? "/index.md"
        : `${pathname.replace(/\.(html|mdx?|md)$/i, "")}.md`;

    return new URL(markdownPath, baseUrl.origin).toString();
  };

  const isLocalPreview = () => {
    const { hostname } = window.location;

    return (
      hostname === "localhost" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname.startsWith("127.")
    );
  };

  const fetchMarkdown = async (url, credentials = "same-origin") => {
    const response = await fetch(url, {
      headers: {
        Accept: "text/markdown, text/plain;q=0.9, */*;q=0.1",
      },
      credentials,
    });

    if (!response.ok) {
      throw new Error(`Markdown request failed: ${response.status}`);
    }

    return response.text();
  };

  const copyToClipboard = async (text) => {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const updateButton = (button, text, disabled = false) => {
    const labelNode = button.querySelector(
      ".venice-copy-markdown-button-label",
    );

    if (labelNode) {
      labelNode.textContent = text;
    }

    button.disabled = disabled;
  };

  const handleCopy = async (event) => {
    const button = event.currentTarget;
    updateButton(button, statusText.loading, true);

    try {
      if (isLocalPreview()) {
        throw new Error("Mintlify local preview does not serve Markdown exports");
      }

      const markdown = await fetchMarkdown(getMarkdownUrl());
      await copyToClipboard(markdown);
      updateButton(button, statusText.copied);
      window.setTimeout(() => updateButton(button, label), 2000);
    } catch (error) {
      console.error("Failed to copy page Markdown:", error);
      updateButton(
        button,
        isLocalPreview() ? statusText.localUnavailable : statusText.error,
      );
      window.setTimeout(() => updateButton(button, label), 2500);
    }
  };

  return (
    <button
      type="button"
      className={`venice-copy-markdown-button ${className}`.trim()}
      onClick={handleCopy}
      aria-live="polite"
    >
      <svg
        className="venice-copy-markdown-button-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span className="venice-copy-markdown-button-label">{label}</span>
    </button>
  );
};
