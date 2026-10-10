import "stream-chat";

declare module "stream-chat" {
  // Stream leaves a channel's fields to the app. The room's name is what its
  // header shows (lib/chat/server.ts).
  interface CustomChannelData {
    name?: string;
  }
}
