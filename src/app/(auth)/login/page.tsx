import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");
  return <LoginForm />;
}
