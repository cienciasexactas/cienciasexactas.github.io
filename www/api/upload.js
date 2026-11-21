const TIMEOUT_GITHUB_MS = 10000; // 10s para operações de escrita/leitura de ficheiro no GitHub

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

function limparSegmentoCaminho(valor) {
  return String(valor || "")
    .replace(/\.\./g, "")
    .replace(/^\/+|\/+$/g, "")
    .trim();
}

function normalizarBase64(conteudo) {
  const str = String(conteudo || "").trim();
  const idx = str.indexOf("base64,");
  return idx !== -1 ? str.slice(idx + 7).trim() : str;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { nomeArquivo, conteudoBase64, curso } = req.body || {};

    const cursoLimpo = limparSegmentoCaminho(curso);
    const arquivoLimpo = limparSegmentoCaminho(nomeArquivo);
    const base64Limpo = normalizarBase64(conteudoBase64);

    if (!arquivoLimpo || !base64Limpo || !cursoLimpo) {
      return res.status(400).json({ error: 'Dados incompletos no envio.' });
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) {
      return res.status(500).json({ error: 'Token do GitHub não configurado no servidor.' });
    }

    const REPO_OWNER = "cienciasexactas";
    const REPO_NAME = "cienciasexactas.github.io";

    const caminhoArquivo = `uploads/${cursoLimpo}/${arquivoLimpo}`;
    const caminhoCodificado = caminhoArquivo
      .split("/")
      .filter(Boolean)
      .map(seg => encodeURIComponent(seg))
      .join("/");
    const urlGithub = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${caminhoCodificado}`;

    const ghHeaders = {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'Vercel-Uploader',
      'Accept': 'application/vnd.github.v3+json'
    };

    async function obterShaAtual() {
      try {
        const checarExiste = await fetchGithubComTimeout(urlGithub, { headers: ghHeaders });
        if (checarExiste.ok) {
          const dadosExiste = await checarExiste.json();
          return dadosExiste.sha || null;
        }
      } catch (_) {
        // Ficheiro novo ou falha momentânea na leitura prévia
      }
      return null;
    }

    let sha = await obterShaAtual();

    async function enviarPutGithub(shaAtual) {
      const corpoPayload = {
        message: `Upload de ficheiro para ${cursoLimpo}: ${arquivoLimpo}`,
        content: base64Limpo
      };
      if (shaAtual) corpoPayload.sha = shaAtual;

      return fetchGithubComTimeout(urlGithub, {
        method: 'PUT',
        headers: {
          ...ghHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(corpoPayload)
      });
    }

    let response = await enviarPutGithub(sha);

    // Em caso de conflito de SHA (409/422), revalida o SHA atual e tenta uma vez mais
    if (response.status === 409 || response.status === 422) {
      sha = await obterShaAtual();
      response = await enviarPutGithub(sha);
    }

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return res.status(200).json({
        success: true,
        url: data?.content?.html_url || null,
        path: caminhoArquivo
      });
    }

    return res.status(response.status >= 400 && response.status < 600 ? response.status : 400).json({
      error: data.message || 'Falha ao enviar ficheiro para o GitHub.'
    });
  } catch (error) {
    const status = error && error.name === 'AbortError' ? 504 : 500;
    const msg = status === 504
      ? 'Tempo limite excedido ao enviar o ficheiro para o GitHub.'
      : 'Erro interno no servidor: ' + error.message;
    return res.status(status).json({ error: msg });
  }
}