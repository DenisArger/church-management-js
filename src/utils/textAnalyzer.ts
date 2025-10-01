export const extractPrayerKeywords = (text: string): string[] => {
  const prayerKeywords = [
    "молитва",
    "молиться",
    "помолиться",
    "просить",
    "просьба",
    "нужда",
    "проблема",
    "болезнь",
    "здоровье",
    "семья",
    "работа",
    "учеба",
    "путешествие",
    "безопасность",
    "мир",
    "благословение",
    "помощь",
    "поддержка",
    "силы",
    "мудрость",
  ];

  const words = text.toLowerCase().split(/\s+/);
  return prayerKeywords.filter((keyword) =>
    words.some((word) => word.includes(keyword))
  );
};

export const categorizePrayerNeed = (text: string): string => {
  const categories = {
    здоровье: ["болезнь", "здоровье", "лечение", "врач", "больница"],
    семья: ["семья", "дети", "родители", "муж", "жена", "брак"],
    работа: ["работа", "карьера", "деньги", "финансы", "бизнес"],
    духовность: ["вера", "духовность", "церковь", "служение", "миссия"],
    путешествие: ["путешествие", "поездка", "дорога", "безопасность"],
    общее: ["общее", "разное", "прочее"],
  };

  const textLower = text.toLowerCase();

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((keyword) => textLower.includes(keyword))) {
      return category;
    }
  }

  return "общее";
};

export const isPrayerRequest = (text: string): boolean => {
  const prayerIndicators = [
    "молитесь",
    "помолитесь",
    "молитва",
    "просьба",
    "нужда",
    "помогите",
    "поддержите",
    "благословите",
  ];

  const textLower = text.toLowerCase();
  return prayerIndicators.some((indicator) => textLower.includes(indicator));
};
