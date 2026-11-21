const fs = require("fs");
const path = require("path");

const RAIZ = process.cwd();
const DIR_WWW = fs.existsSync(path.join(RAIZ, "www")) ? path.join(RAIZ, "www") : RAIZ;
const PASTA_DADOS = path.join(DIR_WWW, "dados");

const ALVOS = [
  {
    categoria: "Trabalhos Individuais",
    pastaRelativa: "www/Trabalhos/Trabalhos Individuais",
    ficheiroSaida: "trabalhos-individuais.json"
  },
  {
    categoria: "Trabalhos de Grupo",
    pastaRelativa: "www/Trabalhos/Trabalhos de Grupo",
    ficheiroSaida: "trabalhos-grupo.json"
  }
];

function construirNoArvore(dirAbsoluto, caminhoRelativo) {
  const nome = path.basename(caminhoRelativo);
  const stats = fs.statSync(dirAbsoluto);

  if (stats.isFile()) {
    return {
      name: nome,
      type: "file",
      path: caminhoRelativo.replace(/\\/g, "/"),
      size: stats.size,
      data: stats.mtime.toISOString()
    };
  }

  const children = [];
  const itens = fs.readdirSync(dirAbsoluto, { withFileTypes: true })
    .filter(item => !item.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name, "pt"));

  for (const item of itens) {
    const filhoAbs = path.join(dirAbsoluto, item.name);
    const filhoRel = path.join(caminhoRelativo, item.name).replace(/\\/g, "/");
    children.push(construirNoArvore(filhoAbs, filhoRel));
  }

  return {
    name: nome,
    type: "dir",
    path: caminhoRelativo.replace(/\\/g, "/"),
    children
  };
}

function gerarIndices() {
  fs.mkdirSync(PASTA_DADOS, { recursive: true });

  for (const alvo of ALVOS) {
    const abs = path.join(RAIZ, alvo.pastaRelativa);
    const arvore = fs.existsSync(abs)
      ? construirNoArvore(abs, alvo.pastaRelativa)
      : { name: alvo.categoria, type: "dir", path: alvo.pastaRelativa, children: [] };

    const destino = path.join(PASTA_DADOS, alvo.ficheiroSaida);
    fs.writeFileSync(destino, JSON.stringify(arvore, null, 2), "utf8");
    console.log(`Gerado: ${destino}`);
  }
}

gerarIndices();