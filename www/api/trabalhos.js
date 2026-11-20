export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  if (req.method === "OPTIONS") return res.status(200).end();

  const caminho = String(req.query.caminho || "www/Trabalhos").replace(/^\/+|\/+$/g, "");
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const REPO_OWNER = "cienciasexactas";
  const REPO_NAME = "cienciasexactas.github.io";

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

    const resp = await fetch(apiUrl, { headers });

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

    const nos = [];
    for (const item of itens) {
      if (!item.name || item.name.startsWith(".")) continue;

      if (item.type === "dir") {
        const children = await listarRecursivo(item.path);
        nos.push({
          name: item.name,
          path: item.path,
          type: "dir",
          children
        });
      } else if (item.type === "file") {
        nos.push({
          name: item.name,
          path: item.path,
          type: "file",
          size: item.size,
          url: montarUrlRaw(item.path),
          data: item.last_modified || new Date().toISOString()
        });
      }
    }

    return nos;
  }

  try {
    const children = await listarRecursivo(caminho);
    return res.status(200).json({
      path: caminho,
      type: "dir",
      children
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({ error: error.message });
  }
}