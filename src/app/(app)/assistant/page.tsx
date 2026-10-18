import { AssistantView, type ChatMessage } from "@/components/assistant/assistant-view";
import { getSupabaseServer } from "@/lib/supabase/server";
import { aiConfigured } from "@/server/ai/client";
import { requireHousehold } from "@/server/context";

export const metadata = { title: "עוזר HomeOS" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string; new?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireHousehold();
  const supabase = await getSupabaseServer();
  const hid = ctx.household.id;
  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .eq("household_id", hid)
    .eq("user_id", ctx.user.id)
    .order("updated_at", { ascending: false })
    .limit(30);

  // Open the requested conversation, or continue the latest one from today.
  const list = conversations ?? [];
  let current: string | null = null;
  if (sp.c && list.some((c) => c.id === sp.c)) current = sp.c;
  else if (!sp.new && list[0] && Date.now() - new Date(list[0].updated_at).getTime() < 6 * 3600_000) current = list[0].id;

  let messages: ChatMessage[] = [];
  if (current) {
    const { data } = await supabase.from("ai_messages").select("id, role, content, actions, links, image_path, created_at").eq("conversation_id", current).order("created_at").limit(100);
    messages = (data ?? []) as ChatMessage[];
  }

  return <AssistantView householdId={hid} configured={aiConfigured()} conversationId={current} messages={messages} conversations={list} />;
}
