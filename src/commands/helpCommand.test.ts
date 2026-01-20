import { executeHelpCommand } from "./helpCommand";

jest.mock("../services/telegramService", () => ({
  sendMessage: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../utils/menuBuilder", () => ({
  buildMainMenu: jest.fn(() => ({ inline_keyboard: [[]] })),
}));
jest.mock("../utils/logger", () => ({ logInfo: jest.fn() }));

const sendMessage = jest.requireMock<typeof import("../services/telegramService")>("../services/telegramService").sendMessage;
const buildMainMenu = jest.requireMock<typeof import("../utils/menuBuilder")>("../utils/menuBuilder").buildMainMenu;

describe("helpCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls sendMessage with chatId, main menu text, reply_markup from buildMainMenu", async () => {
    await executeHelpCommand(111, 222);
    expect(buildMainMenu).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      222,
      expect.stringContaining("Главное меню"),
      expect.objectContaining({
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[]] },
      })
    );
  });
});
