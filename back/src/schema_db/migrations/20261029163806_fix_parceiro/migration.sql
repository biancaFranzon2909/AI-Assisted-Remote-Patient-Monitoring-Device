/*
  Warnings:

  - You are about to drop the column `nome_cliente` on the `parceiro` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[razao_social]` on the table `parceiro` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `nome_fantasia` to the `parceiro` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "TipoProjeto" ADD VALUE IF NOT EXISTS 'AMS';

-- DropIndex
DROP INDEX "idx_nome_cnpj_id";

-- DropIndex
DROP INDEX "parceiro_nome_cliente_key";

-- AlterTable
ALTER TABLE "parceiro" DROP COLUMN "nome_cliente",
ADD COLUMN     "criado_em" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "inscricao_estadual" VARCHAR(50),
ADD COLUMN     "nome_fantasia" VARCHAR(50) NOT NULL,
ADD COLUMN     "nota_interna" VARCHAR(100),
ADD COLUMN     "pais" VARCHAR(50),
ADD COLUMN     "razao_social" VARCHAR(50),
ADD COLUMN     "website" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "parceiro_razao_social_key" ON "parceiro"("razao_social");

-- CreateIndex
CREATE INDEX "idx_nome_cnpj_id" ON "parceiro"("razao_social", "cnpj", "id");
