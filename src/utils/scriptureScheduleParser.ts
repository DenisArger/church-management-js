import { logInfo, logWarn } from "./logger";
import { formatDateForNotion } from "./dateHelper";

/**
 * Parsed schedule entry with date, scripture reading, and readers for each stream
 */
export interface ParsedScheduleEntry {
  date: Date;
  scriptureReading: string;
  stream1Reader?: string; // may be empty
  stream2Reader?: string; // may be empty
}

/**
 * Russian month names in genitive case (for dates like "4 января")
 */
const RUSSIAN_MONTHS: Record<string, number> = {
  января: 0,
  февраля: 1,
  марта: 2,
  апреля: 3,
  мая: 4,
  июня: 5,
  июля: 6,
  августа: 7,
  сентября: 8,
  октября: 9,
  ноября: 10,
  декабря: 11,
};

/**
 * Parse Russian date string like "4 января", "11 января", "25 января"
 * Returns Date object or null if parsing fails
 */
export const parseRussianDate = (
  dateStr: string,
  year?: number
): Date | null => {
  if (!dateStr || !dateStr.trim()) {
    return null;
  }

  // Remove extra spaces and normalize
  const normalized = dateStr.trim().replace(/\s+/g, " ");

  // Try to match pattern: "DD месяца" or "D месяца"
  const dateMatch = normalized.match(/^(\d{1,2})\s+([а-яё]+)$/i);
  if (!dateMatch) {
    logWarn("Failed to parse date format", { dateStr, normalized });
    return null;
  }

  const day = parseInt(dateMatch[1], 10);
  const monthName = dateMatch[2].toLowerCase();

  const month = RUSSIAN_MONTHS[monthName];
  if (month === undefined) {
    logWarn("Unknown month name", { dateStr, monthName });
    return null;
  }

  // Use current year if not provided
  const targetYear = year || new Date().getFullYear();

  // Validate day
  if (day < 1 || day > 31) {
    logWarn("Invalid day", { dateStr, day });
    return null;
  }

  try {
    // Create date in local time using Date constructor
    // This creates date at midnight in local timezone
    const date = new Date(targetYear, month, day);
    // Explicitly set to start of day to ensure consistency
    date.setHours(0, 0, 0, 0);
    
    // Verify the date components match what we expect
    // Use local date methods to get actual values
    const actualYear = date.getFullYear();
    const actualMonth = date.getMonth();
    const actualDay = date.getDate();
    
    if (actualYear !== targetYear || actualMonth !== month || actualDay !== day) {
      logWarn("Invalid date - date components don't match", {
        dateStr,
        expectedDay: day,
        expectedMonth: month,
        expectedYear: targetYear,
        actualDay,
        actualMonth,
        actualYear,
      });
      return null;
    }
    
    // Log both formats for debugging
    const formattedDate = formatDateForNotion(date);
    logInfo("Parsed date successfully", {
      dateStr,
      formattedDate,
      dateISO: date.toISOString(),
      localComponents: {
        year: actualYear,
        month: actualMonth + 1,
        day: actualDay,
      },
    });
    
    return date;
  } catch (error) {
    logWarn("Error creating date", { dateStr, error });
    return null;
  }
};

/**
 * Check if text looks like a scripture schedule
 */
export const isScriptureSchedule = (text: string): boolean => {
  if (!text || text.trim().length === 0) {
    return false;
  }

  // Check for "График на" pattern
  const schedulePattern = /график\s+на\s+[а-яё]+/i;
  return schedulePattern.test(text);
};

/**
 * Parse scripture schedule from text
 * Expected format:
 * График на [месяц]:
 *
 * DD месяца - [текст чтения]
 * 1 поток: [имя]
 * 2 поток: [имя]
 */
