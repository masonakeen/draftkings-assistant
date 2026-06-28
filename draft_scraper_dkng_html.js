// Find the active user's draft column
const myColumn = document
  .querySelector('.UserPickSummaryCard_is-active-user')
  ?.closest('.DraftBoardColumn_draft-board-column');

if (!myColumn) {
  throw new Error("Could not find active user's draft column");
}

// Generate unique draft ID
const draftId =
  `${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-` +
  Math.random().toString(36).substring(2, 8);

// Extract roster breakdown (QB/RB/WR/TE counts)
const rosterCounts = {};

myColumn
  .querySelectorAll('.UserPickSummaryCard_position-summary-group > div')
  .forEach(posDiv => {
    const pos = posDiv.children[0]?.textContent.trim();
    const count = Number(posDiv.children[1]?.textContent.trim());

    if (pos) {
      rosterCounts[pos] = count;
    }
  });

// Extract all drafted players
const players = [...myColumn.querySelectorAll('.CellBase_draft-cell')]
  .map((cell, index) => {
    const teamDivs = cell.querySelectorAll('.PlayerCell_team');

    const byeText = teamDivs[1]?.textContent || "";
    const byeWeek = byeText.match(/BYE\s+(\d+)/i)?.[1] ?? null;

    return {
      playerId: `${draftId}-${String(index + 1).padStart(3, "0")}`,
      roundPick: cell
        .querySelector('.CellHeader_header > div > div')
        ?.textContent.trim(),
      pick: Number(
        cell.querySelector('.CellHeader_pick-number')
          ?.textContent.trim()
      ),
      player: cell
        .querySelector('.PlayerCell_player-name-text')
        ?.textContent.trim(),
      position: cell
        .querySelector('.PlayerCell_position-and-team > div')
        ?.textContent.trim(),
      team: teamDivs[0]?.textContent.trim(),
      byeWeek: byeWeek ? Number(byeWeek) : null
    };
  });

// Build final output object
const result = {
  draftId,
  draftDate: new Date().toISOString(),
  site: "DraftKings",
  username:
    myColumn
      .querySelector('.UserPickSummaryCard_summary-card span')
      ?.textContent.trim() || "unknown",
  rosterBreakdown: rosterCounts,
  totalPlayers: players.length,
  players
};

// Copy formatted JSON to clipboard
copy(JSON.stringify(result, null, 2));

console.log(
  `Copied ${players.length} players for ${result.username} (${draftId}) to clipboard`
);

// Return object for inspection in console
result;