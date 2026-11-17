import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { PostDetail } from "@/components/post-detail";
import { getServerSessionUser } from "@/lib/auth";
import { getPublicPost } from "@/lib/public-post";
import { getSiteUrl } from "@/lib/site-url";

type PageProps = { params: Promise<{ postId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { postId } = await params;
  const post = await getPublicPost(postId);
  if (!post) return { title: "게시글을 찾을 수 없습니다", robots: { index: false, follow: false } };
  const description = summarize(post.content);
  const canonical = `${getSiteUrl()}/posts/${post.id}`;
  const image = post.images[0]?.url || `${getSiteUrl()}/brand/modudadam-brand-mark.png`;
  return {
    title: post.title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article", locale: "ko_KR", siteName: "모두다담", url: canonical,
      title: post.title, description, publishedTime: post.publishedAt || post.createdAt,
      modifiedTime: post.updatedAt, authors: [post.authorName], section: post.categoryName,
      images: [{ url: image, alt: post.title }],
    },
    twitter: { card: "summary_large_image", title: post.title, description, images: [image] },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { postId } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
  const [user, post] = await Promise.all([getServerSessionUser(), getPublicPost(postId, cookieHeader)]);
  if (!post) notFound();
  const canonical = `${getSiteUrl()}/posts/${post.id}`;
  const structuredData = {
    "@context": "https://schema.org", "@type": "Article",
    headline: post.title, description: summarize(post.content),
    datePublished: post.publishedAt || post.createdAt, dateModified: post.updatedAt,
    author: { "@type": "Person", name: post.authorName },
    publisher: { "@type": "Organization", name: "모두다담", logo: { "@type": "ImageObject", url: `${getSiteUrl()}/brand/modudadam-brand-mark.png` } },
    articleSection: post.categoryName, mainEntityOfPage: canonical,
    image: post.images.map((image) => image.url),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <PostDetail postId={post.id} authenticated={Boolean(user)} kakaoJavascriptKey={process.env.KAKAO_JAVASCRIPT_KEY || ""} initialPost={post} />
  </>;
}

function summarize(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}
