const CACHE_TRABALHOS_API_MS = 60 * 1000; // 60s de cache em memória na instância serverless
const TIMEOUT_GITHUB_MS = 7000;
const cacheTrabalhosMemoria = new Map();

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const caminho = String(req.query.caminho || "www/Trabalhos").replace(/^\/+|\/+$/g, "");
  const ignorarCache = req.query.noCache === "1" || req.query.noCache === "true";
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = "cienciasexactas";
  const REPO_NAME = "cienciasexactas.github.io";

  const agora = Date.now();
  const entradaCache = cacheTrabalhosMemoria.get(caminho);

  if (!ignorarCache && entradaCache && (agora - entradaCache.ts) <= CACHE_TRABALHOS_API_MS) {
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
    res.setHeader("X-Cache-Status", "HIT");
    return res.status(200).json(entradaCache.payload);
  }

  const headers = {
    ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
    "User-Agent": "Vercel-Trabalhos-API",
    Accept: "application/vnd.github.v3+json"
  };

  function montarUrlRaw(filePath) {
    return `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${String(filePath)
      .split("/")
      .filter(Boolean)
      .map(seg => encodeURIComponent(seg))
      .join("/")}`;
  }

  async function listarRecursivo(caminhoPasta) {
    const caminhoLimpo = String(caminhoPasta || "").replace(/^\/+|\/+$/g, "");
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${caminhoLimpo
      .split("/")
      .filter(Boolean)
      .map(seg => encodeURIComponent(seg))
      .join("/")}`;

    const resp = await fetchGithubComTimeout(apiUrl, headers);

    if (resp.status === 403 || resp.status === 429) {
      const err = new Error("Limite de pedidos ao GitHub atingido temporariamente.");
      err.statusCode = 503;
      throw err;
    }

    if (resp.status === 404) {
      return [];
    }

    if (!resp.ok) {
      const err = new Error("Erro ao comunicar com o GitHub.");
      err.statusCode = 502;
      throw err;
    }

    const itens = await resp.json();
    if (!Array.isArray(itens)) return [];

    const itensValidos = itens.filter(item => item.name && !item.name.startsWith("."));

    const nos = await Promise.all(
      itensValidos.map(async (item) => {
        if (item.type === "dir") {
          const children = await listarRecursivo(item.path);
          return {
            name: item.name,
            path: item.path,
            type: "dir",
            children
          };
        }

        if (item.type === "file") {
          return {
            name: item.name,
            path: item.path,
            type: "file",
            size: item.size,
            url: montarUrlRaw(item.path),
            data: item.last_modified || new Date().toISOString()
          };
        }

        return null;
      })
    );

    return nos.filter(Boolean);
  }

  try {
    const children = await listarRecursivo(caminho);
    const payload = {
      path: caminho,
      type: "dir",
      children
    };

    cacheTrabalhosMemoria.set(caminho, { ts: agora, payload });
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=120");
    res.setHeader("X-Cache-Status", "MISS");
    return res.status(200).json(payload);
  } catch (error) {
    if (entradaCache?.payload) {
      res.setHeader("Cache-Control", "public, max-age=15, s-maxage=30");
      res.setHeader("X-Cache-Status", "STALE-FALLBACK");
      return res.status(200).json({
        ...entradaCache.payload,
        aviso: error.message || "A usar dados em cache por fallback."
      });
    }

    res.setHeader("Cache-Control", "no-store");
    const status = error && error.name === "AbortError" ? 504 : (error.statusCode || 500);
    return res.status(status).json({ error: error.message });
  }
}