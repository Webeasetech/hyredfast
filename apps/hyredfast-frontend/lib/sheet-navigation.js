/**
 * Moving between cells with the keyboard.
 *
 * Cells are inputs scattered across one grid per job application, so "the cell
 * below" is not a sibling and cannot be reached by tree walking. Each input
 * carries a `data-cell` address instead and this resolves one by query — the
 * grid stays a layout, and a row moving between groups needs no bookkeeping.
 *
 * The order it walks is the order on screen: every group's rows top to bottom,
 * and within a row only the columns a user can type into. Company and role are
 * skipped because they are the group's, stated once in the header above.
 */

export const cellAddress = (rowId, column) => `${rowId}::${column}`;

/**
 * Focus one cell, putting the caret where arriving from that direction expects
 * it: at the end when stepping left, at the start when stepping right.
 */
function focusCell(rowId, column, caret) {
  if (!rowId || !column) return false;
  const el = document.querySelector(
    `[data-cell="${CSS.escape(cellAddress(rowId, column))}"]`,
  );
  if (!el) return false;

  el.focus();
  const at = caret === "start" ? 0 : el.value.length;
  try {
    el.setSelectionRange(at, at);
  } catch {
    // Not every input type supports a selection range; focus is the point.
  }
  return true;
}

/**
 * Move from (rowId, column) by a row and/or a column step.
 *
 * Stepping past the last column wraps to the first column of the next row, and
 * past the first wraps back to the last of the previous one, the way Tab does
 * in a spreadsheet. Running off either end of the sheet does nothing rather
 * than wrapping around, because there is no row there to type into.
 */
export function moveFocus({ rowIds, columns, rowId, column, rowStep = 0, columnStep = 0 }) {
  const rowIndex = rowIds.indexOf(rowId);
  const columnIndex = columns.indexOf(column);
  if (rowIndex === -1 || columnIndex === -1) return false;

  let nextRow = rowIndex + rowStep;
  let nextColumn = columnIndex + columnStep;

  if (nextColumn >= columns.length) {
    nextColumn = 0;
    nextRow += 1;
  } else if (nextColumn < 0) {
    nextColumn = columns.length - 1;
    nextRow -= 1;
  }

  if (nextRow < 0 || nextRow >= rowIds.length) return false;

  return focusCell(
    rowIds[nextRow],
    columns[nextColumn],
    columnStep < 0 ? "end" : "start",
  );
}
