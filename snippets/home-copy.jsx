// A button on the docs home that copies a line, such as the one to give an
// agent, and says so for two seconds. The line itself stays in the page, so
// it reads and exports without the button.
//
// Snippet exports are evaluated in isolation, so everything lives inside the
// component.
export const CopyButton = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => setCopied(true), () => {});
  };

  return (
    <button type="button" className="vh-copy" aria-label={label} onClick={copy}>
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
};
