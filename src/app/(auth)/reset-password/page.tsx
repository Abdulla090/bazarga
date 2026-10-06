import { ResetForm } from "./ResetForm";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return <ResetForm token={token} />;
}
