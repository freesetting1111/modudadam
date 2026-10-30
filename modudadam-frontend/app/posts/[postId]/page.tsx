import { PostDetail } from "@/components/post-detail";

export default async function PostPage({ params }: { params: Promise<{ postId: string }> }) {
  return <PostDetail postId={(await params).postId} />;
}
