export const cleanConfessionContent = (text: string): string => {
  // Remove URLs (http/https/www)
  let cleaned = text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '[Link đã bị xóa]');
  cleaned = cleaned.replace(/www\.[\S]+/g, '[Link đã bị xóa]');

  // Remove Phone Numbers (simple regex for 9-11 digits)
  // Matches sequences of digits that look like phone numbers
  cleaned = cleaned.replace(/\b\d{9,11}\b/g, '[SĐT đã bị xóa]');

  return cleaned;
};

export const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Generate a display ID (e.g. #0001)
export const formatConfessionId = (id: number): string => {
  return `#${id.toString().padStart(4, '0')}`;
};