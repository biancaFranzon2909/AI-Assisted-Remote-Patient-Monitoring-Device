import ExcelJS from "exceljs";
import path from "node:path";
import fs from "fs";
import TimeStamps from "@/lib/TimeStamps";
import type {
  RelatorioFilters,
  RelatorioResult,
  RelatorioBufferResult,
  RelatorioJsonResult,
  RegistroJson,
} from "./relatorios.dto";
import { empresa } from "@prisma/client";
import prisma from "@/prisma";
import { AppError } from "@/lib/errors/AppError";
import { isUuid, podeVerLancamentosDaEmpresa } from "@/lib/utils";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makeFinalPath(filename: string): string {
  const root = path.join(process.cwd());
  const dir = path.join(root, "relatorios_gerados");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}

function normalizar(v: string): string {
  return v
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
}

function createNormalizedFilters(body: any): RelatorioFilters {
  const query = { ...body };
  for (const prop in query) {
    if (prop === "data" || (!query[prop]?.inicio && !query[prop]?.fim))
      continue;
    query[prop].inicio = normalizar(query[prop].inicio);
    query[prop].fim = normalizar(query[prop].fim);
  }
  return query;
}

function createNormalizedFiltersFromQuery(query: Record<string, any>): RelatorioFilters {
  const parseRange = (key: string) => {
    const inicio = query[`${key}Inicio`] || query[`${key}_inicio`]?.[0] || query[`${key}Inicio`]?.[0];
    const fim = query[`${key}Fim`] || query[`${key}_fim`]?.[0] || query[`${key}Fim`]?.[0];

    if (!inicio && !fim) return undefined;
    return {
      inicio: inicio ? normalizar(String(inicio)) : undefined,
      fim: fim ? normalizar(String(fim)) : undefined,
    };
  };
  return {
    data: {
      inicio: query.dataInicio || query.data_inicio,
      fim: query.dataFim || query.data_fim,
    },
    cliente: parseRange("cliente"),
    projeto: parseRange("projeto"),
    colaborador: parseRange("colaborador"),
    atividade: parseRange("atividade"),
    tipoAtividade: parseRange("tipoAtividade"),
  };
}

function estaNoIntervalo(
  valor: string | number | null | undefined,
  inicio?: string,
  fim?: string,
): boolean {
  if (valor === undefined || valor === null) return false;
  if (!inicio || !fim) return true;

  if (typeof valor === "number") {
    // src\entities\relatorios\relatorios.service.ts
    //  Pega o timestamp do fim e do início
    const ini = new TimeStamps().getRangeDate(new Date(inicio)).from.getTime();
    const fi = new TimeStamps().getRangeDate(new Date(fim)).to.getTime();

    return valor >= ini && valor <= fi;
  }

  const v = normalizar(valor);
  const i = inicio ? normalizar(inicio) : "";
  const f = fim ? normalizar(fim) + "\uffff" : "\uffff";
  return v >= i && v <= f;
}

async function getLancamentosDados(empresaId: string, colaboradoresIds?: string[]) {
  return prisma.lancamento.findMany({
    where: {
      atividade: {
        empresa_id: empresaId,
      },
      // ...(colaboradoresIds && colaboradoresIds.length > 0
      //   ? { usuario_id: { in: colaboradoresIds } }
      //   : {}),
      usuario_id: colaboradoresIds && colaboradoresIds.length > 0 ? { in: colaboradoresIds } : undefined,
    },
    include: {
      usuario: { select: { nome_completo: true, nome_usuario: true } },
      atividade: {
        include: {
          projeto: {
            include: {
              parceiro: true,
            },
          },
          empresa: true,
        },
      },
    },
    orderBy: [{ data_lancamento: "desc" }],
  });
}

/**
 * Colaboradores cujos dados entram no relatório. COLAB só vê os próprios lançamentos e despesas
 * (o `colaboradores` do corpo é ignorado); OWNER/ADMIN podem filtrar pela lista do corpo.
 */
async function resolverColaboradores(
  empresaId: string,
  usuarioId: string,
  body: unknown,
): Promise<string[] | undefined> {
  const verEmpresa = await podeVerLancamentosDaEmpresa(usuarioId, empresaId);
  if (!verEmpresa) return [usuarioId];

  const colaboradores =
    typeof body === "object" && body !== null
      ? (body as { colaboradores?: unknown }).colaboradores
      : undefined;

  if (colaboradores === undefined || colaboradores === null) return undefined;

  if (!Array.isArray(colaboradores) || !colaboradores.every(isUuid)) {
    throw new AppError("Lista de colaboradores inválida.", 400);
  }

  return colaboradores.length > 0 ? colaboradores : undefined;
}

