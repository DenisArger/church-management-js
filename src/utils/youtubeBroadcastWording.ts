import { escapeMarkdownV2 } from "./markdownV2Composer";
import { isSunday, formatMinskTime } from "./dateHelper";

export const PHOTO_ID =
  "AgACAgIAAxkBAAOyYlj-ys3nUbfITLexZ7zTwVcB5toAAkO4MRuYUclKFc7DAUhHXpoBAAMCAAN5AAMjBA";

export const composeYouTubeBroadcastCaption = (
  youtubeId: string,
  title: string,
  scheduledStartTime: string
): string => {
  const dt = new Date(scheduledStartTime);
  const time = formatMinskTime(dt);
  const url = `https://youtu.be/${youtubeId}`;

  const linkText = `Трансляция в ${time}`;
  const escapedLinkText = escapeMarkdownV2(linkText);
  const markdownLink = `[${escapedLinkText}](${url})`;

  if (isSunday(dt)) {
    const lines = [
      escapeMarkdownV2("Наступил этот день воскресенья!"),
      escapeMarkdownV2("Предавай все дела забвенью!"),
      escapeMarkdownV2("Подключись, чтобы услышать слово!"),
      "",
      markdownLink,
    ];
    return lines.join("\n");
  }

  const escapedTitle = escapeMarkdownV2(title);
  return `*${escapedTitle}*\n${markdownLink}`;
};

export const getBroadcastPhotoId = (): string => PHOTO_ID;

export const buildWatchButton = (youtubeId: string) => ({
  inline_keyboard: [
    [
      {
        text: "Смотреть...",
        url: `https://youtu.be/${youtubeId}`,
      },
    ],
  ],
});
