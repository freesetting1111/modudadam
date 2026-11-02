import { PostDetail } from "@/components/post-detail";
import { getServerSessionUser } from "@/lib/auth";

export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  const user = await getServerSessionUser();
  return <PostDetail postId={(await params).postId} authenticated={Boolean(user)} />;
}
