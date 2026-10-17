import { Bot } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "עוזר AI" };

export default function AssistantPage() {
  return (
    <ComingSoon
      title="עוזר HomeOS"
      icon={Bot}
      phase={3}
      description="עוזר בעברית שמכיר את הבית שלכם — ופועל רק על הנתונים שלכם, ורק באישורכם."
      features={[
        "״נגמרה אבקת כביסה, תוסיף לסופר״",
        "״מה יש לנו במקפיא?״",
        "סריקת קבלות ועדכון מלאי",
        "סיכום בוקר חכם",
      ]}
      cta={{ href: "/inventory", label: "בינתיים — למלאי" }}
    />
  );
}
