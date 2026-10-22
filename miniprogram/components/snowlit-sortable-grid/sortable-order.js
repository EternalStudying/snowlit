function slotFromCoordinates(x, y, layout) {
  const column = Math.max(0, Math.min(layout.columns - 1, Math.floor((x - layout.left) / layout.cellWidth)));
  const row = Math.max(0, Math.floor((y - layout.top) / layout.cellHeight));
  return Math.max(0, Math.min(layout.count - 1, row * layout.columns + column));
}

function moveItem(items, from, to) {
  const result = items.slice();
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}

module.exports = { slotFromCoordinates, moveItem };
