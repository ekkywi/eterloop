-- CreateTable
CREATE TABLE "VirtualWallet" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 10000.0,
    "locked" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VirtualWallet_asset_key" ON "VirtualWallet"("asset");
