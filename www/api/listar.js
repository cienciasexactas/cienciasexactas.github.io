export default async function handler(req, res) {
  // 1. Configuração de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  // 2. Controlo rigoroso de Cache
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { curso } = req.query;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = "cienciasexactas";
  const REPO_NAME = "cienciasexactas.github.io";

  if (!curso) {
    return res.status(400).json({ error: 'Parâmetro curso é obrigatório.' });
  }

  const headers = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'User-Agent': 'Vercel-Lister',
    'Accept': 'application/vnd.github.v3+json'
  };

  try {
    // Tenta aceder diretamente à diretoria do curso no GitHub
    const resAnos = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/uploads/${curso}`,
      { headers }
    );

    // Se o GitHub atingir o Rate Limit ou falhar temporariamente, 
    // DEVOLVEMOS HTTP 503 em vez de vazio, para o site não apagar os dados do ecrã!
    if (resAnos.status === 403 || res.status === 429) {
      return res.status(503).json({ error: 'Limite de pedidos ao GitHub atingido temporariamente. A tentar novamente...' });
    }

    if (resAnos.status === 404) {
      return res.status(200).json({ estrutura: [] });
    }

    if (!resAnos.ok) {
      return res.status(502).json({ error: 'Erro ao comunicar com o GitHub.' });
    }

    const anosPastas = await resAnos.json();
    if (!Array.isArray(anosPastas)) {
      return res.status(200).json({ estrutura: [] });
    }

    const pastasValidas = anosPastas.filter(item => item.type === 'dir');

    // Mapeamento otimizado para evitar estouro de requisições
    const resultado = await Promise.all(
      pastasValidas.map(async (pastaAno) => {
        const resFicheiros = await fetch(pastaAno.url, { headers });
        if (!resFicheiros.ok) return { ano: pastaAno.name, ficheiros: [] };

        const ficheiros = await resFicheiros.json();
        if (!Array.isArray(ficheiros)) return { ano: pastaAno.name, ficheiros: [] };

        const apenasFicheiros = ficheiros.filter(item => item.type === 'file');

        const listaFicheiros = apenasFicheiros.map((f) => {
          return {
            nome: f.name,
            path: f.path,
            tamanho: f.size,
            url: `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${f.path.split('/').map(segment => encodeURIComponent(segment)).join('/')}`,
            data: f.last_modified || new Date().toISOString()
          };
        });

        return {
          ano: pastaAno.name,
          ficheiros: listaFicheiros
        };
      })
    );

    return res.status(200).json({ estrutura: resultado });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}