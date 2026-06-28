/*
  Warnings:

  - You are about to drop the `master_players` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "master_players";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "player_universe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "bye" INTEGER,
    "dkAdp" REAL,
    "udAdp" REAL,
    "adpDelta" REAL,
    "fpRank" INTEGER,
    "avgAdp" REAL,
    "week15Opp" TEXT,
    "week15TeamTotal" REAL,
    "week15OU" REAL,
    "week16Opp" TEXT,
    "week16TeamTotal" REAL,
    "week16OU" REAL,
    "week17Opp" TEXT,
    "week17TeamTotal" REAL,
    "week17OU" REAL,
    "week18Opp" TEXT,
    "week18TeamTotal" REAL,
    "week18OU" REAL,
    "playoffTotalOU" REAL,
    "impliedTeamTotal" REAL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "player_universe_name_key" ON "player_universe"("name");

-- CreateIndex
CREATE INDEX "player_universe_team_idx" ON "player_universe"("team");
