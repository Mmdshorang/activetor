const CopyText = ({ value }) => {
  const handleCopy = (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;

        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";

        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        document.execCommand("copy");

        textArea.remove();
      }
    } catch (err) {
      console.error(err);
    }
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-700">{value || "-"}</span>

      <button
        onClick={handleCopy}
        className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition"
      >
        کپی
      </button>
    </div>
  );
};

export default CopyText;
