// Configuração dos períodos de submissão permitidos por secção (Fuso horário de STP / UTC+0)
const PERIODOS_SUBMISSAO = {
  colaborativos: {
    inicio: new Date('2026-09-01T00:00:00Z'),
    fim: new Date('2026-09-10T23:53:59Z')
  },
  grupo: {
    inicio: new Date('2026-09-01T00:00:00Z'),
    fim: new Date('2026-09-10T23:59:59Z')
  },
  publicacoes: {
    inicio: new Date('2026-09-01T00:00:00Z'),
    fim: new Date('2026-09-10T23:59:59Z')
  }
};