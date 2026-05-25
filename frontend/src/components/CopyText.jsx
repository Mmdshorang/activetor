const CopyText = ({ value }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(value || "");
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