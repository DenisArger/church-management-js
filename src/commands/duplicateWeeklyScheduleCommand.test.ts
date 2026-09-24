import { executeDuplicateWeeklyScheduleCommand } from './duplicateWeeklyScheduleCommand';
import { sendMessage } from '../services/telegramService';
import { getScheduleServicesForWeek, createScheduleService } from '../services/calendar/weeklySchedule';
import { CommandResult } from '../types';

// Mock external dependencies
jest.mock('../services/telegramService');
jest.mock('../services/calendar/weeklySchedule');

const mockedSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;
const mockedGetScheduleServicesForWeek = getScheduleServicesForWeek as jest.MockedFunction<typeof getScheduleServicesForWeek>;
const mockedCreateScheduleService = createScheduleService as jest.MockedFunction<typeof createScheduleService>;

describe('executeDuplicateWeeklyScheduleCommand', () => {
  const userId = 123;
  const chatId = 456;

  beforeEach(() => {
    // Reset mocks before each test
    mockedSendMessage.mockReset();
    mockedGetScheduleServicesForWeek.mockReset();
    mockedCreateScheduleService.mockReset();
  });

  it('should send a message if no services are found for the current week', async () => {
    mockedGetScheduleServicesForWeek.mockResolvedValueOnce([]);
    mockedSendMessage.mockResolvedValueOnce({ success: true } as CommandResult);

    const result = await executeDuplicateWeeklyScheduleCommand(userId, chatId);

    expect(result.success).toBe(true);
    expect(mockedGetScheduleServicesForWeek).toHaveBeenCalledWith('current');
    expect(mockedCreateScheduleService).not.toHaveBeenCalled();
    expect(mockedSendMessage).toHaveBeenCalledWith(
      chatId,
      '📭 В текущей неделе нет служений для копирования.',
      { parse_mode: 'HTML' }
    );
  });

  it('should duplicate services to the next week with all fields', async () => {
    const mockCurrentWeekServices = [
      {
        id: '1',
        title: 'Service 1',
        date: new Date('2026-10-05T10:00:00Z'),
        time: '10:00',
        type: 'Воскресное',
        description: 'Description 1',
        location: 'Location 1',
        needsMailing: true,
      },
      {
        id: '2',
        title: 'Service 2',
        date: new Date('2026-10-06T19:00:00Z'),
        time: '19:00',
        type: 'Молодежное',
        description: 'Description 2',
        location: 'Location 2',
        needsMailing: false,
      },
    ];

    mockedGetScheduleServicesForWeek.mockResolvedValueOnce(mockCurrentWeekServices);
    mockedCreateScheduleService.mockResolvedValue({ success: true } as CommandResult);
    mockedSendMessage.mockResolvedValueOnce({ success: true } as CommandResult);

    const result = await executeDuplicateWeeklyScheduleCommand(userId, chatId);

    expect(result.success).toBe(true);
    expect(mockedGetScheduleServicesForWeek).toHaveBeenCalledWith('current');
    expect(mockedCreateScheduleService).toHaveBeenCalledTimes(2);

    // Verify calls for Service 1
    const expectedDate1 = new Date('2026-10-12T10:00:00Z'); // +7 days
    expect(mockedCreateScheduleService).toHaveBeenCalledWith({
      title: 'Service 1',
      date: expectedDate1,
      time: '10:00',
      type: 'Воскресное',
      description: 'Description 1',
      location: 'Location 1',
      needsMailing: true,
    });

    // Verify calls for Service 2
    const expectedDate2 = new Date('2026-10-13T19:00:00Z'); // +7 days
    expect(mockedCreateScheduleService).toHaveBeenCalledWith({
      title: 'Service 2',
      date: expectedDate2,
      time: '19:00',
      type: 'Молодежное',
      description: 'Description 2',
      location: 'Location 2',
      needsMailing: false,
    });

    expect(mockedSendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('✅ <b>Копирование недели завершено</b>'),
      { parse_mode: 'HTML' }
    );
    expect(mockedSendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('✅ Создано: 2'),
      { parse_mode: 'HTML' }
    );
  });

  it('should handle partial failures during duplication', async () => {
    const mockCurrentWeekServices = [
      {
        id: '1',
        title: 'Service 1',
        date: new Date('2026-10-05T10:00:00Z'),
        time: '10:00',
        type: 'Воскресное',
        description: 'Description 1',
        location: 'Location 1',
        needsMailing: true,
      },
      {
        id: '2',
        title: 'Service 2',
        date: new Date('2026-10-06T19:00:00Z'),
        time: '19:00',
        type: 'Молодежное',
        description: 'Description 2',
        location: 'Location 2',
        needsMailing: false,
      },
    ];

    mockedGetScheduleServicesForWeek.mockResolvedValueOnce(mockCurrentWeekServices);
    mockedCreateScheduleService
      .mockResolvedValueOnce({ success: true } as CommandResult)
      .mockResolvedValueOnce({ success: false, error: 'Notion error' } as CommandResult);
    mockedSendMessage.mockResolvedValueOnce({ success: true } as CommandResult);

    const result = await executeDuplicateWeeklyScheduleCommand(userId, chatId);

    expect(result.success).toBe(true);
    expect(mockedGetScheduleServicesForWeek).toHaveBeenCalledWith('current');
    expect(mockedCreateScheduleService).toHaveBeenCalledTimes(2);
    expect(mockedSendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('✅ Создано: 1'),
      { parse_mode: 'HTML' }
    );
    expect(mockedSendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('❌ Ошибок: 1'),
      { parse_mode: 'HTML' }
    );
    expect(mockedSendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('⚠️ <b>Ошибки:</b>\nService 2: Notion error'),
      { parse_mode: 'HTML' }
    );
  });

  it('should return an error if getScheduleServicesForWeek fails', async () => {
    mockedGetScheduleServicesForWeek.mockRejectedValueOnce(new Error('Network error'));
    mockedSendMessage.mockResolvedValueOnce({ success: false, error: 'Network error' } as CommandResult);

    const result = await executeDuplicateWeeklyScheduleCommand(userId, chatId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error'); // Expect the error from the mock
    expect(mockedGetScheduleServicesForWeek).toHaveBeenCalledWith('current');
    expect(mockedCreateScheduleService).not.toHaveBeenCalled();
    expect(mockedSendMessage).not.toHaveBeenCalled();
  });

  it('should return an error if sendMessage fails at the end', async () => {
    const mockCurrentWeekServices = [
      {
        id: '1',
        title: 'Service 1',
        date: new Date('2026-10-05T10:00:00Z'),
        time: '10:00',
        type: 'Воскресное',
        description: 'Description 1',
        location: 'Location 1',
        needsMailing: true,
      },
    ];

    mockedGetScheduleServicesForWeek.mockResolvedValueOnce(mockCurrentWeekServices);
    mockedCreateScheduleService.mockResolvedValueOnce({ success: true } as CommandResult);
    // Mock sendMessage to return a CommandResult with an error
    mockedSendMessage.mockResolvedValueOnce({ success: false, error: 'Telegram API error' } as CommandResult);

    const result = await executeDuplicateWeeklyScheduleCommand(userId, chatId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Telegram API error');
  });
});