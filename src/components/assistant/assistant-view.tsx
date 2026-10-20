"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Camera, Check, History, Loader2, Mic, Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteConversation, resolveAssistantAction, sendAssistantMessage } from "@/server/actions/assistant";
import type { AssistantAction } from "@/server/ai/tools";
import { uploadHouseholdImage, validateImageFile } from "@/lib/media";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Panel } from "@/components/ui/panel";
import { SignedImage } from "@/components/media/signed-image";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: AssistantAction[];
  links: { label: string; href: string }[];
  image_path: string | null;
  created_at: string;
}

const STARTERS = [
  "מה אנחנו צריכים לעשות השבוע בבית?",
  "מה יש לנו במקפיא?",
  "נגמרה לנו אבקת כביסה, תוסיף לסופר",
  "מה אפשר לבשל הערב ממה שיש?",
  "מה המצב של התיקון במזגן?",
  "מה עוד חסר לנו לחדר העבודה?",
];

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { 0: { transcript: string } }[] & { length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function AssistantView({
  householdId,
  configured,
  conversationId: initialConversation,
  messages: initialMessages,
  conversations,
}: {
  householdId: string;
  configured: boolean;
  conversationId: string | null;
  messages: ChatMessage[];
  conversations: { id: string; title: string | null; updated_at: string }[];
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversation);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [speech, setSpeech] = useState<SpeechCtor | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<InstanceType<SpeechCtor> | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    setSpeech(() => w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null);
  }, []);
  useEffect(() => {
    setMessages(initialMessages);
    setConversationId(initialConversation);
  }, [initialMessages, initialConversation]);
  useEffect(() => {
    void endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  async function send(text: string) {
    const body = text.trim();
    if ((!body && !image) || sending) return;
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: "user", content: body, actions: [], links: [], image_path: image, created_at: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    setDraft("");
    const img = image;
    setImage(null);
    setSending(true);
    const res = await sendAssistantMessage({ conversation_id: conversationId, text: body, image_path: img });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setDraft(body);
      setImage(img);
      return;
    }
    if (!conversationId) {
      setConversationId(res.data.conversationId);
      window.history.replaceState(null, "", `/assistant?c=${res.data.conversationId}`);
    }
    setMessages((m) => [...m, { ...res.data.message, image_path: null }]);
  }

  async function attach(file: File | undefined) {
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) return void toast.error(problem);
    setUploading(true);
    try {
      setImage(await uploadHouseholdImage(householdId, "documents", file));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function toggleVoice() {
    if (!speech) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new speech();
    rec.lang = "he-IL";
    rec.interimResults = false;
    rec.onresult = (e) => setDraft((d) => `${d} ${e.results[0][0].transcript}`.trim());
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.error("לא הצלחנו לשמוע. נסו שוב או כתבו.");
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function resolve(msg: ChatMessage, action: AssistantAction, decision: "confirm" | "dismiss") {
    const res = await resolveAssistantAction(msg.id, action.id, decision);
    if (!res.ok) return void toast.error(res.error);
    setMessages((list) => list.map((m) => (m.id === msg.id ? { ...m, actions: m.actions.map((a) => (a.id === action.id ? { ...a, status: res.data.status } : a)) } : m)));
    if (res.data.status === "done") toast.success(res.data.summary);
  }

  return (
    <>
      <PageHeader
        title="עוזר HomeOS"
        subtitle={configured ? "שואלים על הבית, והוא בודק בנתונים שלכם" : "עוד לא מחובר"}
        actions={
          <div className="flex gap-2">
            {conversations.length > 0 && (
              <Button size="icon-sm" variant="secondary" onClick={() => setHistoryOpen(true)} aria-label="שיחות קודמות">
                <History />
              </Button>
            )}
            {conversationId && (
              <Button size="icon-sm" variant="secondary" onClick={() => router.push("/assistant?new=1")} aria-label="שיחה חדשה">
                <Plus />
              </Button>
            )}
          </div>
        }
      />

      {!configured && (
        <div className="mb-4 rounded-[var(--radius)] border border-border bg-amber-soft p-4 text-[15px] text-amber">
          העוזר צריך מפתח API של Anthropic בהגדרות השרת (ANTHROPIC_API_KEY ב-Vercel). אחרי שיתווסף, הצ׳אט, קריאת הקבלות והסיכום היומי יעבדו. כל שאר האפליקציה עובדת גם בלעדיו.
        </div>
      )}

      <div className="space-y-3 pb-36">
        {messages.length === 0 && (
          <div className="py-6">
            <div className="mx-auto mb-4 grid size-16 place-items-center rounded-3xl bg-primary-soft text-primary">
              <Sparkles className="size-8" />
            </div>
            <p className="mb-4 text-center text-[15px] text-muted">למשל:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" disabled={!configured} onClick={() => send(s)} className="pressable rounded-full border border-border bg-surface px-3.5 py-2 text-[14px] disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-start" : "justify-end")}>
            <div className={cn("max-w-[88%] space-y-2", m.role === "user" ? "items-start" : "items-end")}>
              {m.image_path && <SignedImage path={m.image_path} alt="תמונה מצורפת" className="size-40 rounded-2xl border border-border" />}
              {m.content && (
                <div
                  className={cn(
                    "rounded-[1.25rem] px-4 py-2.5 text-[16px] leading-relaxed whitespace-pre-wrap",
                    m.role === "user" ? "rounded-ss-md bg-primary text-primary-foreground" : "rounded-se-md border border-border bg-surface",
                  )}
                >
                  {m.content}
                </div>
              )}
              {m.actions.map((a) => (
                <div key={a.id} className="rounded-2xl border border-primary/40 bg-primary-soft p-3">
                  <p className="text-[15px] font-medium">{a.title}</p>
                  {a.type === "add_grocery" && Array.isArray((a.payload as { items?: unknown[] }).items) && (
                    <ul className="footnote mt-1 text-muted">
                      {((a.payload as { items: { name: string; quantity: number; unit: string }[] }).items).map((i, idx) => (
                        <li key={idx}>
                          • {i.name} <span className="num">{i.quantity}</span> {i.unit}
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.status === "proposed" ? (
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => resolve(m, a, "confirm")}>
                        <Check /> אישור
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => resolve(m, a, "dismiss")}>
                        לא תודה
                      </Button>
                    </div>
                  ) : (
                    <p className="footnote mt-1 font-semibold text-muted">{a.status === "done" ? "✓ בוצע" : a.status === "dismissed" ? "בוטל" : "נכשל"}</p>
                  )}
                </div>
              ))}
              {m.links.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.links.map((l) => (
                    <Link key={l.href} href={l.href} className="rounded-full bg-fill px-3 py-1 text-[13px] font-medium text-primary">
                      {l.label} ‹
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-end">
            <div className="flex items-center gap-2 rounded-[1.25rem] border border-border bg-surface px-4 py-2.5 text-[15px] text-muted">
              <Loader2 className="size-4 animate-spin" /> בודק בנתונים של הבית…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-[calc(max(0.35rem,env(safe-area-inset-bottom))+74px)] z-30 px-3 lg:start-72 lg:bottom-6">
        <div className="mx-auto max-w-md lg:max-w-xl">
          {image && (
            <div className="mb-2 flex items-center gap-2">
              <SignedImage path={image} alt="תמונה לשליחה" className="size-14 rounded-xl border border-border" />
              <button type="button" onClick={() => setImage(null)} className="grid size-7 place-items-center rounded-full bg-fill" aria-label="הסרת התמונה">
                <X className="size-4" />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(draft);
            }}
            className="glass flex items-end gap-1.5 rounded-[1.6rem] p-1.5"
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => attach(e.target.files?.[0])} />
            <button type="button" disabled={!configured || uploading} onClick={() => fileRef.current?.click()} className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-fill text-foreground/80 disabled:opacity-40" aria-label="צירוף תמונה">
              {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(draft);
                }
              }}
              rows={1}
              placeholder={configured ? "לשאול את HomeOS…" : "העוזר עוד לא מחובר"}
              aria-label="הודעה לעוזר"
              disabled={!configured}
              maxLength={4000}
              className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-[17px] outline-none placeholder:text-muted"
            />
            {speech && configured && (
              <button type="button" onClick={toggleVoice} className={cn("pressable grid size-10 shrink-0 place-items-center rounded-full", listening ? "bg-danger text-white" : "bg-fill text-foreground/80")} aria-label={listening ? "עצירת הקלטה" : "דיבור"}>
                <Mic className="size-5" />
              </button>
            )}
            <button type="submit" disabled={!configured || sending || (!draft.trim() && !image)} aria-label="שליחה" className="pressable grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-30">
              <ArrowUp className="size-5" strokeWidth={2.75} />
            </button>
          </form>
        </div>
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen} title="שיחות קודמות" description="כל שיחה פרטית לך">
        <Panel>
          {conversations.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-4 py-2">
              <Link href={`/assistant?c=${c.id}`} onClick={() => setHistoryOpen(false)} className="min-w-0 flex-1 py-1.5">
                <span className="block truncate">{c.title || "שיחה"}</span>
                <span className="footnote block text-muted">{timeAgo(c.updated_at)}</span>
              </Link>
              <button
                type="button"
                aria-label="מחיקת שיחה"
                className="grid size-8 place-items-center rounded-full text-muted active:bg-fill"
                onClick={async () => {
                  const r = await deleteConversation(c.id);
                  if (!r.ok) return void toast.error(r.error);
                  setHistoryOpen(false);
                  router.push("/assistant?new=1");
                  router.refresh();
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </Panel>
      </Sheet>
    </>
  );
}
