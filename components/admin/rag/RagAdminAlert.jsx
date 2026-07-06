"use client";

export default function RagAdminAlert({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div role="alert" onClick={onDismiss}>
      {message.text}
    </div>
  );
}
