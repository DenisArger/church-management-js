import { SundayServiceState, SundayServiceFormData } from "../types";

// Types for inline keyboard
interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

// Predefined preachers from Notion database
// First page
const PREDEFINED_PREACHERS_PAGE1 = [
  "Антон Кириенко",
  "Денис Аргер",
  "Алексей Сорокин",
  "Николай Степанов",
  "Дмитрий Ширко",
];

// Second page
const PREDEFINED_PREACHERS_PAGE2 = [
  "Андрей Седюко",
  "Слава Кизин",
  "Дмитрий Атрошенко",
];

// Worship services will be loaded from Notion database

/**
 * Build keyboard for mode selection (create/edit)
 */
export const buildModeKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [
        { text: "➕ Создать новое", callback_data: "sunday:mode:create" },
        { text: "✏️ Редактировать", callback_data: "sunday:mode:edit" },
      ],
      [{ text: "❌ Отмена", callback_data: "sunday:cancel" }],
    ],
  };
};

/**
 * Build keyboard for stream selection
 */
export const buildStreamKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [
        { text: "I поток", callback_data: "sunday:stream:1" },
        { text: "II поток", callback_data: "sunday:stream:2" },
      ],
      [{ text: "Оба потока", callback_data: "sunday:stream:both" }],
      [{ text: "❌ Отмена", callback_data: "sunday:cancel" }],
    ],
  };
};

/**
 * Build keyboard for date selection (for create mode)
 */
export const buildDateKeyboard = (): InlineKeyboardMarkup => {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntilSunday = currentDay === 0 ? 7 : 7 - currentDay;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);

  const followingSunday = new Date(nextSunday);
  followingSunday.setDate(nextSunday.getDate() + 7);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  return {
    inline_keyboard: [
      [
        {
          text: `📅 ${formatDate(nextSunday)}`,
          callback_data: `sunday:date:${nextSunday.toISOString().split("T")[0]}`,
        },
        {
          text: `📅 ${formatDate(followingSunday)}`,
          callback_data: `sunday:date:${followingSunday.toISOString().split("T")[0]}`,
        },
      ],
      [{ text: "❌ Отмена", callback_data: "sunday:cancel" }],
    ],
  };
};

/**
 * Build keyboard for preachers selection (multi-select) with pagination
 */
export const buildPreachersKeyboard = (
  selectedPreachers: string[] = [],
  page: number = 1
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Get preachers for current page
  const preachersForPage = page === 1 ? PREDEFINED_PREACHERS_PAGE1 : PREDEFINED_PREACHERS_PAGE2;
  const hasNextPage = page === 1 && PREDEFINED_PREACHERS_PAGE2.length > 0;
  const hasPrevPage = page === 2;

  // Add predefined preachers for current page
  const preacherButtons: InlineKeyboardButton[] = [];
  preachersForPage.forEach((preacher) => {
    const isSelected = selectedPreachers.includes(preacher);
    preacherButtons.push({
      text: isSelected ? `✅ ${preacher}` : preacher,
      callback_data: `sunday:field:preacher:${preacher}`,
    });
  });

  // Split into rows of 2
  for (let i = 0; i < preacherButtons.length; i += 2) {
    buttons.push(preacherButtons.slice(i, i + 2));
  }

  // Add pagination buttons if needed
  const paginationRow: InlineKeyboardButton[] = [];
  if (hasPrevPage) {
    paginationRow.push({
      text: "◀️ Назад",
      callback_data: "sunday:field:preachers:page:1",
    });
  }
  if (hasNextPage) {
    paginationRow.push({
      text: "Вперед ▶️",
      callback_data: "sunday:field:preachers:page:2",
    });
  }
  if (paginationRow.length > 0) {
    buttons.push(paginationRow);
  }

  // Add "Add custom" button
  buttons.push([
    { text: "➕ Добавить свой", callback_data: "sunday:field:preacher:custom" },
  ]);
  
  // Add action buttons
  buttons.push([
    { text: "✅ Готово", callback_data: "sunday:field:preachers:done" },
    { text: "❌ Отмена", callback_data: "sunday:cancel" },
  ]);

  return { inline_keyboard: buttons };
};

