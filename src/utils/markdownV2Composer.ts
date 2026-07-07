export const escapeMarkdownV2 = (text: string): string => {
  const characters = [
    "_", "*", "[", "]", "(", ")", "~", "`",
    ">", "#", "+", "-", "=", "|", "{", "}", ".", "!",
  ];
  let escaped = text;
  for (const c of characters) {
    escaped = escaped.split(c).join(`\\${c}`);
  }
  return escaped;
};

