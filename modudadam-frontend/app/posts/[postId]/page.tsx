import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { PostDetail } from "@/components/post-detail";
import { getServerSessionUser } from "@/lib/auth";
import { getPublicPost, getPublicPostAnswers, type PublicPost, type PublicPostAnswer } from "@/lib/public-post";
import { getSiteUrl } from "@/lib/site-url";

type PageProps = { params: Promise<{ postId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { postId } = await params;
  const post = await getPublicPost(postId);
  if (!post) return { title: "게시글을 찾을 수 없습니다", robots: { index: false, follow: false } };
  const description = summarize(post.content) || `${post.categoryName} 커뮤니티에 등록된 ${post.title} 글입니다.`;
  const canonical = `${getSiteUrl()}/posts/${post.id}`;
  const image = post.images[0]?.url || `${getSiteUrl()}/brand/modudadam-brand-mark.png`;
  const title=post.bounty ? `${post.title} - 현상금 질문` : post.title;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article", locale: "ko_KR", siteName: "모두다담", url: canonical,
      title, description, publishedTime: post.publishedAt || post.createdAt,
      modifiedTime: post.updatedAt, authors: [post.authorName], section: post.categoryName,
      images: [{ url: image, alt: post.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { postId } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(({ name, value }) => `${name}=${value}`).join("; ");
  const [user, post, answers] = await Promise.all([getServerSessionUser(), getPublicPost(postId, cookieHeader),getPublicPostAnswers(postId)]);
  if (!post) notFound();
  const canonical = `${getSiteUrl()}/posts/${post.id}`;
  const categoryUrl=post.bounty ? `${getSiteUrl()}/play/bounties` : `${getSiteUrl()}/category/${post.categoryCode}`;
  const structuredData = {
    "@context":"https://schema.org",
    "@graph":[
      buildPostEntity(post,answers.comments,answers.pagination.publishedRootCount,canonical),
      { "@type":"BreadcrumbList",itemListElement:[
        { "@type":"ListItem",position:1,name:"모두다담",item:getSiteUrl() },
        { "@type":"ListItem",position:2,name:post.categoryName,item:categoryUrl },
        { "@type":"ListItem",position:3,name:post.title,item:canonical },
      ] },
    ],
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <PostDetail postId={post.id} authenticated={Boolean(user)} kakaoJavascriptKey={process.env.KAKAO_JAVASCRIPT_KEY || ""} initialPost={post} />
  </>;
}

function buildPostEntity(post:PublicPost,comments:PublicPostAnswer[],rootAnswerCount:number,canonical:string) {
  const author={ "@type":"Person",name:post.authorName };
  const published=post.publishedAt||post.createdAt;
  const roots=comments.filter((comment)=>!comment.parentId&&comment.status==="published");
  if(post.bounty) {
    const mapped=roots.map((comment)=>({
      "@type":"Answer",url:`${canonical}#answer-${comment.id}`,text:comment.content,
      dateCreated:comment.createdAt,dateModified:comment.updatedAt,upvoteCount:comment.likeCount,
      author:{ "@type":"Person",name:comment.authorName },
    }));
    const acceptedIndex=roots.findIndex((comment)=>comment.isBountyWinner);
    const acceptedAnswer=acceptedIndex>=0 ? mapped[acceptedIndex] : undefined;
    const suggestedAnswer=mapped.filter((_,index)=>index!==acceptedIndex);
    return {
      "@type":"QAPage",mainEntity:{
        "@type":"Question",name:post.title,text:post.content,url:canonical,
        dateCreated:published,dateModified:post.updatedAt,answerCount:rootAnswerCount,
        upvoteCount:post.likeCount,author,
        ...(acceptedAnswer ? { acceptedAnswer } : {}),
        ...(suggestedAnswer.length ? { suggestedAnswer } : {}),
      },
    };
  }
  return {
    "@type":"DiscussionForumPosting",headline:post.title,text:post.content,url:canonical,
    mainEntityOfPage:canonical,datePublished:published,dateModified:post.updatedAt,author,
    articleSection:post.categoryName,commentCount:post.commentCount,
    ...(post.images.length ? { image:post.images.map((image)=>image.url) } : {}),
    interactionStatistic:[
      { "@type":"InteractionCounter",interactionType:"https://schema.org/ViewAction",userInteractionCount:post.viewCount },
      { "@type":"InteractionCounter",interactionType:"https://schema.org/LikeAction",userInteractionCount:post.likeCount },
      { "@type":"InteractionCounter",interactionType:"https://schema.org/CommentAction",userInteractionCount:post.commentCount },
    ],
    ...(comments.length ? { comment:comments.filter((comment)=>comment.status==="published").map((comment)=>({
      "@type":"Comment",url:`${canonical}#answer-${comment.id}`,text:comment.content,
      dateCreated:comment.createdAt,author:{ "@type":"Person",name:comment.authorName },
    })) } : {}),
  };
}

function summarize(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}
