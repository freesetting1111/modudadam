import { redirect } from "next/navigation";
import { WriteForm } from "@/components/write-form";
import { getServerSessionUser } from "@/lib/auth";

export default async function EditPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  if (!await getServerSessionUser()) redirect(`/login?returnTo=${encodeURIComponent(`/posts/${postId}/edit`)}`);

  return <section className="content-page write-page">
    <h1>게시글 수정</h1>
    <p className="page-intro">작성한 내용을 수정합니다.</p>
    <WriteForm postId={postId} />
  </section>;
}
