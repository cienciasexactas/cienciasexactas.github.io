// ============================================================================
// MÓDULO DE GESTÃO DE TRABALHOS (trabalhos.js)
// - Lê a árvore real do GitHub via API (?caminho=www/Trabalhos/...)
// - Suporta apenas duas secções: "Trabalhos Individuais" e "Trabalhos de Grupo"
// - Barra superior em grelha: "Trabalhos individuais", "Trabalhos de Grupo", "Limpar Filtros"
// - Agrupa por Curso (#0d3b66 com sublinhado #d90429) e Ano Lectivo
// - Solicita código da turma ao clicar na pasta e mostra tabela detalhada
// ============================================================================

// Estado em memória da navegação e dos dados carregados
let arvoreCompleta = null;              // Guarda o objeto { path, type, children } devolvido pela API
let categoriaAtual = null;              // null | "Trabalhos Individuais" | "Trabalhos de Grupo"
let origemDadosAtual = "api";           // "api" | "cache"
let pastasDesbloqueadas = new Set();    // Guarda as chaves das pastas já autorizadas na sessão

// Endpoint da API (lê recursivamente o repositório cienciasexactas.github.io)
const API_TRABALHOS_URL = "https://api-cienciasexactas.vercel.app/api/trabalhos";
const RAW_GITHUB_BASE = "https://raw.githubusercontent.com/cienciasexactas/cienciasexactas.github.io/main/";

// Índices JSON estáticos gerados pelo GitHub Actions
const INDICE_ESTATICO_TRABALHOS = {
  "Trabalhos Individuais": "dados/trabalhos-individuais.json",
  "Trabalhos de Grupo": "dados/trabalhos-grupo.json"
};

// Configurações de cache com TTL e timeout de rede
const TTL_TRABALHOS_MS = 3 * 60 * 1000; // 3 minutos de validade do cache
const TIMEOUT_TRABALHOS_MS = 8000;     // 8 segundos de timeout para o fetch

// Códigos de acesso por curso (normalizados para comparação)
const CODIGOS_CURSOS_TRABALHOS = {
  "biologia": "L2BIO2026",
  "cienciasnaturais": "CNA2026",
  "matematica": "MAT2026",
  "economia": "L5ECO2026",
  "gestao-empresa": "GES2026",
  "gestao-iscgvsm": "ISC2026",
  "enfermagem-a": "ENFA2026",
  "enfermagem-b": "CHEFEKATIA123",
  "contabilidade": "CONT2026",
  "agronomia": "AGR2026",
  "turismo": "TUR2026",
  "geografia": "GEO2026",
  "educacao-infancia": "EDU2026"
};

// Nomes legíveis para pastas de curso caso o nome no GitHub venha em minúsculas ou com hífen
const NOMES_CURSOS = {
  "biologia": "Licenciatura em Biologia",
  "cienciasnaturais": "Licenciatura em Ensino Básico - C. N. Sociais",
  "matematica": "Licenciatura em Matemática",
  "economia": "Licenciatura em Economia",
  "gestao-empresa": "Licenciatura em Gestão de Empresa",
  "gestao-iscgvsm": "Licenciatura em Gestão - ISCSVSM",
  "enfermagem-a": "Licenciatura em Enfermagem - A",
  "enfermagem-b": "Licenciatura em Enfermagem - B",
  "contabilidade": "Licenciatura em Contabilidade",
  "agronomia": "Licenciatura em Agronomia",
  "turismo": "Licenciatura em Turismo",
  "geografia": "Licenciatura em Geografia",
  "educacao-infancia": "Licenciatura em Educação de Infância"
};

// Prefixos de ficheiros de apoio/modelo que ficam sempre no topo da tabela
const PREFIXOS_MODELO = ["Modelo_", "Template_", "Enunciado_", "Ficha_", "Lista_", "Base_", "Dados_"];

/**
 * Executa fetch com AbortController e timeout para evitar esperas infinitas.
 */
