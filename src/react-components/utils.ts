const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatMessageTime(value?: string): string {
  if (!value) return '';
  return timeFormatter.format(new Date(value));
}

export function formatDayLabel(value?: string): string {
  if (!value) return '';
  return dateFormatter.format(new Date(value));
}

export function isSameDay(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}
