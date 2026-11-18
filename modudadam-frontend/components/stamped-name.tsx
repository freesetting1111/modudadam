export function StampedName({ name, stamp, className = "" }: { name: string; stamp?: string | null; className?: string }) {
  return <span className={`stamped-name ${className}`.trim()}>
    {stamp && <span className={`stamped-name-mark ${stampEffect(stamp)}`} aria-label="대표 스탬프">{stamp}</span>}
    <span className="stamped-name-text">{name}</span>
  </span>;
}

function stampEffect(stamp: string) {
  if (["🛡️","⚜️","🦉"].includes(stamp)) return "stamp-effect-operator";
  if (["🌈👑","👑✨🌰"].includes(stamp)) return "stamp-effect-mythic";
  if (["🌌","🔥🪽","👑🐿️"].includes(stamp)) return "stamp-effect-legendary";
  if (["💜","💙","✨","🎨","🎵","🏆","🏅"].includes(stamp)) return "stamp-effect-epic";
  return "";
}