async function fetchTrabalhosComTimeout(url, options = {}, timeoutMs = TIMEOUT_TRABALHOS_MS) {
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

/**
 * Localiza o elemento HTML onde a interface de trabalhos será renderizada.
 */
function obterContainerTrabalhos() {
  return (
    document.getElementById("trabalhos-praticos-container") ||
    document.getElementById("lista-trabalhos-container") ||
    document.getElementById("trabalhos-lista") ||
    document.getElementById("lista-colaborativos-container") ||
    document.getElementById("lista-grupo-container")
  );
}

/**
 * Normaliza chaves (ex: "Gestão de Empresa" -> "gestao-empresa") para cruzar com códigos e nomes.
 */
function normalizarChave(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Formata o nome do curso mantendo o texto original se já vier formatado (ex: "Economia").
 */
function formatarNomeCurso(nomePastaCurso) {
  const chave = normalizarChave(nomePastaCurso);
  if (NOMES_CURSOS[chave] && nomePastaCurso === chave) {
    return NOMES_CURSOS[chave];
  }
  return String(nomePastaCurso || "").replace(/_/g, " ");
}

/**
 * Codifica cada segmento do caminho para URLs do raw.githubusercontent.com.
 */
function codificarCaminhoRaw(caminho) {
  return String(caminho || "")
    .split("/")
    .filter(Boolean)
    .map(seg => encodeURIComponent(seg))
    .join("/");
}

/**
 * Formata bytes para KB, MB ou GB.
 */
function formatarTamanhoArquivo(bytes) {
  if (typeof formatarTamanho === "function") return formatarTamanho(bytes);
  const num = Number(bytes || 0);
  if (!num) return "0 Bytes";
  const k = 1024;
  const unidades = ["Bytes", "KB", "MB", "GB"];
  const idx = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, idx)).toFixed(2)) + " " + unidades[idx];
}

/**
 * Formata datas no padrão pt-PT.
 */
function formatarDataArquivo(dataStr) {
  if (typeof formatarData === "function") return formatarData(dataStr);
  if (!dataStr) return "N/A";
  const d = new Date(dataStr);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

/**
 * Ordena ficheiros: modelos/apoio primeiro e os restantes por data decrescente.
 */
function ordenarFicheirosTabela(lista) {
  if (typeof ordenarFicheiros === "function") return ordenarFicheiros([...lista]);
  return [...lista].sort((a, b) => {
    const aMod = PREFIXOS_MODELO.some(p => a.name && a.name.startsWith(p));
    const bMod = PREFIXOS_MODELO.some(p => b.name && b.name.startsWith(p));
    if (aMod && !bMod) return -1;
    if (!aMod && bMod) return 1;
    const tA = a.data ? new Date(a.data).getTime() : 0;
    const tB = b.data ? new Date(b.data).getTime() : 0;
    return tB - tA;
  });
}

/**
 * Persiste a árvore recebida da API em localStorage e sessionStorage.
 */
function guardarCacheCategoria(categoria, dados) {
  const payload = JSON.stringify({ timestamp: Date.now(), dados });
  try { localStorage.setItem(`trabalhos_cache_${categoria}`, payload); } catch (_) { }
  try { sessionStorage.setItem(`trabalhos_sess_${categoria}`, payload); } catch (_) { }
}

/**
 * Lê a árvore em cache caso exista. Se `apenasValidos` for true, respeita o TTL.
 */
function lerCacheCategoria(categoria, apenasValidos = false, ttlMs = TTL_TRABALHOS_MS) {
  for (const ler of [
    () => { try { return localStorage.getItem(`trabalhos_cache_${categoria}`); } catch (_) { return null; } },
    () => { try { return sessionStorage.getItem(`trabalhos_sess_${categoria}`); } catch (_) { return null; } }
  ]) {
    const raw = ler();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.dados) continue;
      if (apenasValidos) {
        const ts = Number(parsed.timestamp || 0);
        if (!ts || (Date.now() - ts) > ttlMs) continue;
      }
      return parsed.dados;
    } catch (_) { }
  }
  return null;
}

/**
 * Apaga o cache guardado da categoria.
 */
function limparCacheCategoria(categoria) {
  try { localStorage.removeItem(`trabalhos_cache_${categoria}`); } catch (_) { }
  try { sessionStorage.removeItem(`trabalhos_sess_${categoria}`); } catch (_) { }
}

/**
 * Coleta todos os ficheiros de um nó de pasta recursivamente (ignorando .gitkeep e ficheiros ocultos).
 */
