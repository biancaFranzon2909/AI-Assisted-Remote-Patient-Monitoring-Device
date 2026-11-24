import { Router } from 'express';

// Controllers
import relatoriosController from '../entities/relatorios/relatorios.controller';
import lancamentosController from '../entities/lancamentos/lancamentos.controller';
import empresasController from '../entities/empresas/empresas.controller';
import dashboardController from '../entities/dashboard/dashboard.controller';
import usuariosController from '../entities/usuarios/usuarios.controller';
import despesasController from '../entities/despesas/despesas.controller';
import projetosController from '../entities/projetos/projetos.controller';
import atividadesController from '../entities/atividades/atividades.controller';
import clientesController from '../entities/clientes/clientes.controller';
import authController from '../entities/auth/auth.controller';
import partnerController from '../entities/parceria/partner.controller';
import administrativoController from '../entities/administrativo/administrativo.controller';
import conviteController from '@/entities/convite/convite.controller';
import { conviteLimiter } from '@/middlewares/rateLimit';

const router = Router();

// Empresas
router.post("/empresas/create", empresasController.postEmpresas);
// router.post("/empresas/usuario/add/:email", empresasController.addUserToCompany)
router.delete("/empresas/usuario/remove/:id", empresasController.deleteUserFromCompany);
router.delete("/empresas/delete", empresasController.deleteCompany);

// Clientes
router.get(["/clientes/list","/clientes/list/:id"], clientesController.getClientes);
router.get("/clientes/:id/projetos", clientesController.getClienteProjetos);
router.post("/clientes/create", clientesController.postClientes);
router.put("/clientes/edit/:id", clientesController.putClientes);
router.delete("/clientes/delete/:id", clientesController.deleteClientes);

// Projetos
router.get(["/projetos/list", "/projetos/list/:id"], projetosController.getProjetos);
router.post("/projetos/create", projetosController.postProjetos);
router.put("/projetos/edit/:id", projetosController.putProjetos);
router.delete("/projetos/delete/:id", projetosController.deleteProjetos);

// Atividades
router.get(["/atividades/list/","/atividades/list/:id"], atividadesController.getAtividades);
// router.get("/atividades/:id", atividadesController.getAtividadeById);
router.post("/atividades/create/", atividadesController.postAtividades);
router.put("/atividades/edit/:id", atividadesController.putAtividades);
router.delete("/atividades/delete/:id", atividadesController.deleteAtividades);

// Despesas
router.get("/despesas/lancamentos/dia", despesasController.getLancamentosDoDia)
router.get(["/despesas/list/", "/despesas/list/:id"], despesasController.getDespesas);
router.post("/despesas/create", despesasController.postDespesas);
router.delete("/despesas/delete/:id", despesasController.deleteDespesas);

// Usuários
router.get(["/usuarios/list/:id", "/usuarios/list/"], usuariosController.getUsuarios);
router.get("/usuarios/stats/:usuarioId", usuariosController.getUserStats)
router.patch("/usuarios/senha", usuariosController.updatePassword);
router.patch("/usuarios/inativar", usuariosController.inativarConta)

// Convite
router.post("/convite/create", conviteLimiter, conviteController.postInvite)
router.get("/convite/aceite/:token", conviteController.getAcceptInvite)
router.post("/convite/aceitar/:token", conviteController.postAceitarConvite)

// Dashboard
router.get("/dashboard/stats", dashboardController.getStats);

// Relatorios
router.post(["/relatorios/list/", "/relatorios/files/"], relatoriosController.relatoriosEntryPoint);

// Partner (compartilhamento)
router.post("/partner/:projetoId/:clienteId", partnerController.setCompartilhado);
router.delete("/partner/:projetoId/:clienteId", partnerController.unsetCompartilhado);

// Lançamentos (timesheet)
router.get("/lancamentos/new-info/", lancamentosController.getNewInfoLancamentos);
router.get(["/lancamentos/list/", "/lancamentos/list/:id"], lancamentosController.getLancamentos);
router.post("/lancamentos/create/", lancamentosController.postLancamentos);
router.put("/lancamentos/edit/:id", lancamentosController.putLancamentos);
router.delete("/lancamentos/delete/:id", lancamentosController.deleteLancamentos);

// Eventos administrativos
router.get("/administrativo/list", administrativoController.getAdministrativo);
router.post("/administrativo/create", administrativoController.postAdministrativo);
router.put("/administrativo/edit/:id", administrativoController.putAdministrativo);
router.delete("/administrativo/delete/:id", administrativoController.removeAdministrativo);

// Logs de segurança  
// router.post("/logs", logController.postLog);

// Login
router.get("/auth/me", usuariosController.getMe);
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.authenticate);
router.post("/auth/refresh-token", authController.refreshToken);
router.post("/auth/logout", authController.logout);
router.post("/auth/password-reset", authController.passwordReset)
router.post("/auth/password-reset-verify", authController.passwordResetVerify)

// API Fora
router.get("/api/relatorios/registro", relatoriosController.getRegistrosJson);

router.get("/health", (req: request, res: response) => {return res.send(`Funcionando ${new Date()}`)})

export default router  