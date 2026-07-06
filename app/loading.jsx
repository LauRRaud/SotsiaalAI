export default function Loading() {
  return <div aria-busy="true" aria-live="polite" style={{
    minHeight: "100dvh",
    width: "100%",
    backgroundColor: "transparent",
    backgroundImage: "none"
  }} />;
}