function coletarFicheirosRecursivos(no) {
  const resultado = [];
  if (!no || !Array.isArray(no.children)) return resultado;

  for (const filho of no.children) {
    if (!filho.name || filho.name.startsWith(".")) continue;
    if (filho.type === "file") {
      resultado.push(filho);
    } else if (filho.type === "dir") {
      resultado.push(...coletarFicheirosRecursivos(filho));
    }
  }
  return resultado;
}

/**
 * Transforma a árvore { children: [ <curso> -> [ <ano> -> [ <pastas/ficheiros> ] ] ] }
 * em blocos estruturados por Curso, Ano Lectivo e Pastas clicáveis.
 */
function extrairBlocosCursoAnoPastas(arvore, categoria) {
  const cursosNos = Array.isArray(arvore?.children)
    ? arvore.children.filter(n => n.type === "dir" && n.name && !n.name.startsWith("."))
    : [];

  const blocos = [];

  for (const noCurso of cursosNos) {
    const anosNos = Array.isArray(noCurso.children)
      ? noCurso.children.filter(n => n.type === "dir" && n.name && !n.name.startsWith("."))
      : [];

    for (const noAno of anosNos) {
      const pastas = [];
      const ficheirosDiretosNoAno = [];

      for (const item of (noAno.children || [])) {
        if (!item.name || item.name.startsWith(".")) continue;

        if (item.type === "dir") {
          // Cada subpasta dentro do ano letivo (ex: Trabalho_1) vira um cartão de pasta
          pastas.push({
            id: item.name,
            nome: item.name.replace(/_/g, " "),
            ficheiros: coletarFicheirosRecursivos(item)
          });
        } else if (item.type === "file") {
          ficheirosDiretosNoAno.push(item);
        }
      }

      // Se houver ficheiros soltos diretamente na pasta do ano letivo, agrupa num cartão próprio
      if (ficheirosDiretosNoAno.length > 0) {
        pastas.unshift({
          id: "_ano_direto",
          nome: categoria === "Trabalhos Individuais" ? "Trabalho Individual" : "Trabalho de Grupo",
          ficheiros: ficheirosDiretosNoAno
        });
      }

      if (pastas.length > 0) {
        blocos.push({
          cursoRaw: noCurso.name,
          cursoChave: normalizarChave(noCurso.name),
          cursoNome: formatarNomeCurso(noCurso.name),
          ano: noAno.name,
          pastas
        });
      }
    }
  }

  return blocos;
}

/**
 * Renderiza a grelha superior com os três botões solicitados.
 */
function renderizarSeletorTopoHtml() {
  const ativoIndividual = categoriaAtual === "Trabalhos Individuais";
  const ativoGrupo = categoriaAtual === "Trabalhos de Grupo";

  return `
    <div id="seletor-tipo-trabalhos" style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; margin-bottom:20px;">
      <button type="button"
              onclick="selecionarTipoTrabalho('Trabalhos Individuais')"
              style="padding:12px 14px; border-radius:8px; font-weight:700; font-size:0.95rem; cursor:pointer; transition:all 0.2s ease; border:2px solid ${ativoIndividual ? "#0d3b66" : "#ced4da"}; background:${ativoIndividual ? "#0d3b66" : "#f8f9fa"}; color:${ativoIndividual ? "#ffffff" : "#0d3b66"};">
        Trabalhos individuais
      </button>

      <button type="button"
              onclick="selecionarTipoTrabalho('Trabalhos de Grupo')"
              style="padding:12px 14px; border-radius:8px; font-weight:700; font-size:0.95rem; cursor:pointer; transition:all 0.2s ease; border:2px solid ${ativoGrupo ? "#0d3b66" : "#ced4da"}; background:${ativoGrupo ? "#0d3b66" : "#f8f9fa"}; color:${ativoGrupo ? "#ffffff" : "#0d3b66"};">
        Trabalhos de Grupo
      </button>

      <button type="button"
              onclick="limparFiltrosTrabalhos()"
              style="padding:12px 14px; border-radius:8px; font-weight:700; font-size:0.95rem; cursor:pointer; transition:all 0.2s ease; border:2px solid #d90429; background:#ffffff; color:#d90429;">
        Limpar Filtros
      </button>
    </div>
  `;
}

