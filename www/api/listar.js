const CACHE_LISTAR_MS = 60 * 1000; // 60s de cache em memória na instância serverless
const TIMEOUT_GITHUB_MS = 7000;
const cacheListarMemoria = new Map();

async function fetchGithubComTimeout(url, headers, timeoutMs = TIMEOUT_GITHUB_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  // 1. Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { curso, noCache } = req.query;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = "cienciasexactas";
  const REPO_NAME = "cienciasexactas.github.io";

  if (!curso) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ error: 'Parâmetro curso é obrigatório.' });
  }

  const chaveCache = String(curso);
  const agora = Date.now();
  const entradaCache = cacheListarMemoria.get(chaveCache);

  const ignorarCache = noCache === '1' || noCache === 'true';
  if (!ignorarCache && entradaCache && (agora - entradaCache.ts) <= CACHE_LISTAR_MS) {
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
    res.setHeader('X-Cache-Status', 'HIT');
    return res.status(200).json({ estrutura: entradaCache.estrutura });
  }

  const headers = {
    'User-Agent': 'Vercel-Lister',
    'Accept': 'application/vnd.github.v3+json'
  };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  try {
    const resAnos = await fetchGithubComTimeout(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/uploads/${curso}`,
      headers
    );

    if (resAnos.status === 403 || resAnos.status === 429) {
      if (entradaCache) {
        res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30');
        res.setHeader('X-Cache-Status', 'STALE-FALLBACK');
        return res.status(200).json({ estrutura: entradaCache.estrutura, aviso: 'Rate limit do GitHub: dados em cache.' });
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'Limite de pedidos ao GitHub atingido temporariamente. A tentar novamente...' });
    }

    if (resAnos.status === 404) {
      cacheListarMemoria.set(chaveCache, { ts: agora, estrutura: [] });
      res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({ estrutura: [] });
    }

    if (!resAnos.ok) {
      if (entradaCache) {
        res.setHeader('X-Cache-Status', 'STALE-FALLBACK');
        return res.status(200).json({ estrutura: entradaCache.estrutura });
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ error: 'Erro ao comunicar com o GitHub.' });
    }

    const anosPastas = await resAnos.json();
    if (!Array.isArray(anosPastas)) {
      return res.status(200).json({ estrutura: [] });
    }

    const pastasValidas = anosPastas.filter(item => item.type === 'dir');

    const resultado = await Promise.all(
      pastasValidas.map(async (pastaAno) => {
        const resFicheiros = await fetchGithubComTimeout(pastaAno.url, headers);
        if (!resFicheiros.ok) return { ano: pastaAno.name, ficheiros: [] };

        const ficheiros = await resFicheiros.json();
        if (!Array.isArray(ficheiros)) return { ano: pastaAno.name, ficheiros: [] };

        const apenasFicheiros = ficheiros.filter(item => item.type === 'file');

        const listaFicheiros = apenasFicheiros.map((f) => ({
          nome: f.name,
          path: f.path,
          tamanho: f.size,
          url: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${f.path.split('/').map(segment => encodeURIComponent(segment)).join('/')}`,
          data: f.last_modified || new Date().toISOString()
        }));

        return {
          ano: pastaAno.name,
          ficheiros: listaFicheiros
        };
      })
    );

    cacheListarMemoria.set(chaveCache, { ts: agora, estrutura: resultado });
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=120');
    res.setHeader('X-Cache-Status', 'MISS');
    return res.status(200).json({ estrutura: resultado });

  } catch (error) {
    if (entradaCache) {
      res.setHeader('X-Cache-Status', 'STALE-FALLBACK');
      return res.status(200).json({ estrutura: entradaCache.estrutura });
    }
    res.setHeader('Cache-Control', 'no-store');
    const status = error && error.name === 'AbortError' ? 504 : 500;
    return res.status(status).json({ error: error.message });
  }
}