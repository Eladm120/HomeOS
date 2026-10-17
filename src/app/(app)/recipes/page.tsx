import { ChefHat } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "מתכונים" };

export default function RecipesPage() {
  return (
    <ComingSoon
      title="מתכונים"
      icon={ChefHat}
      phase={2}
      description="ספר מתכונים משותף שמחובר למלאי ולרשימת הקניות."
      features={[
        "שמירת מתכונים מקישורים, אתרים ותמונות",
        "השוואת מצרכים למה שיש בבית",
        "הוספת החסרים לרשימת הקניות בלחיצה",
        "תכנון ארוחות שבועי",
      ]}
      cta={{ href: "/shopping", label: "לרשימת הקניות" }}
    />
  );
}
