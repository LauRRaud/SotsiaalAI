"use client";

export default function RagAdminAlert({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div role="alert" className="ra-alert" onClick={onDismiss} title="Sulge teade">
      {message.text}
    </div>
  );
}