/**
 * Busca os dados reais no GitHub pela API passando ?caminho=www/Trabalhos/<categoria>
 * com cache TTL, timeout via AbortController e fallback seguro.
 */
async function carregarArvoreTrabalhos(forcarAtualizacao = false) {
  const container = obterContainerTrabalhos();
  if (!container) return;

  if (!categoriaAtual) {
    renderizarExploradorTrabalhos();
    return;
  }

  if (!forcarAtualizacao) {
    const cacheValido = lerCacheCategoria(categoriaAtual, true, TTL_TRABALHOS_MS);
    if (cacheValido) {
      arvoreCompleta = cacheValido;
      origemDadosAtual = "cache";
      renderizarExploradorTrabalhos();
      return;
    }
  }

  container.innerHTML = `
    ${renderizarSeletorTopoHtml()}
    <p style="color:#555; padding:12px 0;">A carregar pastas de <b>${categoriaAtual}</b> no GitHub...</p>
  `;

  try {
    const caminhoApi = `www/Trabalhos/${categoriaAtual}`;
    const url = `${API_TRABALHOS_URL}?caminho=${encodeURIComponent(caminhoApi)}${forcarAtualizacao ? "&t=" + Date.now() : ""}`;
    const resp = await fetchTrabalhosComTimeout(url, {}, TIMEOUT_TRABALHOS_MS);
    const dados = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      throw new Error(dados.error || `Erro HTTP ${resp.status}`);
    }

    arvoreCompleta = dados;
    origemDadosAtual = "api";
    guardarCacheCategoria(categoriaAtual, dados);
    renderizarExploradorTrabalhos();
  } catch (erro) {
    const detalheErro = erro && erro.name === "AbortError"
      ? "Tempo limite excedido (timeout) ao contactar o servidor."
      : (erro.message || "Falha na ligação.");

    // Fallback: usa qualquer cache disponível (mesmo que tenha expirado o TTL)
    const cacheFallback = lerCacheCategoria(categoriaAtual, false);
    if (cacheFallback) {
      arvoreCompleta = cacheFallback;
      origemDadosAtual = "cache";
      renderizarExploradorTrabalhos(`Fallback de cache: ${detalheErro}`);
      return;
    }

    arvoreCompleta = { path: `www/Trabalhos/${categoriaAtual}`, type: "dir", children: [] };
    origemDadosAtual = "api";
    renderizarExploradorTrabalhos(detalheErro);
  }
}

/**
 * Renderiza a grelha agrupada por Curso, Ano Lectivo e Pastas clicáveis.
 */