// ─── Service operations ───────────────────────────────────────────────────────

const getRelatorioLancamentos = async (
  empresaId: string,
  body: unknown,
  colaboradores: string[] | undefined,
): Promise<RelatorioResult> => {
  const filters = createNormalizedFilters(body);

  let lancamentos = await getLancamentosDados(empresaId, colaboradores);

  lancamentos = lancamentos.filter((item) => {
    const filtrosTexto = [
      {
        valor: item.usuario.nome_completo || item.usuario.nome_usuario,
        filtro: filters.colaborador,
      },
      {
        valor: item.atividade.projeto.parceiro?.nome_fantasia,
        filtro: filters.cliente,
      },
      { valor: item.atividade.projeto.nome_projeto, filtro: filters.projeto },
      { valor: item.atividade.nome_atividade, filtro: filters.atividade },
      { valor: item.data_lancamento.getTime(), filtro: filters.data },
      { valor: item.atividade.tipo, filtro: filters.tipoAtividade },
    ];
    return filtrosTexto.every((f) =>
      estaNoIntervalo(
        f.valor as number | string,
        f.filtro?.inicio,
        f.filtro?.fim,
      ),
    );
  });

  const mapped = lancamentos.map((rep) => ({
    id: rep.id,
    dataLancamento: rep.data_lancamento,
    horaInicio: rep.hora_inicio,
    horaFim: rep.hora_fim,
    duracaoTotal: rep.duracao_total,
    nomeProjeto: rep.atividade.projeto?.nome_projeto,
    horasPrevistas: rep.atividade.horas_previstas,
    nomeColaborador: rep.usuario.nome_completo || rep.usuario.nome_usuario,
    nomeCliente: rep.atividade.projeto.parceiro?.nome_fantasia,
    nomeAtividade: rep.atividade.nome_atividade,
    descricao: rep.descricao,
    tipoAtividade: rep.atividade.tipo,
    ticketReferencia: rep.atividade.ref_cliente,
    centroCusto: rep.atividade.centro_custo,
    solicitante: rep.atividade.solicitante,
  }));

  return { error: false, data: mapped };
};

const getRelatorioDespesas = async (
  empresaId: string,
  body: unknown,
  colaboradoresIds: string[] | undefined,
): Promise<RelatorioResult> => {
  const filters = createNormalizedFilters(body);

  let despesas = await prisma.despesa.findMany({
    where: {
      lancamento: {
        atividade: {
          empresa_id: empresaId,
        },
        ...(colaboradoresIds && colaboradoresIds.length > 0
          ? { usuario_id: { in: colaboradoresIds } }
          : {}),
      },
    },
    include: {
      lancamento: {
        include: {
          usuario: { select: { nome_completo: true, nome_usuario: true } },
          atividade: {
            include: { projeto: { include: { parceiro: true } } },
          },
        },
      },
    },
    orderBy: { criado_em: "desc" },
  });

  
  despesas = despesas.filter((item) => {
    const filtrosTexto = [
      {
        valor:
          item.lancamento.usuario.nome_completo ||
          item.lancamento.usuario.nome_usuario,
        filtro: filters?.colaborador,
      },
      {
        valor: item.lancamento.atividade.projeto.parceiro?.nome_fantasia,
        filtro: filters.cliente,
      },
      {
        valor: item.lancamento.data_lancamento.getTime(),
        filtro: filters.data,
      },
    ];
    return filtrosTexto.every((f) =>
      estaNoIntervalo(
        f.valor as number | string,
        f.filtro?.inicio,
        f.filtro?.fim,
      ),
    );
  });
  
  const somatorio = despesas
    .reduce((acc, curr) => acc + Number(curr.valor), 0)
    .toFixed(2);

  const mapped = despesas.map((despesa) => ({
    despesa_id: despesa.id,
    data: despesa.lancamento.data_lancamento,
    nomeColaborador:
      despesa.lancamento.usuario.nome_completo ||
      despesa.lancamento.usuario.nome_usuario,
    nomeDespesa: despesa.nome_despesa,
    valor: Number(despesa.valor),
    lancamentoId: despesa.id,
    projetoId: despesa?.lancamento?.atividade?.projeto_id,
    nomeProjeto: despesa?.lancamento?.atividade?.projeto?.nome_projeto,
    nomeCliente: despesa?.lancamento.atividade.projeto.parceiro.nome_fantasia,
    descricao: despesa.descricao,
    descricaoLancamento: despesa.lancamento.descricao,
  }));

  return { error: false, data: { mapped, somatorio } };
};

