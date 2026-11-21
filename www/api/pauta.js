const CACHE_PAUTA_MS = 30 * 1000; // 30s de cache em memória na instância serverless
const TIMEOUT_GITHUB_MS = 8000;

let cachePautaMemoria = null; // { ts, dados }

async function fetchGithubComTimeout(url, options = {}, timeoutMs = TIMEOUT_GITHUB_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizarPayloadPauta(jsonDados) {
  const colunasPorCadeira =
    (jsonDados && (jsonDados.planilhasColunasPorCadeira || jsonDados.planilhasColunas)) || {};

  return {
    estudantes: Array.isArray(jsonDados?.estudantes) ? jsonDados.estudantes : [],
    planilhasColunasPorCadeira: colunasPorCadeira,
    percentagens: jsonDados?.percentagens && typeof jsonDados.percentagens === 'object'
      ? jsonDados.percentagens
      : {}
  };
}

export default async function handler(req, res) {
  // 1. Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 2. Controlo rigoroso de Cache HTTP no browser/CDN
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = "cienciasexactas";
  const REPO_NAME = "cienciasexactas.github.io";
  const FILE_PATH = "dados/pauta_geral.json";
  const endpointContents = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

  const headers = {
    'User-Agent': 'Vercel-Pauta-Manager',
    'Accept': 'application/vnd.github.v3+json'
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    // MÉTODO GET: Ler os dados do GitHub (com cache em memória de curto TTL e fallback)
    if (req.method === 'GET') {
      const noCache = req.query?.noCache === '1' || req.query?.noCache === 'true';
      const agora = Date.now();

      if (!noCache && cachePautaMemoria && (agora - cachePautaMemoria.ts) <= CACHE_PAUTA_MS) {
        res.setHeader('X-Cache-Status', 'HIT');
        return res.status(200).json(cachePautaMemoria.dados);
      }

      try {
        const respostaGh = await fetchGithubComTimeout(endpointContents, { headers });

        if (respostaGh.status === 404) {
          const vazio = {
            estudantes: [],
            planilhasColunasPorCadeira: {},
            percentagens: {}
          };
          cachePautaMemoria = { ts: agora, dados: vazio };
          res.setHeader('X-Cache-Status', 'MISS-404');
          return res.status(200).json(vazio);
        }

        if (!respostaGh.ok) {
          if (cachePautaMemoria?.dados) {
            res.setHeader('X-Cache-Status', 'STALE-FALLBACK');
            return res.status(200).json(cachePautaMemoria.dados);
          }
          return res.status(502).json({ error: 'Erro ao comunicar com o GitHub para ler os dados.' });
        }

        const dadosFicheiro = await respostaGh.json();
        const conteudoDecodificado = Buffer.from(dadosFicheiro.content, 'base64').toString('utf8');
        const jsonDados = JSON.parse(conteudoDecodificado);
        const normalizado = normalizarPayloadPauta(jsonDados);

        cachePautaMemoria = { ts: agora, dados: normalizado };
        res.setHeader('X-Cache-Status', 'MISS');
        return res.status(200).json(normalizado);
      } catch (erroGet) {
        if (cachePautaMemoria?.dados) {
          res.setHeader('X-Cache-Status', 'STALE-FALLBACK');
          return res.status(200).json(cachePautaMemoria.dados);
        }
        throw erroGet;
      }
    }

    // MÉTODO POST: Atualizar/Guardar os dados no GitHub (pessoal)
    if (req.method === 'POST') {
      const { estudantes, planilhasColunasPorCadeira, planilhasColunas, percentagens } = req.body || {};

      if (!Array.isArray(estudantes)) {
        return res.status(400).json({ error: 'Dados de estudantes obrigatórios (deve ser uma lista).' });
      }

      const dadosParaGuardar = normalizarPayloadPauta({
        estudantes,
        planilhasColunasPorCadeira: planilhasColunasPorCadeira || planilhasColunas || {},
        percentagens: percentagens || {}
      });

      const novoConteudoBase64 = Buffer.from(JSON.stringify(dadosParaGuardar, null, 2)).toString('base64');

      let fileSha = null;
      const checkGh = await fetchGithubComTimeout(endpointContents, { headers });

      if (checkGh.ok) {
        const fileInfo = await checkGh.json();
        fileSha = fileInfo.sha;
      }

      const payload = {
        message: "Atualização automática de pautas e colunas por cadeira via painel Vercel",
        content: novoConteudoBase64,
        sha: fileSha
      };

      const updateGh = await fetchGithubComTimeout(endpointContents, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!updateGh.ok) {
        const erroDetalhe = await updateGh.json().catch(() => ({}));
        return res.status(502).json({ error: 'Erro ao salvar no GitHub.', detalhe: erroDetalhe });
      }

      // Atualiza o cache em memória com os dados recém-guardados
      cachePautaMemoria = {
        ts: Date.now(),
        dados: dadosParaGuardar
      };

      return res.status(200).json({ sucesso: true, mensagem: 'Dados sincronizados com sucesso!' });
    }

    return res.status(405).json({ error: 'Método não permitido.' });

  } catch (error) {
    const status = error && error.name === 'AbortError' ? 504 : 500;
    return res.status(status).json({ error: error.message });
  }
}