function renderizarExploradorTrabalhos(avisoErro = "") {
  const container = obterContainerTrabalhos();
  if (!container) return;

  let html = renderizarSeletorTopoHtml();

  if (!categoriaAtual) {
    html += `
      <p style="color:#6c757d; font-style:italic; margin-top:10px;">
        Selecione <strong>Trabalhos individuais</strong> ou <strong>Trabalhos de Grupo</strong> no topo para visualizar as pastas.
      </p>
    `;
    container.innerHTML = html;
    return;
  }

  if (origemDadosAtual === "cache") {
    html += `
      <div style="padding:8px 12px; margin-bottom:14px; background:#fffbeb; border:1px solid #fcd34d; color:#92400e; border-radius:6px; font-size:0.88rem;">
        💾 <b>Cache ativa:</b> A mostrar a estrutura guardada do GitHub.${avisoErro ? ` (${avisoErro})` : ""}
        <button type="button" onclick="forcarRecargaTrabalhos()" style="margin-left:8px; padding:3px 8px; cursor:pointer;">Atualizar</button>
      </div>
    `;
  } else if (avisoErro) {
    html += `
      <div style="padding:8px 12px; margin-bottom:14px; background:#fef2f2; border:1px solid #fca5a5; color:#991b1b; border-radius:6px; font-size:0.88rem;">
        ⚠️ ${avisoErro}
        <button type="button" onclick="forcarRecargaTrabalhos()" style="margin-left:8px; padding:3px 8px; cursor:pointer;">Tentar novamente</button>
      </div>
    `;
  }

  const blocos = extrairBlocosCursoAnoPastas(arvoreCompleta, categoriaAtual);

  // Agrupa por curso mantendo a ordem encontrada no repositório
  const mapaCursos = new Map();
  for (const bloco of blocos) {
    if (!mapaCursos.has(bloco.cursoRaw)) {
      mapaCursos.set(bloco.cursoRaw, {
        cursoRaw: bloco.cursoRaw,
        cursoChave: bloco.cursoChave,
        cursoNome: bloco.cursoNome,
        anos: []
      });
    }
    mapaCursos.get(bloco.cursoRaw).anos.push(bloco);
  }

  if (mapaCursos.size === 0) {
    html += `<p style="color:#666; font-style:italic; margin-top:15px;">Nenhuma pasta encontrada em <strong>${categoriaAtual}</strong> no GitHub.</p>`;
    container.innerHTML = html;
    return;
  }

  for (const curso of mapaCursos.values()) {
    html += `<div style="margin-top:32px; margin-bottom:20px; display:block; clear:both;">`;
    html += `<h3 style="font-size:1.3rem; color:#0d3b66; margin-bottom:15px; display:block; border-bottom:2px solid #d90429; padding-bottom:5px;">Curso: ${curso.cursoNome}</h3>`;

    for (const blocoAno of curso.anos) {
      html += `<div style="margin-left:20px; margin-bottom:25px; display:block; clear:both;">`;
      html += `<p style="font-size:1rem; color:#333; margin:10px 0;"><strong>Ano Lectivo:</strong> ${blocoAno.ano}</p>`;
      html += `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:12px; margin-top:10px; margin-bottom:15px;">`;

      for (const pasta of blocoAno.pastas) {
        const chavePasta = `${categoriaAtual}|${curso.cursoRaw}|${blocoAno.ano}|${pasta.id}`;
        html += `
          <div onclick="solicitarCodigoEAbrirPasta('${chavePasta.replace(/'/g, "\\'")}')"
               onmouseover="this.style.background='#e2e6ea'"
               onmouseout="this.style.background='#f8f9fa'"
               style="background:#f8f9fa; border:1px solid #ced4da; padding:15px; border-radius:8px; cursor:pointer; text-align:center; transition:background 0.2s; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div style="font-size:1.8rem; margin-bottom:8px; line-height:1;">📁</div>
            <div style="color:#0d3b66; margin:0 0 5px 0; font-size:1rem; font-weight:bold;">${pasta.nome}</div>
            <span style="font-size:0.75rem; color:#6c757d;">Aceder com código da Turma</span>
          </div>
        `;
      }

      html += `</div></div>`;
    }

    html += `</div>`;
  }

  container.innerHTML = html;
}

/**
 * Renderiza a tabela de ficheiros de uma pasta após validação do código.
 */
