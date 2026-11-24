import prisma from "@/prisma";
import { Cargos } from "@prisma/client";
import type {
  DashboardCalendarEntry,
  DashboardStats,
} from "./dashboard.dto";

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);
const toMinutes = (hours: number | null): number =>
  Math.max(0, Math.round((hours ?? 0) * 60));

const getStats = async (
  usuarioId: string,
  empresaId: string,
  cargo: Cargos,
  workspaceId: string,
): Promise<DashboardStats> => {
  const verEquipe =
    cargo === Cargos.OWNER || cargo === Cargos.ADMIN;
  const filtroUsuario = verEquipe ? undefined : usuarioId;

  const [employees, projects, timeEntries, calendar] = await Promise.all([
    prisma.empresaUsuarios.findMany({
      where: { empresa_id: empresaId },
      select: {
        cargo: true,
        usuario: {
          select: {
            id: true,
            nome_completo: true,
          },
        },
      },
      orderBy: [{ usuario: { nome_completo: "asc" } }, { usuario_id: "asc" }],
    }),
    prisma.projeto.findMany({
      where: { empresa_id: empresaId },
      select: {
        id: true,
        nome_projeto: true,
        status: true,
        data_fim: true,
        horas_previstas: true,
        horas_gastas: true,
        parceiro: {
          select: { id: true, nome_fantasia: true },
        },
        equipe: {
          select: { id: true },
        },
      },
      orderBy: [{ nome_projeto: "asc" }, { id: "asc" }],
    }),
    prisma.lancamento.findMany({
      where: {
        usuario_id: filtroUsuario,
        usuario: { empresas: { some: { empresa_id: empresaId } } },
        atividade: {
          empresa_id: empresaId,
          projeto: { empresa_id: empresaId },
        },
      },
      select: {
        id: true,
        usuario_id: true,
        data_lancamento: true,
        duracao_total: true,
        usuario: {
          select: { nome_completo: true },
        },
        atividade: {
          select: {
            nome_atividade: true,
            faturado: true,
            projeto: {
              select: {
                id: true,
                nome_projeto: true,
                parceiro: {
                  select: { id: true, nome_fantasia: true },
                },
              },
            },
          },
        },
        despesas: {
          select: {
            id: true,
            nome_despesa: true,
            descricao: true,
            valor: true,
          },
        },
      },
      orderBy: [{ data_lancamento: "asc" }, { id: "asc" }],
    }),
    prisma.administrativo.findMany({
      where: {
        empresaId,
        usuarioId: filtroUsuario,
      },
      select: {
        id: true,
        tipo: true,
        titulo: true,
        data_inicio: true,
        data_fim: true,
        usuarioId: true,
      },
      orderBy: [{ data_inicio: "asc" }, { id: "asc" }],
    }),
  ]);

  const timeEntriesDto: DashboardStats["timeEntries"] = timeEntries.map(
    (entry) => ({
      id: entry.id,
      employeeId: entry.usuario_id,
      employeeName: entry.usuario.nome_completo,
      clientId: entry.atividade.projeto.parceiro.id,
      clientName: entry.atividade.projeto.parceiro.nome_fantasia,
      projectId: entry.atividade.projeto.id,
      projectName: entry.atividade.projeto.nome_projeto,
      activityName: entry.atividade.nome_atividade,
      date: toDateOnly(entry.data_lancamento),
      durationMinutes: toMinutes(entry.duracao_total),
      billable: entry.atividade.faturado,
      approvalStatus: null,
    }),
  );

  const employeeIds = new Set(employees.map(({ usuario }) => usuario.id));
  const projectsDto: DashboardStats["projects"] = projects.map((project) => ({
    id: project.id,
    name: project.nome_projeto,
    clientId: project.parceiro.id,
    clientName: project.parceiro.nome_fantasia,
    status: project.status,
    deadline: toDateOnly(project.data_fim),
    budgetMinutes:
      project.horas_previstas === null
        ? null
        : toMinutes(project.horas_previstas),
    actualMinutes: toMinutes(project.horas_gastas),
    memberIds: project.equipe
      .map(({ id }) => id)
      .filter((id) => employeeIds.has(id)),
  }));

  const expenses: DashboardStats["expenses"] = timeEntries.flatMap((entry) =>
    entry.despesas.map((expense) => ({
      id: expense.id,
      employeeId: entry.usuario_id,
      employeeName: entry.usuario.nome_completo,
      name: expense.nome_despesa,
      description: expense.descricao,
      clientId: entry.atividade.projeto.parceiro.id,
      clientName: entry.atividade.projeto.parceiro.nome_fantasia,
      date: toDateOnly(entry.data_lancamento),
      amountCents: Math.max(0, Math.round(expense.valor * 100)),
      // Despesas legadas não têm fluxo de aprovação; o estado foi definido pelo usuário.
      status: "APPROVED" as const,
    })),
  );

  const reportsByClientAndPeriod = new Map<
    string,
    DashboardStats["clientReports"][number]
  >();

  for (const entry of timeEntries) {
    const period = toDateOnly(entry.data_lancamento).slice(0, 7);
    const client = entry.atividade.projeto.parceiro;
    const key = `${client.id}:${period}`;

    if (!reportsByClientAndPeriod.has(key)) {
      reportsByClientAndPeriod.set(key, {
        clientId: client.id,
        clientName: client.nome_fantasia,
        period,
        templateConfigured: false,
      });
    }
  }

  const calendarEntries: DashboardCalendarEntry[] = calendar.map((entry) => ({
    id: entry.id,
    type: entry.tipo,
    title:
      entry.titulo ??
      ({
        FERIAS: "Férias",
        FALTA: "Falta",
        EVENTO: "Evento",
      }[entry.tipo]),
    startsOn: toDateOnly(entry.data_inicio),
    endsOn: toDateOnly(entry.data_fim),
    employeeId: entry.usuarioId,
  }));

  return {
    contractVersion: 1,
    generatedAt: new Date().toISOString(),
    workspaceId,
    timeEntries: timeEntriesDto,
    projects: projectsDto,
    employees: employees.map(({ cargo, usuario }) => ({
      id: usuario.id,
      name: usuario.nome_completo,
      role: cargo,
      weeklyCapacityMinutes: null,
    })),
    pendingApprovals: [],
    expenses,
    periodClosures: [],
    clientReports: [...reportsByClientAndPeriod.values()].sort((a, b) =>
      a.period.localeCompare(b.period) || a.clientName.localeCompare(b.clientName),
    ),
    calendarEntries,
  };
};

export const DashboardService = { getStats };
