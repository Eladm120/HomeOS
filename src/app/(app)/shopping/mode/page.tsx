import { redirect } from "next/navigation";

// Shopping Mode was merged into the shopping list itself; keep old links and
// home-screen shortcuts working.
export default function ShoppingModePage() {
  redirect("/shopping");
}
