export interface YouTubeBroadcast {
  youtubeId: string;
  title: string;
  privacyStatus: "public" | "private" | "unlisted";
  scheduledStartTime: string;
}

export interface YouTubeBroadcastMailing {
  id: string;
  youtubeId: string;
  title: string;
  privacyStatus: string;
  scheduledStartTime: string;
  scheduledFor: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostDeletion {
  id: string;
  chatId: number;
  messageId: number;
  deleteAt: string;
  createdAt: string;
}
