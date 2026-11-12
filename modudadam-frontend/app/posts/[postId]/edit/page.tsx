import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FilePenLine } from "lucide-react";
import { WriteForm } from "@/components/write-form";
import { getServerSessionUser } from "@/lib/auth";

export default async function EditPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  if (!await getServerSessionUser()) redirect(`/login?returnTo=${encodeURIComponent(`/posts/${postId}/edit`)}`);

  return <section className="content-page write-page compose-page">
    <header className="compose-header">
      <Link href={`/posts/${postId}`} aria-label="게시글로 돌아가기"><ChevronLeft size={24} /></Link>
      <span className="compose-category-icon compose-edit-icon"><FilePenLine size={22} /></span>
      <div><small>작성한 게시글</small><h1>게시글 수정</h1></div>
    </header>
    <WriteForm postId={postId} />
  </section>;
}