/**
 * Build keyboard for worship service selection
 * Uses index instead of full name to avoid callback_data length limit (64 bytes)
 */
export const buildWorshipServiceKeyboard = (
  worshipServices: string[] = []
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Add worship services from database
  if (worshipServices.length > 0) {
    worshipServices.forEach((service, index) => {
      // Use index instead of full service name to avoid callback_data length limit
      buttons.push([
        {
          text: service,
          callback_data: `sunday:field:worshipService:idx:${index}`,
        },
      ]);
    });
  } else {
    // Fallback if no services loaded
    buttons.push([
      {
        text: "Загрузка...",
        callback_data: "sunday:field:worshipService:loading",
      },
    ]);
  }

  buttons.push([
    { text: "➕ Добавить свой", callback_data: "sunday:field:worshipService:custom" },
  ]);
  buttons.push([
    { text: "❌ Отмена", callback_data: "sunday:cancel" },
  ]);

  return { inline_keyboard: buttons };
};

/**
 * Build keyboard for yes/no selection
 */
export const buildYesNoKeyboard = (
  fieldName: string,
  currentValue?: boolean
): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [
        {
          text: currentValue === true ? "✅ Да" : "Да",
          callback_data: `sunday:field:${fieldName}:true`,
        },
        {
          text: currentValue === false ? "✅ Нет" : "Нет",
          callback_data: `sunday:field:${fieldName}:false`,
        },
      ],
      [{ text: "❌ Отмена", callback_data: "sunday:cancel" }],
    ],
  };
};

/**
 * Build keyboard for number selection (1-10)
 */
export const buildNumberKeyboard = (
  fieldName: string,
  currentValue?: number | null
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Numbers 1-10 in rows of 3
  for (let i = 1; i <= 10; i += 3) {
    const row: InlineKeyboardButton[] = [];
    for (let j = i; j < i + 3 && j <= 10; j++) {
      row.push({
        text: currentValue === j ? `✅ ${j}` : `${j}`,
        callback_data: `sunday:field:${fieldName}:${j}`,
      });
    }
    buttons.push(row);
  }

  buttons.push([
    { text: "➕ Другое", callback_data: `sunday:field:${fieldName}:custom` },
  ]);
  buttons.push([
    { text: "❌ Отмена", callback_data: "sunday:cancel" },
  ]);

  return { inline_keyboard: buttons };
};

/**
 * Build keyboard for scripture reader selection
 * Uses index instead of full name to avoid callback_data length limit (64 bytes)
 */
export const buildScriptureReaderKeyboard = (
  scriptureReaders: string[] = []
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  // Add scripture readers from database
  if (scriptureReaders.length > 0) {
    scriptureReaders.forEach((reader, index) => {
      // Use index instead of full reader name to avoid callback_data length limit
      buttons.push([
        {
          text: reader,
          callback_data: `sunday:field:scriptureReader:idx:${index}`,
        },
      ]);
    });
  } else {
    // Fallback if no readers loaded
    buttons.push([
      {
        text: "Загрузка...",
        callback_data: "sunday:field:scriptureReader:loading",
      },
    ]);
  }

  buttons.push([
    { text: "➕ Добавить свой", callback_data: "sunday:field:scriptureReader:custom" },
  ]);
  buttons.push([
    { text: "❌ Отмена", callback_data: "sunday:cancel" },
  ]);

  return { inline_keyboard: buttons };
};

/**
 * Build keyboard for review and confirmation
 */
export const buildReviewKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [{ text: "✅ Сохранить", callback_data: "sunday:confirm" }],
      [
        { text: "✏️ Изменить", callback_data: "sunday:edit" },
        { text: "❌ Отмена", callback_data: "sunday:cancel" },
      ],
    ],
  };
};

/**
 * Build keyboard with edit buttons and save/cancel
 */
