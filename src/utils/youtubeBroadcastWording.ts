import { escapeMarkdownV2 } from "./markdownV2Composer";
import { isSunday, formatMinskTime } from "./dateHelper";

export const PHOTO_ID =
  "AgACAgIAAxkBAAOyYlj-ys3nUbfITLexZ7zTwVcB5toAAkO4MRuYUclKFc7DAUhHXpoBAAMCAAN5AAMjBA";

const SUNDAY_VARIANTS: string[][] = [
  [
    "Наступил этот день воскресенья!",
    "Предавай все дела забвенью!",
    "Подключись, чтобы услышать слово!",
  ],
  [
    "Этот день нам Господь подарил!",
    "Возрадуемся вместе пред Ним!",
    "Подключайся к трансляции!",
  ],
  [
    "Пусть сегодня звучит молитва!",
    "Пусть сердце откроется Богу!",
    "Ждем каждого на богослужении!",
  ],
  [
    "Как хорошо быть вместе снова!",
    "Даже если нас разделяет расстояние.",
    "Подключайся к эфиру!",
  ],
  [
    "Любишь быть в Божьем доме?",
    "Сегодня встретимся в онлайн-трансляции!",
    "До начала осталось совсем немного!",
  ],
  [
    "Есть причина для настоящей радости!",
    "Господь вновь собирает Свою Церковь!",
    "Подключайся к трансляции!",
  ],
  [
    "Сделаем еще один шаг ближе к Господу.",
    "Через молитву, пение и Слово.",
    "Ждем каждого!",
  ],
  [
    "Велики наш Господь!",
    "Велики Его милости к нам!",
    "Присоединяйся к богослужению!",
  ],
  [
    "Наш Искупитель жив!",
    "И сегодня Он будет говорить через Свое Слово!",
    "Подключайся к трансляции!",
  ],
  [
    "Твердо будем уповать на Господа!",
    "Начнем этот день вместе с Ним!",
    "Ждем каждого!",
  ],
  [
    "Наш взгляд устремлен к вечности.",
    "Но сегодня Господь хочет говорить к нам здесь.",
    "Подключайся к трансляции!",
  ],
  [
    "Пусть хвала сегодня наполнит сердца!",
    "Вместе прославим Господа!",
    "Присоединяйся к трансляции!",
  ],
  [
    "Благословенно наше общение во Христе!",
    "Сегодня снова будем вместе!",
    "Подключайся к богослужению!",
  ],
  [
    "Господь продолжает говорить.",
    "Не пропусти Его призыв сегодня!",
    "Ждем каждого!",
  ],
  [
    "Все заботы оставь Господу.",
    "Остановись и послушай Его Слово.",
    "Подключайся!",
  ],
  [
    "Пусть сердце сегодня не тревожится.",
    "Господь рядом и готов укрепить тебя.",
    "Ждем каждого!",
  ],
  [
    "Искупитель жив!",
    "И сегодня мы вновь соберемся вокруг Его Слова!",
    "Подключайся!",
  ],
  [
    "Самый лучший путь — идти за Христом!",
    "Сделай этот шаг вместе с нами сегодня.",
    "Подключайся к трансляции!",
  ],
  [
    "Велика Божья верность!",
    "Каждое воскресенье Он собирает Свой народ.",
    "Ждем каждого",
  ],
  [
    "Милости Господа обновились этим утром!",
    "Время открыть сердце для Его Слова.",
    "Подключайся к трансляции!",
  ],
  [
    "Пусть Господь откроет наши сердца.",
    "Чтобы услышать Его голос сегодня.",
    "Ждем каждого на богослужении!",
  ],
];

const LINK_PREFIXES = [
  "Трансляция в",
  "Смотрите в",
  "Богослужение в",
  "Начало в",
];

const computeBroadcastVariantSeed = (
  youtubeId: string,
  scheduledStartTime: string,
): number => {
  const key = `${scheduledStartTime.slice(0, 10)}:${youtubeId}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0;
  }
  return h;
};

export const composeYouTubeBroadcastCaption = (
  youtubeId: string,
  title: string,
  scheduledStartTime: string,
  variantSeed?: number,
): string => {
  const dt = new Date(scheduledStartTime);
  const time = formatMinskTime(dt);
  const url = `https://youtu.be/${youtubeId}`;

  const seed =
    variantSeed ?? computeBroadcastVariantSeed(youtubeId, scheduledStartTime);

  const linkPrefix = LINK_PREFIXES[Math.floor(seed / 2) % LINK_PREFIXES.length];
  const linkText = `${linkPrefix} ${time}`;
  const escapedLinkText = escapeMarkdownV2(linkText);
  const markdownLink = `[${escapedLinkText}](${url})`;

  if (isSunday(dt)) {
    const lines = SUNDAY_VARIANTS[seed % SUNDAY_VARIANTS.length];
    const escaped = lines.map(escapeMarkdownV2);
    return [...escaped, "", markdownLink].join("\n");
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
