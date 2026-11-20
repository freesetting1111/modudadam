import { Eye, MessageCircle } from "lucide-react";
import { StampedName } from "@/components/stamped-name";
import { formatPostListDate } from "@/lib/post-display";

export function PostListMeta({
  authorName,
  authorStampEmoji,
  createdAt,
  viewCount,
  commentCount,
  className = "",
}: {
  authorName: string;
  authorStampEmoji?: string | null;
  createdAt: string;
  viewCount: number;
  commentCount: number;
  className?: string;
}) {
  return <div className={`post-list-meta ${className}`.trim()}>
    <StampedName full className="post-list-author" name={authorName} stamp={authorStampEmoji} />
    <time dateTime={createdAt}>{formatPostListDate(createdAt)}</time>
    <span aria-label={`조회 ${viewCount}`}><Eye size={13} />{viewCount}</span>
    <span aria-label={`댓글 ${commentCount}`}><MessageCircle size={13} />{commentCount}</span>
  </div>;
}
