import { useState } from "react";

export default function Composer({ onSend, onTyping, disabled, placeholder }) {
  const [text, setText] = useState("");

  function change(e) {
    setText(e.target.value);
    onTyping?.(e.target.value.trim().length > 0); // false when the box is emptied
  }

  function submit(e) {
    e.preventDefault();
    if (disabled || !text.trim()) return;
    onSend(text);
    onTyping?.(false);
    setText("");
  }

  return (
    <form className="composer" onSubmit={submit}>
      <input
        value={text}
        onChange={change}
        placeholder={placeholder}
        aria-label="Message"
        disabled={disabled}
      />
      <button
        type="submit"
        className="send"
        aria-label="Send"
        disabled={disabled}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
        </svg>
      </button>
    </form>
  );
}