export const buildEditAndSaveKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [{ text: "✅ Сохранить", callback_data: "sunday:confirm" }],
      [
        { text: "✏️ Изменить", callback_data: "sunday:edit" },
        { text: "❌ Отмена", callback_data: "sunday:cancel" },
      ],
    ],
  };
};

/**
 * Build keyboard for field selection during edit
 */
export const buildEditFieldKeyboard = (
  _data: SundayServiceFormData
): InlineKeyboardMarkup => {
  const buttons: InlineKeyboardButton[][] = [];

  buttons.push([
    { text: "📝 Название", callback_data: "sunday:edit:title" },
    { text: "👤 Проповедники", callback_data: "sunday:edit:preachers" },
  ]);
  buttons.push([
    { text: "🎵 Прославление", callback_data: "sunday:edit:worshipService" },
    { text: "🎶 Песня перед началом", callback_data: "sunday:edit:songBeforeStart" },
  ]);
  buttons.push([
    { text: "🔢 Количество песен", callback_data: "sunday:edit:numWorshipSongs" },
    { text: "🎤 Песня группы", callback_data: "sunday:edit:soloSong" },
  ]);
  buttons.push([
    { text: "💒 Песня на покаяние", callback_data: "sunday:edit:repentanceSong" },
    { text: "📖 Чтение Писания", callback_data: "sunday:edit:scriptureReading" },
  ]);
  buttons.push([
    { text: "👨‍💼 Чтец Писания", callback_data: "sunday:edit:scriptureReader" },
  ]);
  buttons.push([
    { text: "✅ Сохранить", callback_data: "sunday:confirm" },
    { text: "❌ Отмена", callback_data: "sunday:cancel" },
  ]);

  return { inline_keyboard: buttons };
};

/**
 * Build keyboard with "Continue editing" button after successful save
 */
export const buildContinueEditingKeyboard = (): InlineKeyboardMarkup => {
  return {
    inline_keyboard: [
      [{ text: "✏️ Продолжить редактирование", callback_data: "sunday:continue_edit" }],
    ],
  };
};

/**
 * Format preview message for review
 */
export const formatPreviewMessage = (
  state: SundayServiceState
): string => {
  const { data } = state;
  let message = "📋 <b>Предпросмотр данных</b>\n\n";

  if (data.stream === "both") {
    // Show both streams - always show both, even if one is not filled yet
    // Priority: if we're currently working on a stream, use current data (it's more up-to-date)
    // Otherwise, use saved data if available
    
    // Extract only stream-specific fields from data (exclude metadata)
    const extractStreamFields = (source: Partial<SundayServiceFormData>): Partial<SundayServiceFormData> => {
      return {
        date: source.date,
        title: source.title,
        preachers: source.preachers,
        worshipService: source.worshipService,
        songBeforeStart: source.songBeforeStart,
        numWorshipSongs: source.numWorshipSongs,
        soloSong: source.soloSong,
        repentanceSong: source.repentanceSong,
        scriptureReading: source.scriptureReading,
        scriptureReader: source.scriptureReader,
      };
    };
    
    // For stream 1: prioritize current data if we're working on stream 1, otherwise use saved data
    let stream1Data: Partial<SundayServiceFormData> | undefined;
    if (data.currentStream === "1") {
      stream1Data = extractStreamFields(data);
    } else {
      stream1Data = data.stream1Data;
    }
    
    message += "<u>I поток</u>\n";
    if (stream1Data) {
      message += formatStreamPreview(stream1Data, "1");
    } else {
      // Show empty preview for stream 1 if not filled yet
      message += formatStreamPreview({ date: data.date }, "1");
    }
    message += "\n";
    
    // For stream 2: prioritize current data if we're working on stream 2, otherwise use saved data
    let stream2Data: Partial<SundayServiceFormData> | undefined;
    if (data.currentStream === "2") {
      stream2Data = extractStreamFields(data);
    } else {
      stream2Data = data.stream2Data;
    }
    
    message += "<u>II поток</u>\n";
    if (stream2Data) {
      message += formatStreamPreview(stream2Data, "2");
    } else {
      // Show empty preview for stream 2 if not filled yet
      message += formatStreamPreview({ date: data.date }, "2");
    }
  } else {
    // Show single stream
    const stream = data.stream as "1" | "2" | undefined;
    if (stream) {
      const streamName = stream === "1" ? "I поток" : "II поток";
      message += `<u>${streamName}</u>\n`;
      message += formatStreamPreview(data, stream);
    }
  }

  return message;
};

