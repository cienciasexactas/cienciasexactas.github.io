// Configuração dos períodos de submissão permitidos por secção (Fuso horário de STP / UTC+0)
const PERIODOS_SUBMISSAO = {
  colaborativos: {
    inicio: new Date('2026-09-15T18:20:00Z'),
    fim: new Date('2026-09-15T22:51:59Z')
  },
  grupo: {
    inicio: new Date('2026-09-06T08:00:00Z'),
    fim: new Date('2026-09-30T23:59:59Z')
  },
  publicacoes: {
    inicio: new Date('2026-09-01T00:00:00Z'),
    fim: new Date('2026-10-31T23:59:59Z')
  }
};