function renderizarTabelaPastaAberta(chavePasta) {
  const container = obterContainerTrabalhos();
  if (!container) return;

  const [cat, cursoRaw, ano, pastaId] = chavePasta.split("|");
  const blocos = extrairBlocosCursoAnoPastas(arvoreCompleta, cat);
  const blocoAno = blocos.find(b => b.cursoRaw === cursoRaw && b.ano === ano);
  const pasta = blocoAno?.pastas?.find(p => p.id === pastaId);
  const cursoNome = blocoAno?.cursoNome || formatarNomeCurso(cursoRaw);
  const nomePasta = pasta?.nome || pastaId;
  const ficheiros = ordenarFicheirosTabela(pasta?.ficheiros || []);

  let html = renderizarSeletorTopoHtml();

  html += `
    <button type="button" onclick="voltarParaGrelhaPastas()"
            style="margin-bottom:15px; padding:8px 12px; background:#6c757d; color:white; border:none; border-radius:4px; cursor:pointer;">
      ← Voltar às Pastas
    </button>
    <h3 style="color:#0d3b66; font-size:1.3rem; margin-bottom:15px; border-bottom:2px solid #d90429; padding-bottom:5px;">Curso: ${cursoNome}</h3>
    <p style="font-size:1rem; color:#333; margin:10px 0;"><strong>Ano Lectivo:</strong> ${ano} | <strong>Pasta:</strong> ${nomePasta}</p>
  `;

  if (ficheiros.length === 0) {
    html += `<p style="color:#666; font-style:italic; margin-top:15px;">Nenhum ficheiro encontrado nesta pasta.</p>`;
    container.innerHTML = html;
    return;
  }

  html += `
    <div style="width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; margin-top:5px;">
      <table style="width:100%; min-width:500px; border-collapse:collapse; display:table !important;">
        <thead>
          <tr style="background-color:#f8f9fa; border-bottom:2px solid #dee2e6; text-align:left;">
            <th style="padding:10px; width:60%; white-space:nowrap;">Nome / Referência</th>
            <th style="padding:10px; width:20%; white-space:nowrap;">Data de Envio</th>
            <th style="padding:10px; width:20%; white-space:nowrap;">Tamanho</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const item of ficheiros) {
    const isModelo = PREFIXOS_MODELO.some(p => item.name && item.name.startsWith(p));
    const urlItem = item.url || (RAW_GITHUB_BASE + codificarCaminhoRaw(item.path));

    const colNome = isModelo
      ? `<span style="background:#e2f0d9; color:#385723; padding:2px 6px; border-radius:4px; font-size:0.85em; font-weight:bold; margin-right:6px;">Modelo</span> <a href="${urlItem}" target="_blank" rel="noopener noreferrer" style="color:#0066cc; font-weight:bold; text-decoration:underline;">${item.name}</a>`
      : `<a href="${urlItem}" target="_blank" rel="noopener noreferrer" style="color:#0066cc; text-decoration:underline;">${item.name}</a>`;

    html += `
      <tr style="border-bottom:1px solid #e9ecef;">
        <td style="padding:10px; word-break:break-word;">${colNome}</td>
        <td style="padding:10px; color:#555; white-space:nowrap;">${isModelo ? "Ficheiro de Apoio" : formatarDataArquivo(item.data)}</td>
        <td style="padding:10px; color:#555; white-space:nowrap;">${formatarTamanhoArquivo(item.size)}</td>
      </tr>
    `;
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// Seleciona uma das duas secções ("Trabalhos Individuais" ou "Trabalhos de Grupo")
window.selecionarTipoTrabalho = function (tipo) {
  if (tipo !== "Trabalhos Individuais" && tipo !== "Trabalhos de Grupo") return;
  categoriaAtual = tipo;
  carregarArvoreTrabalhos(false);
};

// Limpa o filtro ativo e regressa ao estado inicial do seletor
window.limparFiltrosTrabalhos = function () {
  categoriaAtual = null;
  arvoreCompleta = null;
  renderizarExploradorTrabalhos();
};

// Solicita o código da turma antes de abrir o conteúdo da pasta
window.solicitarCodigoEAbrirPasta = function (chavePasta) {
  const [, cursoRaw, ano, pastaId] = chavePasta.split("|");
  const chaveCurso = normalizarChave(cursoRaw);
  const codigoEsperado = CODIGOS_CURSOS_TRABALHOS[chaveCurso];

  if (!pastasDesbloqueadas.has(chavePasta) && codigoEsperado) {
    const codigoInformado = prompt(`Introduza o código de acesso para visualizar (${formatarNomeCurso(cursoRaw)} - ${ano}):`);
    if (codigoInformado === null) return;
    if (codigoInformado.trim() !== codigoEsperado) {
      return alert("Código de acesso incorreto! Acesso negado.");
    }
    pastasDesbloqueadas.add(chavePasta);
  }

  renderizarTabelaPastaAberta(chavePasta);
};

// Volta da tabela de ficheiros para a grelha de pastas da secção atual
window.voltarParaGrelhaPastas = function () {
  renderizarExploradorTrabalhos();
};

// Limpa o cache da secção ativa e força nova consulta à API
window.forcarRecargaTrabalhos = function () {
  if (!categoriaAtual) return;
  limparCacheCategoria(categoriaAtual);
  carregarArvoreTrabalhos(true);
};

// Ponto de entrada externo com as duas chaves exatas
window.inicializarTrabalhos = function (catInicial) {
  const mapa = {
    "Trabalhos individuais": "Trabalhos Individuais",
    "Trabalhos de Grupo": "Trabalhos de Grupo"
  };

  if (catInicial && mapa[catInicial]) {
    categoriaAtual = mapa[catInicial];
    carregarArvoreTrabalhos(false);
  } else {
    renderizarExploradorTrabalhos();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  if (obterContainerTrabalhos()) {
    renderizarExploradorTrabalhos();
  }
});