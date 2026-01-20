import { isUserAuthorized, isYouthLeader, getUnauthorizedMessage } from "./authHelper";

jest.mock("../config/environment", () => ({
  getTelegramConfig: jest.fn(),
}));
jest.mock("../services/notionService", () => ({
  getYouthLeadersMapping: jest.fn(),
}));
jest.mock("./logger", () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}));

const getTelegramConfig = jest.requireMock<typeof import("../config/environment")>("../config/environment").getTelegramConfig;
const getYouthLeadersMapping = jest.requireMock<typeof import("../services/notionService")>("../services/notionService").getYouthLeadersMapping;

describe("authHelper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("isUserAuthorized", () => {
    it("returns false when allowedUsers is empty", () => {
      (getTelegramConfig as jest.Mock).mockReturnValue({ allowedUsers: [] });
      expect(isUserAuthorized(123)).toBe(false);
    });
    it("returns true when userId is in allowedUsers", () => {
      (getTelegramConfig as jest.Mock).mockReturnValue({ allowedUsers: [123] });
      expect(isUserAuthorized(123)).toBe(true);
    });
    it("returns false when userId is not in allowedUsers", () => {
      (getTelegramConfig as jest.Mock).mockReturnValue({ allowedUsers: [456] });
      expect(isUserAuthorized(123)).toBe(false);
    });
  });

  describe("isYouthLeader", () => {
    it("returns true when user is in mapping", async () => {
      (getYouthLeadersMapping as jest.Mock).mockResolvedValue(new Map([[123, "Leader"]]));
      expect(await isYouthLeader(123)).toBe(true);
    });
    it("returns false when user is not in mapping", async () => {
      (getYouthLeadersMapping as jest.Mock).mockResolvedValue(new Map());
      expect(await isYouthLeader(123)).toBe(false);
    });
    it("returns false on error", async () => {
      (getYouthLeadersMapping as jest.Mock).mockRejectedValue(new Error("err"));
      expect(await isYouthLeader(123)).toBe(false);
    });
  });

  describe("getUnauthorizedMessage", () => {
    it("returns non-empty string with access-related text", () => {
      const m = getUnauthorizedMessage();
      expect(m.length).toBeGreaterThan(0);
      expect(m).toMatch(/Доступ|доступ|ограничен|авторизован/i);
    });
  });
});
