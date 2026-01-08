// Types for inline keyboard
interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
}

interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

/**
 * Builds main menu with inline buttons organized by categories
 */
export function buildMainMenu(): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[][] = [];

  // Main commands category
  buttons.push([
    { text: "📋 Молитвы", callback_data: "cmd:request_pray" },
    { text: "📖 Писание", callback_data: "cmd:daily_scripture" },
    { text: "📊 Опрос", callback_data: "cmd:create_poll" },
  ]);

  // Prayer category
  buttons.push([
    { text: "➕ Добавить молитву", callback_data: "cmd:add_prayer" },
    { text: "📅 Неделя молитв", callback_data: "cmd:prayer_week" },
  ]);

  // Schedule category
  buttons.push([
    { text: "📆 Неделя", callback_data: "cmd:weekly_schedule" },
    { text: "⛪ Воскресенье", callback_data: "cmd:request_state_sunday" },
  ]);
  buttons.push([
    { text: "✏️ Заполнить воскресное", callback_data: "cmd:fill_sunday_service" },
  ]);

  // Polls category
  buttons.push([
    { text: "👥 Молодежь", callback_data: "cmd:youth_poll" },
  ]);

  // Service category
  buttons.push([
    { text: "🔧 Тест Notion", callback_data: "cmd:test_notion" },
    { text: "🗓️ Календарь", callback_data: "cmd:debug_calendar" },
  ]);

  // Menu refresh button
  buttons.push([
    { text: "🔄 Обновить меню", callback_data: "menu:main" },
  ]);

  return {
    inline_keyboard: buttons,
  };
}

/**
 * Parses callback data to extract command and parameters
 */
export function parseCallbackData(
  callbackData: string
): { type: string; command?: string; params?: string[] } {
  const parts = callbackData.split(":");
  const type = parts[0];

  if (type === "cmd" && parts.length > 1) {
    const command = parts[1];
    const params = parts.slice(2);
    return { type, command, params };
  }

  if (type === "menu") {
    return { type };
  }

  return { type: "unknown" };
}

