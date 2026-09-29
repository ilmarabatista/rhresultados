-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'app',
    "orgName" TEXT NOT NULL DEFAULT 'RH Resultados',
    "orgDocument" TEXT,
    "orgContact" TEXT,
    "reportFooter" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

