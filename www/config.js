// Configuração dos períodos de submissão permitidos por curso e secção (Fuso horário de STP / UTC+0)
const PERIODOS_SUBMISSAO = {
  // Trabalhos Individuais por curso
  colaborativos: {
    biologia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    cienciasnaturais: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    matematica: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    economia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    'gestao-empresa': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    'gestao-iscgvsm': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    enfermagem: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    contabilidade: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    agronomia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    turismo: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    geografia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    'educacao-infancia': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
  },

  // Trabalhos de Grupo por curso
  grupo: {
    biologia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    cienciasnaturais: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    matematica: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    economia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    'gestao-empresa': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    'gestao-iscgvsm': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    enfermagem: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    contabilidade: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    agronomia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    turismo: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    geografia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    'educacao-infancia': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
  },

  // Produção Científica por curso
  publicacoes: {
    biologia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    cienciasnaturais: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    matematica: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    economia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    'gestao-empresa': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    'gestao-iscgvsm': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    enfermagem: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    contabilidade: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    agronomia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    turismo: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    geografia: { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
    'educacao-infancia': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
  },

  // Actividades por curso e por atividade específica
  actividades: {
    biologia: {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-09T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-09T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-09T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    cienciasnaturais: {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    matematica: {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    economia: {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    'gestao-empresa': {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    'gestao-iscgvsm': {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    'enfermagem-a': {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    'enfermagem-b': {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-11-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    contabilidade: {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    agronomia: {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    turismo: {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    geografia: {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    },
    'educacao-infancia': {
      'actividade-1': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-2': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-3': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-4': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-5': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-6': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-7': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') },
      'actividade-8': { inicio: new Date('2026-10-01T00:00:00Z'), fim: new Date('2026-10-01T23:59:59Z') }
    }
  }
};