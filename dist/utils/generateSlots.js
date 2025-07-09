"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function generateSlots(start, end) {
    const slots = [];
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
exports.default = generateSlots;
