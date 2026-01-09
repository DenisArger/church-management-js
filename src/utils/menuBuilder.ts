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
    // { text: "📖 Писание", callback_data: "cmd:daily_scripture" }, // Disabled: functionality not needed
    { text: "📊 Опрос", callback_data: "cmd:create_poll" },
  ]);

  // Prayer category - unified menu
  buttons.push([
    { text: "🙏 Молитва за молодежь", callback_data: "menu:prayer" },
  ]);

  // Schedule category
  buttons.push([
    { text: "📆 Расписание", callback_data: "menu:schedule" },
    { text: "⛪ Готовность к воскресному служению", callback_data: "menu:sunday" },
  ]);

  return {
    inline_keyboard: buttons,
  };
}

/**
 * Builds prayer submenu with prayer-related commands
 */
export function buildPrayerMenu(): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[][] = [];

  // Prayer commands
  buttons.push([
    { text: "📅 Неделя молитвы", callback_data: "cmd:prayer_week" },
  ]);

  buttons.push([
    { text: "📋 Все молитвы", callback_data: "cmd:all_prayers" },
    { text: "⏰ Давно не молились", callback_data: "cmd:old_prayers" },
  ]);

  buttons.push([
    { text: "➕ Добавить молитву", callback_data: "cmd:add_prayer" },
  ]);

  // Back button
  buttons.push([
    { text: "⬅️ Назад", callback_data: "menu:main" },
  ]);

  return {
    inline_keyboard: buttons,
  };
}

/**
 * Builds schedule submenu with schedule-related commands
 */
export function buildScheduleMenu(): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[][] = [];

  // Schedule commands
  buttons.push([
    { text: "📅 Текущее расписание на неделю", callback_data: "cmd:weekly_schedule:select" },
  ]);

  buttons.push([
    { text: "📝 Редактировать расписание", callback_data: "cmd:edit_schedule" },
  ]);

  // Back button
  buttons.push([
    { text: "⬅️ Назад", callback_data: "menu:main" },
  ]);

  return {
    inline_keyboard: buttons,
  };
}

/**
 * Builds Sunday service submenu with Sunday service-related commands
 */
export function buildSundayMenu(): InlineKeyboardMarkup {
  const buttons: InlineKeyboardButton[][] = [];

  // Sunday service commands
  buttons.push([
    { text: "📊 Текущее состояние", callback_data: "cmd:request_state_sunday" },
  ]);

  buttons.push([
    { text: "✏️ Редактировать", callback_data: "cmd:fill_sunday_service" },
  ]);

  // Back button
  buttons.push([
    { text: "⬅️ Назад", callback_data: "menu:main" },
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
    const submenu = parts.length > 1 ? parts[1] : undefined;
    return { type, command: submenu };
  }

  return { type: "unknown" };
}

