-- CreateTable
CREATE TABLE "LuckyHitRound" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "result" TEXT,
    "settledAt" TIMESTAMP(3),
    "redTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "blackTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "luckyHitTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "betCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LuckyHitRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LuckyHitRound_period_key" ON "LuckyHitRound"("period");

-- CreateIndex
CREATE INDEX "LuckyHitRound_startedAt_idx" ON "LuckyHitRound"("startedAt");

-- CreateIndex
CREATE INDEX "LuckyHitRound_status_idx" ON "LuckyHitRound"("status");

-- CreateTable
CREATE TABLE "LuckyHitBet" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "walletSource" TEXT NOT NULL DEFAULT 'deposit',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payout" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "LuckyHitBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LuckyHitBet_userId_createdAt_idx" ON "LuckyHitBet"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LuckyHitBet_roundId_idx" ON "LuckyHitBet"("roundId");

-- AddForeignKey
ALTER TABLE "LuckyHitBet" ADD CONSTRAINT "LuckyHitBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "LuckyHitRound"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
