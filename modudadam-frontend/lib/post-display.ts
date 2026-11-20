export const POST_TITLE_DISPLAY_LIMIT = 35;

export function displayPostTitle(title: string) {
  const characters = Array.from(title.trim());
  if (characters.length <= POST_TITLE_DISPLAY_LIMIT) return characters.join("");
  return `${characters.slice(0, POST_TITLE_DISPLAY_LIMIT).join("")}...`;
}

export function formatPostListDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return `${date.getMonth() + 1}.${date.getDate()}`;
}
