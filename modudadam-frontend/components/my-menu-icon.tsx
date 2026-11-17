type MyMenuIconProps = { type: "community" | "profile" | "policy" };

export function MyMenuIcon({ type }: MyMenuIconProps) {
  if (type === "community") return <svg viewBox="0 0 32 32" aria-hidden="true">
    <path className="soft" d="M4 7.5A5.5 5.5 0 0 1 9.5 2h10A5.5 5.5 0 0 1 25 7.5v5a5.5 5.5 0 0 1-5.5 5.5H13l-5.8 4 .8-4.6A5.5 5.5 0 0 1 4 12.5v-5Z"/>
    <path d="M7.2 8.2a4 4 0 0 1 4-4h8.1a4 4 0 0 1 4 4v3.6a4 4 0 0 1-4 4h-7l-4.6 3.1.7-3.8a4 4 0 0 1-1.2-2.9v-4Z"/>
    <path className="accent" d="M19.1 10.1c-1.2-1.4-3.5-.5-3.5 1.3 0 1.8 3.5 3.8 3.5 3.8s3.5-2 3.5-3.8c0-1.8-2.3-2.7-3.5-1.3Z"/>
    <path d="M11 9.5h2.7M11 12.3h3.2"/>
  </svg>;

  if (type === "profile") return <svg viewBox="0 0 32 32" aria-hidden="true">
    <circle className="soft" cx="14" cy="14" r="10"/>
    <path d="M7.4 12.2 6.2 8.5a2 2 0 0 1 3.2-2.1l2 1.6M20.6 12.2l1.2-3.7a2 2 0 0 0-3.2-2.1l-2 1.6"/>
    <path d="M7.5 14a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
    <circle className="accent" cx="11.5" cy="13.5" r="1"/><circle className="accent" cx="16.5" cy="13.5" r="1"/>
    <path d="M12 16.5c1.1.9 2.9.9 4 0M21.3 20.7l5-5 2 2-5 5-3 .9.9-2.9Z"/>
  </svg>;

  return <svg viewBox="0 0 32 32" aria-hidden="true">
    <path className="soft" d="M7 3h14a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/>
    <path d="M8 4.5h12.5a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H8a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 8 4.5Z"/>
    <path d="M10 10h9M10 14h7"/>
    <path className="accent" d="M15 18.6c-1.6-1.8-4.5-.7-4.5 1.7 0 2.3 4.5 4.8 4.5 4.8s4.5-2.5 4.5-4.8c0-2.4-2.9-3.5-4.5-1.7Z"/>
  </svg>;
}