export const parseScriptureSchedule = (
  text: string
): ParsedScheduleEntry[] => {
  if (!text || text.trim().length === 0) {
    logWarn("Empty text provided to parseScriptureSchedule");
    return [];
  }

  // Check if it's a schedule format
  if (!isScriptureSchedule(text)) {
    logWarn("Text does not match scripture schedule format", {
      textPreview: text.substring(0, 100),
    });
    return [];
  }

  const entries: ParsedScheduleEntry[] = [];
  const lines = text.split("\n").map((line) => line.trim());

  // Extract year from "График на [месяц]" if possible, otherwise use current year
  let currentYear = new Date().getFullYear();
  const yearMatch = text.match(/график\s+на\s+(\d{4})/i);
  if (yearMatch) {
    currentYear = parseInt(yearMatch[1], 10);
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines and header
    if (!line || line.match(/^график\s+на/i)) {
      i++;
      continue;
    }

    // Try to match date line: "DD месяца - [текст чтения]"
    const dateMatch = line.match(/^(\d{1,2}\s+[а-яё]+)\s*-\s*(.+)$/i);
    if (dateMatch) {
      const dateStr = dateMatch[1].trim();
      const scriptureReading = dateMatch[2].trim();

      // Parse date
      const date = parseRussianDate(dateStr, currentYear);
      if (!date) {
        logWarn("Failed to parse date from line", { line, dateStr });
        i++;
        continue;
      }

      // Look for stream information in following lines
      let stream1Reader: string | undefined;
      let stream2Reader: string | undefined;

      // Check next few lines for stream information
      const linesToCheck = lines.slice(i + 1, Math.min(i + 6, lines.length));
      logInfo("Checking lines for stream readers", {
        dateStr,
        linesToCheck,
        startIndex: i + 1,
        endIndex: Math.min(i + 6, lines.length),
      });

      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const streamLine = lines[j];

        // Match "1 поток: [имя]" or "1 поток:  [имя]" (with extra spaces)
        const stream1Match = streamLine.match(/^1\s+поток:\s*(.*)$/i);
        if (stream1Match) {
          const reader = stream1Match[1].trim();
          stream1Reader = reader.length > 0 ? reader : undefined;
          logInfo("Found stream 1 reader", {
            dateStr,
            line: streamLine,
            reader,
            stream1Reader,
          });
        }

        // Match "2 поток: [имя]" or "2 поток:  [имя]" (with extra spaces)
        const stream2Match = streamLine.match(/^2\s+поток:\s*(.*)$/i);
        if (stream2Match) {
          const reader = stream2Match[1].trim();
          stream2Reader = reader.length > 0 ? reader : undefined;
          logInfo("Found stream 2 reader", {
            dateStr,
            line: streamLine,
            reader,
            stream2Reader,
          });
        } else if (!stream1Match) {
          // Log if line looks like it might be a stream line but doesn't match
          // Only log if stream1Match also didn't match (to avoid duplicate logs)
          if (streamLine.match(/^[12]\s*поток/i)) {
            logInfo("Stream line found but didn't match pattern", {
              dateStr,
              line: streamLine,
              lineIndex: j,
            });
          }
        }

        // If we hit another date line (format: "DD месяца - ..."), stop looking
        // But don't stop on stream lines like "1 поток:" or "2 поток:"
        // Date line should have " - " separator after the date
        if (streamLine.match(/^\d{1,2}\s+[а-яё]+\s*-\s*/i)) {
          logInfo("Stopped checking lines - found another date", {
            dateStr,
            nextDateLine: streamLine,
            lineIndex: j,
          });
          break;
        }
      }
      
      // Log if readers were not found
      if (!stream1Reader && !stream2Reader) {
        logInfo("No stream readers found for date", {
          dateStr,
          checkedLines: lines.slice(i + 1, Math.min(i + 6, lines.length)),
        });
      } else if (!stream2Reader) {
        logInfo("Stream 2 reader not found for date", {
          dateStr,
          stream1Reader,
          checkedLines: lines.slice(i + 1, Math.min(i + 6, lines.length)),
        });
      }

      entries.push({
        date,
        scriptureReading,
        stream1Reader,
        stream2Reader,
      });

      // Format date for logging using local time
      logInfo("Parsed schedule entry", {
        date: formatDateForNotion(date),
        dateISO: date.toISOString(),
        scriptureReading,
        stream1Reader,
        stream2Reader,
      });
    }

    i++;
  }

  return entries;
};

/**
 * Find matching schedule entry for given date and stream
 * Compares dates with day precision (ignores time)
 * Returns entry if date matches, regardless of whether reader is specified
 */
export const findMatchingScheduleEntry = (
  schedule: ParsedScheduleEntry[],
  targetDate: Date,
  stream: "1" | "2"
): ParsedScheduleEntry | null => {
  if (!schedule || schedule.length === 0) {
    return null;
  }

  // Normalize target date to start of day
  const normalizedTarget = new Date(targetDate);
  normalizedTarget.setHours(0, 0, 0, 0);

  for (const entry of schedule) {
    // Normalize entry date to start of day
    const normalizedEntry = new Date(entry.date);
    normalizedEntry.setHours(0, 0, 0, 0);

    // Compare dates - return entry if date matches
    // Reader may be empty, but we still want to fill scripture reading
    if (normalizedEntry.getTime() === normalizedTarget.getTime()) {
      return entry;
    }
  }

  return null;
};

