/**
 * /chat while the server gets it ready: just the page's own frame (page.tsx),
 * empty. The only skeleton the chat shows is Stream's own, once its
 * components are on the page (chat-room.tsx) — this keeps the generic one in
 * (app)/loading.tsx from showing first.
 */
export default function Loading() {
  return <div role="status" aria-label="Loading the chat" className="fixed inset-0 z-30 bg-background md:static md:z-auto md:h-dvh" />;
}