const generateBuffer = async (
  fileName: string,
  isDespesas: boolean,
  data: any[] & { mapped: any[]; somatorio: number },
): Promise<RelatorioBufferResult | null> => {
  const contentType =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (isDespesas) {
    const workbook = new ExcelJS.Workbook();

    // ----------- Consolidação!! ----------------
    const worksheet = workbook.addWorksheet("Relatório de Despesas");
    worksheet.columns = [
      { header: "Data", key: "data", width: 15 },
      { header: "Colaborador", key: "colaborador", width: 30 },
      { header: "Despesa", key: "nome_despesa", width: 25 },
      { header: "Descricao Lançamento", key: "lancamento", width: 40 },
      { header: "Projeto", key: "projeto", width: 25 },
      { header: "Descrição", key: "descricao", width: 40 },
      { header: "Valor", key: "valor", width: 15 },
    ];

    for (const despesa of data.mapped) {
      worksheet.addRow({
        data: despesa.data ? despesa.data.toLocaleDateString("pt-BR") : "",
        colaborador: despesa.nomeColaborador,
        nome_despesa: despesa.nomeDespesa,
        valor: despesa.valor,
        lancamento: despesa.descricaoLancamento,
        projeto: despesa.nomeProjeto,
        descricao: despesa.descricao,
      });
    }

    const ultimaLinhaDados = data.mapped.length + 1;
    worksheet.addRow({});
    const total = worksheet.addRow({
      descricao: "TOTAL",
      valor: { formula: `SUM(G2:G${ultimaLinhaDados})` },
    });
    total.font = { bold: true };
    worksheet.getRow(1).font = { bold: true };
    worksheet.getColumn("valor").numFmt = '"R$"#,##0.00;("R$"#,##0.00);"-"';


    // ------------------ Por Colaborador!!!! ----------
    const wsColaboradores = workbook.addWorksheet("Por colaborador");
    wsColaboradores.getColumn(1).width = 15; // Data
    wsColaboradores.getColumn(2).width = 30; // Cliente
    wsColaboradores.getColumn(3).width = 25; // Despesa
    wsColaboradores.getColumn(4).width = 25; // Projeto
    wsColaboradores.getColumn(5).width = 40; // Descrição
    wsColaboradores.getColumn(6).width = 15; // Valor
    wsColaboradores.getColumn(6).numFmt = '"R$"#,##0.00;("R$"#,##0.00);"-"';

    const despesasPorColaborador = Object.groupBy(
      data.mapped,
      (item: any) => item.nomeColaborador
    );

    let linhaAtualColaborador = 1;
    for (const colaborador in despesasPorColaborador) {
      const itens = despesasPorColaborador[colaborador] || [];

      const headerColaborador = wsColaboradores.addRow(["Colaborador:", colaborador]);
      headerColaborador.font = { bold: true };
      linhaAtualColaborador++;

      const subHeader = wsColaboradores.addRow(["Data", "Cliente", "Despesa", "Projeto", "Descrição", "Valor"]);
      subHeader.font = { bold: true };
      linhaAtualColaborador++;

      const linhaInicio = linhaAtualColaborador;

      itens.forEach((despesa: any) => {
        wsColaboradores.addRow([
          despesa.data ? new Date(despesa.data).toLocaleDateString("pt-BR") : "",
          despesa.nomeCliente,
          despesa.nomeDespesa,
          despesa.nomeProjeto,
          despesa.descricao,
          despesa.valor,
        ]);
        linhaAtualColaborador++;
      });

      const linhaFim = linhaAtualColaborador - 1;

      const linhaTotal = wsColaboradores.addRow([
        "",
        "",
        "",
        "",
        `TOTAL - ${colaborador}`,
        { formula: `SUM(F${linhaInicio}:F${linhaFim})`},
      ])
      linhaTotal.font = { bold: true };
      linhaAtualColaborador++;

      wsColaboradores.addRow([]);
      linhaAtualColaborador++;
    }


    // ---------- Por Clientes!!! -----------
    const wsClientes = workbook.addWorksheet("Por Parceiro");
    wsClientes.getColumn(1).width = 15; // Data
    wsClientes.getColumn(2).width = 30; // Colaborador
    wsClientes.getColumn(3).width = 25; // Despesa
    wsClientes.getColumn(4).width = 25; // Projeto
    wsClientes.getColumn(5).width = 40; // Descrição
    wsClientes.getColumn(6).width = 15; // Valor
    wsClientes.getColumn(6).numFmt = '"R$"#,##0.00;("R$"#,##0.00);"-"';

    const despesasPorCliente = Object.groupBy(
      data.mapped,
      (item: any) => item.nomeCliente
    );

    let linhaAtualCliente = 1;
    for (const cliente in despesasPorCliente) {
      const itens = despesasPorCliente[cliente] || [];

      const headerCliente = wsClientes.addRow(["Cliente:", cliente]);
      headerCliente.font = { bold: true };
      linhaAtualCliente++;

      const subHeader = wsClientes.addRow(["Data", "Colaborador", "Despesa", "Projeto", "Descrição", "Valor"]);
      subHeader.font = { bold: true };
      linhaAtualCliente++;

      const linhaInicio = linhaAtualCliente;

      itens.forEach((despesa: any) => {
        wsClientes.addRow([
          despesa.data ? new Date(despesa.data).toLocaleDateString("pt-BR") : "",
          despesa.nomeColaborador,
          despesa.nomeDespesa,
          despesa.nomeProjeto,
          despesa.descricao,
          despesa.valor,
        ]);
        linhaAtualCliente++;
      });

      const linhaFim = linhaAtualCliente - 1;

      const linhaTotal = wsClientes.addRow([
        "",
        "",
        "",
        "",
        `TOTAL - ${cliente}`,
        { formula: `SUM(F${linhaInicio}:F${linhaFim})`},
      ])
      linhaTotal.font = { bold: true };
      linhaAtualCliente++;

      wsClientes.addRow([]);
      linhaAtualCliente++;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer, fileName, contentType };
  } else {
    // ─── Relatório lançamentos
    const dadosAgrupadosAtividade = Object.groupBy(
      data,
      (item) => item.nomeAtividade,
    );

    const workbook = new ExcelJS.Workbook();
    const wsAtividades = workbook.addWorksheet("Resumo Atividade");
    wsAtividades.getColumn(1).width = 50;
    wsAtividades.getColumn(2).width = 50;
    wsAtividades.getColumn(3).width = 10;
    wsAtividades.getColumn(4).width = 10;
    wsAtividades.addRow(["Cliente","Atividade", "Quantidade de horas"]);

    let totalLinhasResumo = 1;
    for (const atividade in dadosAgrupadosAtividade) {
      const lancamentos = dadosAgrupadosAtividade[atividade] || [];
      const somaHoras = lancamentos.reduce(
        (acc: number, curr: any) => acc + (Number(curr.duracaoTotal) || 0),
        0,
      );
      wsAtividades.addRow([
        lancamentos?.at(0).nomeCliente,
        atividade,
        new TimeStamps().getWatchHour(somaHoras),
        Number(somaHoras.toFixed(2)),
      ]);
      totalLinhasResumo++;
    }

    wsAtividades.addRow([
      "",
      "TOTAL DE HORAS",
      "",
      { formula: `SUM(D2:D${totalLinhasResumo})` },
    ]);

    for (const atividade in dadosAgrupadosAtividade) {
      const lancamentos = dadosAgrupadosAtividade[atividade] || [];
      const nomeAba = atividade.replace(/[/\\?*:[\]]/g, "").substring(0, 31);
      const wsLancamentos = workbook.addWorksheet(nomeAba);
      const primeiroLancamento = lancamentos?.at(0);
      const totalHorasAtividade = lancamentos.reduce(
        (acc: number, curr: any) => acc + (Number(curr.duracaoTotal) || 0),
        0,
      );

      wsLancamentos.getColumn(1).width = 15;
      wsLancamentos.getColumn(2).width = 10;
      wsLancamentos.getColumn(3).width = 10;
      wsLancamentos.getColumn(4).width = 90;
      wsLancamentos.getColumn(5).width = 30;
      wsLancamentos.getColumn(6).width = 15;

      [
        ["", "", "", "", "Cliente:", primeiroLancamento?.nomeCliente],
        ["", "", "", "", "Centro de custo:", primeiroLancamento?.centroCusto],
        ["", "", "", "", "Solicitante:", primeiroLancamento?.solicitante],
        ["", "", "", "", "Atividade:", primeiroLancamento?.nomeAtividade],
        [
          "",
          "",
          "",
          "",
          "Qtde Horas Totais:",
          new TimeStamps().getWatchHour(totalHorasAtividade),
        ],
        ["Data", "Qtde Horas", "Qtde Horas", "Descricao", "Colaborador", ""],
      ].forEach((linha) => wsLancamentos.addRow(linha));

      lancamentos.forEach((item: any) => {
        const dataFormatada = item.dataLancamento
          ? new Date(item.dataLancamento).toLocaleDateString("pt-BR")
          : "";
        const horas = Number(item.duracaoTotal) || 0;
        wsLancamentos.addRow([
          dataFormatada,
          new TimeStamps().getWatchHour(horas),
          horas.toFixed(2),
          `${item.descricao}`,
          item?.nomeColaborador,
        ]);
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer, fileName, contentType };
  }
};

const generateReport = async (
  empresaId: string,
  usuarioId: string,
  body: unknown,
  isDespesas: boolean,
  fileType?: "xlsx" | "pdf",
): Promise<{
  result: RelatorioResult;
  bufferResult?: RelatorioBufferResult | null;
  fileName?: string;
}> => {
  const colaboradores = await resolverColaboradores(empresaId, usuarioId, body);

  const result = isDespesas
    ? await getRelatorioDespesas(empresaId, body, colaboradores)
    : await getRelatorioLancamentos(empresaId, body, colaboradores);

  if (fileType) {
    const fileName = `relatorio_${isDespesas ? "despesas" : "lancamentos"}_${new Date().getTime()}.${fileType}`;
    const bufferResult = await generateBuffer(
      fileName,
      isDespesas,
      result.data,
    );
    return { result, bufferResult, fileName };
  }

  return { result };
};

const getRegistrosJson = async (query: Record<string, any>, req: request): Promise<RelatorioJsonResult> => {
  const empresaId = req.user?.empresaId;
  const identificador = query.identificador as string;

  const empresa = await prisma.empresa.findFirst({
    where: identificador ? { identificador } : { id: empresaId },
  });

  if (!empresa) {
    throw new AppError("Empresa não encontrada.", 404);
  }

  if (empresa.id !== empresaId) {
    throw new AppError("Acesso negado aos dados desta empresa.", 403);
  }

  const filters = createNormalizedFiltersFromQuery(query);
  let lancamentos = await getLancamentosDados(empresa.id);

  lancamentos = lancamentos.filter((item) => {
    const filtrosTexto = [
      {
        valor: item.usuario.nome_completo || item.usuario.nome_usuario,
        filtro: filters.colaborador,
      },
      {
        valor: item.atividade.projeto.parceiro?.nome_fantasia,
        filtro: filters.cliente,
      },
      { valor: item.atividade.projeto?.nome_projeto, filtro: filters.projeto },
      { valor: item.atividade.nome_atividade, filtro: filters.atividade },
      { valor: item.data_lancamento.getTime(), filtro: filters.data },
      { valor: item.atividade.tipo, filtro: filters.tipoAtividade },
    ];
    return filtrosTexto.every((f) =>
      estaNoIntervalo(
        f.valor as number | string,
        f.filtro?.inicio,
        f.filtro?.fim,
      ),
    );
  });

  // src\entities\relatorios\relatorios.service.ts
  // Mapeia as datas do registros
  const registros: RegistroJson[] = lancamentos.map((rep) => ({
    empresa: {
      nome: empresa?.nome_empresa || "Não informado",
      identificador: empresa?.identificador || "Não informado",
    },
    cliente: rep.atividade.projeto.parceiro?.nome_fantasia || "Não informado",
    projeto: rep.atividade.projeto?.nome_projeto || "Não informado",
    atividade: rep.atividade?.nome_atividade || "Não informado",
    data: rep.data_lancamento.toLocaleDateString("pt-BR"),
    qtd_horas_decimal: rep.duracao_total
      ? Number(rep.duracao_total.toFixed(2))
      : 0,
    descricao: rep.descricao || "",
    colaborador:
      rep.usuario.nome_completo ||
      rep.usuario.nome_usuario ||
      "Não informado",
    ticket_referencia: rep.atividade.ref_cliente || "",
    tipo_atividade: rep.atividade.tipo || "",
    horaInicio: rep.hora_inicio,
    horaFim: rep.hora_fim,
  }));

  return { error: false, data: registros };
};

export const RelatoriosService = { generateReport, getRegistrosJson };
