/*
  Warnings:

  - You are about to drop the column `fim` on the `administrativo` table. All the data in the column will be lost.
  - You are about to drop the column `inicio` on the `administrativo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "administrativo" DROP COLUMN "fim",
DROP COLUMN "inicio",
ADD COLUMN     "data_fim" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "data_inicio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
