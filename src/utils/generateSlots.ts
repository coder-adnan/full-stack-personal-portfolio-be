function generateSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  let [startHour, startMin] = start.split(":").map(Number);
  let [endHour, endMin] = end.split(":").map(Number);

  let current = new Date(0, 0, 0, startHour, startMin);
  const endTime = new Date(0, 0, 0, endHour, endMin);

  while (current <= endTime) {
    slots.push(current.toTimeString().slice(0, 5));
    current.setMinutes(current.getMinutes() + 30);
  }
  return slots;
}

export default generateSlots;
