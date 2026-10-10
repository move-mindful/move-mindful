import { emojiToUnicode, type ReactionOptions } from "stream-chat-react";

/**
 * The only reactions on offer, in this order — a short, encouraging set
 * rather than Stream's (which includes 😔 and 😮). `type` is the reaction as
 * Stream stores it, so renaming one orphans the reactions already given
 * with it.
 */
export const REACTION_LIST = [
  { type: "strong", emoji: "💪", name: "Flexed biceps" },
  { type: "fire", emoji: "🔥", name: "Fire" },
  { type: "raised_hands", emoji: "🙌", name: "Raised hands" },
  { type: "clap", emoji: "👏", name: "Clapping" },
  { type: "love", emoji: "❤️", name: "Heart" },
  { type: "haha", emoji: "😂", name: "Joy" },
] as const;

/** The same set in the shape Stream's own reaction picker (the message menu's) takes. */
export const REACTIONS: ReactionOptions = {
  quick: Object.fromEntries(
    REACTION_LIST.map(({ type, emoji, name }) => [
      type,
      { Component: () => emoji, name, unicode: emojiToUnicode(emoji) },
    ]),
  ),
};
