"use client";

import { useState, type ComponentType, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Copy, MessageCircle, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { useMessageComposerController, useMessageContext, useUserRole } from "stream-chat-react";
import { BottomSheet } from "@/components/bottom-sheet";
import { REACTION_LIST } from "@/components/chat/reactions";

/**
 * What holding a message down opens on a phone, as in Ladder: the six
 * reactions along the top, then Reply in thread, Copy message, and — as
 * Stream allows this person — Edit and Delete (your own; a trainer can delete
 * anyone's) and Report (someone else's). Desktop has the hover menu instead.
 *
 * Rendered into the signed-in shell rather than inside the message list, so
 * it covers the screen and still takes the site's dark mode.
 */
export function MessageSheet({ onClose }: { onClose: () => void }) {
  const { message, threadList, handleReaction, handleOpenThread, handleDelete, handleFlag, isMyMessage } =
    useMessageContext("MessageSheet");
  const { canReact, canReply, canEdit, canDelete, canFlag } = useUserRole(message);
  const composer = useMessageComposerController();
  const [step, setStep] = useState<"menu" | "delete" | "reported">("menu");
  const mine = new Set((message.own_reactions ?? []).map((r) => r.type));

  const shell = typeof document === "undefined" ? null : document.querySelector("[data-app-shell]");
  if (!shell) return null;

  const close = (then?: () => void) => () => {
    then?.();
    onClose();
  };

  return createPortal(
    <BottomSheet onClose={onClose} label="Message options">
      {step === "menu" && (
        <>
          {canReact && (
            <div className="grid grid-cols-6 gap-1 px-1 pt-1 pb-3">
              {REACTION_LIST.map((r) => (
                <button
                  key={r.type}
                  type="button"
                  aria-label={r.name}
                  aria-pressed={mine.has(r.type)}
                  onClick={(e: MouseEvent<HTMLButtonElement>) => {
                    void handleReaction(r.type, e);
                    onClose();
                  }}
                  className={`flex aspect-square items-center justify-center rounded-2xl text-[30px] active:bg-black/5 dark:active:bg-white/10 ${
                    mine.has(r.type) ? "bg-violet-500/15" : ""
                  }`}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
          <div className="border-t border-black/[0.08] pt-2 dark:border-white/10">
            {canReply && !threadList && (
              <Row icon={MessageCircle} onClick={(e) => {
                handleOpenThread(e);
                onClose();
              }}>
                Reply in thread
              </Row>
            )}
            {message.text && (
              <Row icon={Copy} onClick={close(() => void navigator.clipboard?.writeText(message.text ?? ""))}>
                Copy message
              </Row>
            )}
            {canEdit && (
              <Row icon={Pencil} onClick={close(() => composer.initState({ composition: message }))}>
                Edit message
              </Row>
            )}
            {canDelete && (
              <Row icon={Trash2} danger onClick={() => setStep("delete")}>
                Delete message
              </Row>
            )}
            {canFlag && !isMyMessage() && (
              <Row
                icon={TriangleAlert}
                danger
                onClick={(e) => {
                  void Promise.resolve(handleFlag(e)).then(() => setStep("reported"));
                }}
              >
                Report
              </Row>
            )}
          </div>
        </>
      )}

      {step === "delete" && (
        <div className="px-2 pt-1">
          <p className="px-2 pb-3 text-base font-semibold">Delete this message?</p>
          <Row icon={Trash2} danger onClick={close(() => void handleDelete())}>
            Delete
          </Row>
          <Row onClick={() => setStep("menu")}>Cancel</Row>
        </div>
      )}

      {step === "reported" && (
        <div className="px-2 pt-1">
          <p className="px-2 pb-3 text-base">Thanks for letting us know. We&rsquo;ll take a look.</p>
          <Row onClick={onClose}>Done</Row>
        </div>
      )}
    </BottomSheet>,
    shell,
  );
}

/** A row as in the More menu's sheet (more-menu.tsx). */
function Row({
  icon: Icon,
  danger = false,
  onClick,
  children,
}: {
  icon?: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" }>;
  danger?: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[52px] w-full items-center gap-3.5 rounded-[10px] px-4 text-left text-base transition-colors active:bg-black/5 dark:active:bg-white/10 ${
        danger ? "text-red-600 dark:text-red-400" : ""
      }`}
    >
      {Icon && <Icon size={22} className="shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
