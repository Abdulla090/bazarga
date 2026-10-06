import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/dashboard");
  return <SignupForm />;
}
