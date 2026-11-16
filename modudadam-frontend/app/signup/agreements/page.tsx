import { OAuthAgreements } from "@/components/oauth-agreements";

export default async function OAuthAgreementsPage({ searchParams }: {
  searchParams: Promise<{ ticket?: string }>;
}) {
  const { ticket = "" } = await searchParams;
  return <OAuthAgreements ticket={ticket} />;
}