/**
 * Format preview for a single stream
 */
const formatStreamPreview = (
  data: Partial<SundayServiceFormData>,
  _stream: "1" | "2"
): string => {
  let preview = "";

  preview += `📅 <b>Дата:</b> ${data.date ? new Date(data.date).toLocaleDateString("ru-RU") : "не указана"}\n`;
  preview += `📝 <b>Название:</b> ${data.title || "не указано"}\n`;
  preview += `👤 <b>Проповедники:</b> ${data.preachers && data.preachers.length > 0 ? data.preachers.join(", ") : "не указаны"}\n`;
  preview += `🎵 <b>Прославление:</b> ${data.worshipService || "не указано"}\n`;
  preview += `🎶 <b>Песня перед началом:</b> ${data.songBeforeStart !== undefined ? (data.songBeforeStart ? "есть" : "нет") : "не указано"}\n`;
  preview += `🔢 <b>Количество песен:</b> ${data.numWorshipSongs !== null && data.numWorshipSongs !== undefined ? data.numWorshipSongs : "не указано"}\n`;
  preview += `🎤 <b>Песня группы:</b> ${data.soloSong !== undefined ? (data.soloSong ? "есть" : "нет") : "не указано"}\n`;
  preview += `💒 <b>Песня на покаяние:</b> ${data.repentanceSong !== undefined ? (data.repentanceSong ? "есть" : "нет") : "не указано"}\n`;
  preview += `📖 <b>Чтение Писания:</b> ${data.scriptureReading || "не указано"}\n`;
  preview += `👨‍💼 <b>Чтец Писания:</b> ${data.scriptureReader || "не указано"}\n`;

  return preview;
};

/**
 * Get message text for current step
 */
export const getStepMessage = (
  step: string,
  data: SundayServiceFormData
): string => {
  switch (step) {
    case "mode":
      return "Выберите действие:";
    case "date":
      return "Выберите дату служения:";
    case "stream":
      return "Выберите поток:";
    case "title":
      return "Введите название служения:";
    case "preachers":
      return "Выберите проповедников (можно несколько):";
    case "worshipService":
      return "Выберите музыкальное служение:";
    case "songBeforeStart":
      return "Будет ли песня перед началом?";
    case "numWorshipSongs":
      return "Количество песен на прославлении:";
    case "soloSong":
      return "Будет ли песня группы?";
    case "repentanceSong":
      return "Будет ли песня на покаяние?";
    case "scriptureReading":
      return "Введите чтение Писания (например, 'Иоанна 3:16'):";
    case "scriptureReader":
      return "Выберите чтеца Писания:";
    case "review":
      return formatPreviewMessage({
        userId: 0,
        chatId: 0,
        step: "review",
        data,
      });
    default:
      return "Продолжаем заполнение...";
  }
};

/**
 * Validate form data before saving
 */
export const validateFormData = (
  data: SundayServiceFormData,
  stream?: "1" | "2"
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const streamData =
    data.stream === "both" && stream
      ? stream === "1"
        ? data.stream1Data
        : data.stream2Data
      : data;

  if (!data.date) {
    errors.push("Не указана дата служения");
  }

  if (!streamData) {
    errors.push("Данные потока не заполнены");
    return { valid: false, errors };
  }

  // Title is optional - will be auto-generated if not provided
  // if (!streamData.title || streamData.title.trim() === "") {
  //   errors.push("Не указано название служения");
  // }

  if (!streamData.preachers || streamData.preachers.length === 0) {
    errors.push("Не указаны проповедники");
  }

  if (!streamData.worshipService || streamData.worshipService.trim() === "") {
    errors.push("Не указано музыкальное служение");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

