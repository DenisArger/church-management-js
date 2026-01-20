import { handler } from "./telegram-webhook";

jest.mock("../../src/handlers/messageHandler", () => ({
  handleUpdate: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock("../../src/config/environment", () => ({ validateEnvironment: jest.fn() }));
jest.mock("../../src/config/appConfigStore", () => ({
  ensureAppConfigLoaded: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../src/utils/logger", () => ({ logInfo: jest.fn(), logError: jest.fn() }));

const handleUpdate = jest.requireMock<typeof import("../../src/handlers/messageHandler")>("../../src/handlers/messageHandler").handleUpdate as jest.Mock;

const emptyContext = {} as any;

describe("telegram-webhook handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    handleUpdate.mockResolvedValue({ success: true });
  });

  it("OPTIONS -> 200, CORS headers", async () => {
    const r = await handler(
      {
        httpMethod: "OPTIONS",
        body: null,
        headers: {},
        isBase64Encoded: false,
        path: "/",
        pathParameters: null,
        queryStringParameters: null,
        stageVariables: null,
        requestContext: {} as never,
        rawUrl: "",
        rawQuery: "",
      } as any,
      emptyContext
    );
    expect(r!.statusCode).toBe(200);
    expect(r!.headers).toMatchObject({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
  });

  it("POST with empty body -> 200, handleUpdate called with {}", async () => {
    const r = await handler(
      {
        httpMethod: "POST",
        body: null,
        headers: {},
        isBase64Encoded: false,
        path: "/",
        pathParameters: null,
        queryStringParameters: null,
        stageVariables: null,
        requestContext: {} as never,
        rawUrl: "",
        rawQuery: "",
      } as any,
      emptyContext
    );
    expect(r!.statusCode).toBe(200);
    expect(handleUpdate).toHaveBeenCalledWith({});
  });

  it("POST with valid update -> 200, body status OK", async () => {
    const update = { update_id: 1, message: { text: "/help", from: { id: 1, first_name: "U" }, chat: { id: 2 }, message_id: 1, date: 1 } };
    handleUpdate.mockResolvedValue({ success: true });
    const r = await handler(
      {
        httpMethod: "POST",
        body: JSON.stringify(update),
        headers: {},
        isBase64Encoded: false,
        path: "/",
        pathParameters: null,
        queryStringParameters: null,
        stageVariables: null,
        requestContext: {} as never,
        rawUrl: "",
        rawQuery: "",
      } as any,
      emptyContext
    );
    expect(r!.statusCode).toBe(200);
    expect(handleUpdate).toHaveBeenCalledWith(update);
    const body = JSON.parse((r as any).body || "{}");
    expect(body.status).toBe("OK");
    expect(body.result).toBe("success");
  });
});
