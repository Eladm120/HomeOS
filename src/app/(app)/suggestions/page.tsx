import { redirect } from "next/navigation";

// Suggestions and notifications are one feed now.
export default function SuggestionsPage() {
  redirect("/notifications");
}
