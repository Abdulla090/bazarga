import { VerifyForm } from "./VerifyForm";

export const metadata = { title: "Confirm email", robots: { index: false } };

// The link only shows a button; the token is spent on the click, so mail scanners that pre-open links can't burn it.
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <VerifyForm token={token} />;
}
