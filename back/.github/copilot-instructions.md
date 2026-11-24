# Instruções do Copilot para a API do ChronoTracker

As regras do projeto estão em `AGENTS.md` e em `.github/instructions/`. Leia-as antes de propor mudanças.

- Responda em português do Brasil, de forma direta. Código e identificadores seguem o idioma já usado no arquivo.
- Para tarefas de endpoint, regra de negócio, banco ou segurança, use o agente `orquestrador-back` (ou o especialista adequado em `.github/agents/`).
- Nunca execute migration, seed ou script de dados contra homologação ou produção. Prefira editar o que existe a criar arquivo novo.
- Quando houver dúvida de regra de negócio, pergunte antes de implementar.
- Para saber onde fica cada rota, modelo ou padrão, use a skill `mapa-da-api` (`.github/skills/mapa-da-api/SKILL.md`). Validação disponível: `npx tsc --noEmit` e `npm run build` (não há lint nem testes).
