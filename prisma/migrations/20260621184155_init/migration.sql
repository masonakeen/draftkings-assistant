-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contestName" TEXT NOT NULL,
    "entryFee" REAL NOT NULL,
    "draftedAt" DATETIME NOT NULL,
    "startingPick" INTEGER NOT NULL,
    "totalTeams" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'csv'
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rawName" TEXT,
    "team" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "draftedPick" INTEGER NOT NULL,
    "draftedRound" INTEGER NOT NULL,
    "adpAtDraft" REAL,
    "currentAdp" REAL,
    "draftId" TEXT NOT NULL,
    CONSTRAINT "players_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "drafts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "raw_imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "rawData" TEXT NOT NULL,
    "importType" TEXT NOT NULL DEFAULT 'dk_draft'
);

-- CreateTable
CREATE TABLE "master_players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "bye" INTEGER,
    "fpRank" INTEGER,
    "underdogAdp" REAL,
    "draftkingsAdp" REAL,
    "avgAdp" REAL,
    "adpDelta" REAL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "team_week_projections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "team" TEXT NOT NULL,
    "week15Opp" TEXT,
    "week15TeamTotal" REAL,
    "week15OU" REAL,
    "week16Opp" TEXT,
    "week16TeamTotal" REAL,
    "week16OU" REAL,
    "week17Opp" TEXT,
    "week17TeamTotal" REAL,
    "week17OU" REAL,
    "projectedPlayoffTotal" REAL,
    "week18Opp" TEXT,
    "week18TeamTotal" REAL,
    "week18OU" REAL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "positional_values" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playerName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "players_name_idx" ON "players"("name");

-- CreateIndex
CREATE UNIQUE INDEX "master_players_name_key" ON "master_players"("name");

-- CreateIndex
CREATE INDEX "master_players_team_idx" ON "master_players"("team");

-- CreateIndex
CREATE UNIQUE INDEX "team_week_projections_team_key" ON "team_week_projections"("team");

-- CreateIndex
CREATE UNIQUE INDEX "positional_values_playerName_position_key" ON "positional_values"("playerName", "position");
