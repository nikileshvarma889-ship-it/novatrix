import { Suspense } from "react";
import { AuthForm } from "../AuthForm";
export default function Signup() {
  return <Suspense><AuthForm mode="signup" /></Suspense>;
}
