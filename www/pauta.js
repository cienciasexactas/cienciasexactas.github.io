// ================= SCRIPT COMPLETO, INTEGRADO E CORRIGIDO (pauta.js) =================

// --- Integração de Cache com TTL e Fetch com Timeout (AbortController) ---
const PAUTA_API_URL_INTEGRADA = 'https://api-cienciasexactas.vercel.app/api/pauta';
const TTL_PAUTA_INTEGRADO_MS = 3 * 60 * 1000; // 3 minutos de validade em cache
const TIMEOUT_PAUTA_INTEGRADO_MS = 8000;      // 8 segundos de timeout por pedido

function lerCachePautaIntegrado(chave, ttlMs = TTL_PAUTA_INTEGRADO_MS) {
    try {
        const raw = localStorage.getItem(chave) || sessionStorage.getItem(chave);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !('dados' in parsed)) return null;
        const ts = Number(parsed.ts || 0);
        return {
            dados: parsed.dados,
            ts,
            valido: ts > 0 && (Date.now() - ts) <= ttlMs
        };
    } catch (e) {
        return null;
    }
}

function guardarCachePautaIntegrado(chave, dados) {
    const envelope = JSON.stringify({ ts: Date.now(), dados });
    try { localStorage.setItem(chave, envelope); } catch (e) { }
    try { sessionStorage.setItem(chave, envelope); } catch (e) { }
}

async function fetchPautaIntegradoComTimeout(url, options = {}, timeoutMs = TIMEOUT_PAUTA_INTEGRADO_MS) {
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

function exibirAvisoFallbackPautaIntegrado(mensagem = '') {
    const alvo = document.getElementById('vista-docente') || document.body;
    let banner = document.getElementById('aviso-fallback-pauta-integrado');
    if (!mensagem) {
        if (banner) banner.remove();
        return;
    }
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'aviso-fallback-pauta-integrado';
        banner.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:6px;background:#fff8e1;color:#664d03;border:1px solid #ffecb5;font-size:0.9rem;';
        alvo.prepend(banner);
    }
    banner.textContent = mensagem;
}

let pautaEstado = {
    utilizadorAtual: null,
    estudantes: [],
    planilhasColunasPorCadeira: {},
    percentagens: {}
};

// ================= FILTRO GLOBAL POR UNIDADE CURRICULAR (U.C.) =================
const PAUTA_UC_TODAS = '__TODAS__';

function obterFiltroUCGlobal() {
    const el = document.getElementById('docente-uc-global');
    return el ? el.value : PAUTA_UC_TODAS;
}

function isTodasUCSelecionada() {
    const val = obterFiltroUCGlobal();
    return !val || val === PAUTA_UC_TODAS;
}

function estudanteCorrespondeUCGlobal(est) {
    const ucFiltro = obterFiltroUCGlobal();
    if (!ucFiltro || ucFiltro === PAUTA_UC_TODAS) return true;
    const ucEst = String(est.cadeira || 'Geral').trim();
    return ucEst.toLowerCase() === String(ucFiltro).trim().toLowerCase();
}

function obterListaUCsCursoAno(cursoSel, anoSel) {
    const setUCs = new Map();
    const cursoNorm = String(cursoSel || '').trim().toLowerCase();
    const anoNorm = String(anoSel || '').trim().toLowerCase();

    (pautaEstado.estudantes || []).forEach(e => {
        const mesmoCurso = !cursoNorm || String(e.curso || '').trim().toLowerCase() === cursoNorm;
        const mesmoAno = !anoNorm || !e.ano || String(e.ano || '').trim().toLowerCase() === anoNorm;
        if (mesmoCurso && mesmoAno) {
            const uc = String(e.cadeira || 'Geral').trim() || 'Geral';
            const chave = uc.toLowerCase();
            if (!setUCs.has(chave)) setUCs.set(chave, uc);
        }
    });

    Object.keys(pautaEstado.planilhasColunasPorCadeira || {}).forEach(cid => {
        const partes = String(cid).split('_');
        if (partes.length >= 3) {
            const cCid = partes[0];
            const aCid = partes[1];
            const ucCid = partes.slice(2).join('_');
            if ((!cursoNorm || cCid === cursoNorm.replace(/\s+/g, '_')) &&
                (!anoNorm || aCid === anoNorm.replace(/\s+/g, '_'))) {
                const existente = Array.from(setUCs.values()).find(x => x.toLowerCase().replace(/\s+/g, '_') === ucCid);
                const nomeExibir = existente || ucCid.replace(/_/g, ' ');
                const chave = nomeExibir.toLowerCase();
                if (!setUCs.has(chave)) setUCs.set(chave, nomeExibir);
            }
        }
    });

    return Array.from(setUCs.values()).sort((a, b) => a.localeCompare(b, 'pt'));
}

function obterUCParaPlanilhas(cursoSel, anoSel) {
    const ucGlobal = obterFiltroUCGlobal();
    if (ucGlobal && ucGlobal !== PAUTA_UC_TODAS) {
        return ucGlobal;
    }
    const ucsDisponiveis = obterListaUCsCursoAno(cursoSel, anoSel);
    return ucsDisponiveis.length > 0 ? ucsDisponiveis[0] : "Geral";
}

function atualizarBarraControle4Colunas() {
    const selectAcao = document.getElementById('docente-acao-select');
    const selectCurso = document.getElementById('docente-curso-global');
    const selectAno = document.getElementById('docente-ano-global');
    if (!selectAcao || !selectCurso || !selectAno) return;

    const barra = selectAcao.closest('.pauta-form-row, .pauta-grid-3col, .pauta-grid-4col') || selectAno.parentElement?.parentElement;
    if (!barra) return;

    let grupoUC = document.getElementById('docente-grupo-uc-global');
    if (!grupoUC) {
        grupoUC = document.createElement('div');
        grupoUC.id = 'docente-grupo-uc-global';
        grupoUC.className = selectAno.parentElement?.className || 'pauta-form-group';
        grupoUC.innerHTML = `
            <label for="docente-uc-global">Unidade Curricular (U.C.):</label>
            <select id="docente-uc-global" class="pauta-input">
                <option value="${PAUTA_UC_TODAS}" selected>Todas as U.C.</option>
            </select>
        `;
        if (selectAno.parentElement && selectAno.parentElement.parentElement === barra) {
            selectAno.parentElement.insertAdjacentElement('afterend', grupoUC);
        } else {
            barra.appendChild(grupoUC);
        }

        const selectUCNovo = document.getElementById('docente-uc-global');
        selectUCNovo.addEventListener('change', () => {
            const acaoAtual = selectAcao.value;
            if (acaoAtual === 'visualizar') {
                recarregarDadosDocente();
            } else if (acaoAtual === 'criar-estudante') {
                const inputCadeira = document.getElementById('ce-cadeira');
                if (inputCadeira && !isTodasUCSelecionada()) {
                    inputCadeira.value = obterFiltroUCGlobal();
                }
                recarregarDadosDocente();
            } else if (acaoAtual === 'actualizar') {
                controlarCamposAtualizacao();
                recarregarDadosDocente();
            } else if (acaoAtual === 'planilha') {
                atualizarSelectCadeirasGestaoPlanilhas();
                carregarColunasDaPlanilha();
                recarregarDadosDocente();
            } else if (acaoAtual === 'percentagens') {
                const selPercUC = document.getElementById('pauta3-select-uc-perc');
                if (selPercUC && !isTodasUCSelecionada()) {
                    const ucSel = obterFiltroUCGlobal();
                    if (Array.from(selPercUC.options).some(o => o.value === ucSel)) {
                        selPercUC.value = ucSel;
                        carregarPercentagensPorUCSelecionada();
                    }
                }
                recarregarDadosDocente();
            } else {
                recarregarDadosDocente();
            }
        });
    }

    const selectUC = document.getElementById('docente-uc-global');
    const acao = selectAcao.value;
    const cursoSel = selectCurso.value;
    const anoSel = selectAno.value;

    // No modo "Configurar % (Nota)" ('percentagens') mantém 3 colunas pois já existe seletor de U.C. dentro do bloco de ponderação
    const acoesComFiltroUC = ['visualizar', 'criar-estudante', 'actualizar', 'planilha'];
    const mostrarQuartaColuna = acoesComFiltroUC.includes(acao) && Boolean(cursoSel && anoSel);

    if (mostrarQuartaColuna) {
        grupoUC.style.display = '';
        barra.style.display = 'grid';
        barra.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
        barra.style.gap = '16px';
        barra.style.alignItems = 'end';

        const valorAnterior = selectUC.value || PAUTA_UC_TODAS;
        const ucsDisponiveis = obterListaUCsCursoAno(cursoSel, anoSel);

        selectUC.innerHTML = `<option value="${PAUTA_UC_TODAS}">Todas as U.C.</option>`;
        ucsDisponiveis.forEach(uc => {
            selectUC.innerHTML += `<option value="${uc}">${uc}</option>`;
        });

        if (valorAnterior === PAUTA_UC_TODAS || Array.from(selectUC.options).some(o => o.value === valorAnterior)) {
            selectUC.value = valorAnterior;
        } else {
            selectUC.value = PAUTA_UC_TODAS;
        }

        if (acao === 'criar-estudante') {
            const inputCadeira = document.getElementById('ce-cadeira');
            if (inputCadeira && !isTodasUCSelecionada() && !inputCadeira.value.trim()) {
                inputCadeira.value = obterFiltroUCGlobal();
            }
        }
    } else {
        grupoUC.style.display = 'none';
        barra.style.display = '';
        barra.style.gridTemplateColumns = '';
        barra.style.gap = '';
        barra.style.alignItems = '';
    }
}

// Obter colunas da planilha isoladas estritamente por Curso, Ano e Cadeira (U.C.)
function obterColunasCadeira(curso, ano, cadeira, categoria) {
    const cursoKey = curso ? String(curso).trim().toLowerCase() : "geral";
    const anoKey = ano ? String(ano).trim().toLowerCase() : "geral";
    const cadeiraKey = cadeira ? String(cadeira).trim().toLowerCase() : "geral";

    const cid = `${cursoKey}_${anoKey}_${cadeiraKey}`.replace(/\s+/g, '_');

    if (!pautaEstado.planilhasColunasPorCadeira[cid]) {
        pautaEstado.planilhasColunasPorCadeira[cid] = {
            "Presenças": [],
            "Trabalhos Individuais": [],
            "Trabalhos de Grupo": []
        };
    }
    return pautaEstado.planilhasColunasPorCadeira[cid][categoria] || [];
}

// Obter percentagens configuradas
function obterPercentagens(curso, ano, cadeira) {
    const cursoKey = curso ? String(curso).trim().toLowerCase() : "geral";
    const anoKey = ano ? String(ano).trim().toLowerCase() : "geral";
    const cadeiraKey = cadeira ? String(cadeira).trim().toLowerCase() : "geral";
    const chave = `${cursoKey}_${anoKey}_${cadeiraKey}`.replace(/\s+/g, '_');

    if (pautaEstado.percentagens && pautaEstado.percentagens[chave]) {
        return pautaEstado.percentagens[chave];
    }
    return { presenca: 0.1, testes: 0.5, trabInd: 0.2, trabGrp: 0.2 };
}

// Auxiliar para parse de notas numéricas
function parseNota(valor) {
    if (valor === undefined || valor === null) return null;
    const str = String(valor).trim();
    if (str === "" || str === "---" || str === "-") return null;
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
}

function formatarNota(val) {
    if (val === "P" || val === "F") return val;
    const parsed = parseNota(val);
    return parsed !== null ? val : "---";
}

// CÁLCULO DA MÉDIA DE TRABALHOS
function calcularMediaTrabalhos(est, categoria, cursoOverride = null) {
    const curso = cursoOverride || est.curso || "Geral";
    const ano = est.ano || "2025-2026";
    const cadeira = est.cadeira || "Geral";

    const colunas = obterColunasCadeira(curso, ano, cadeira, categoria);
    if (colunas.length === 0) return null;

    let soma = 0;
    let contador = 0;
    const prefixo = categoria === "Trabalhos Individuais" ? "indiv_" : "grp_";

    colunas.forEach(col => {
        const chaveKey = prefixo + col;
        const val = est.subNotas && est.subNotas[chaveKey] !== undefined ? est.subNotas[chaveKey] : null;
        const nota = parseNota(val);
        if (nota !== null) {
            soma += nota;
            contador++;
        }
    });

    if (contador === 0) return null;
    return parseFloat((soma / contador).toFixed(2));
}

// CÁLCULO DE PRESENÇAS BASEADO EM P e F
function calcularNotaPresenca(est, cursoOverride = null) {
    const curso = cursoOverride || est.curso || "Geral";
    const ano = est.ano || "2025-2026";
    const cadeira = est.cadeira || "Geral";

    const colunas = obterColunasCadeira(curso, ano, cadeira, "Presenças");
    if (colunas.length === 0) {
        return parseNota(est.presenca);
    }

    let numP = 0;
    let numF = 0;

    colunas.forEach(col => {
        const chaveKey = "pres_" + col;
        const val = est.subNotas && est.subNotas[chaveKey] !== undefined ? est.subNotas[chaveKey] : null;
        if (val !== undefined && val !== null) {
            const str = String(val).trim().toUpperCase();
            if (str === "P") numP++;
            else if (str === "F") numF++;
        }
    });

    const total = numP + numF;
    if (total === 0) return null;

    const notaCalculada = (numP / total) * 20;
    return parseFloat(notaCalculada.toFixed(2));
}

// FÓRMULA DE CÁLCULO PONDERADO E SITUAÇÃO ACADÉMICA
function calcularSituacaoEstudante(est, cursoOverride = null) {
    const mediaTrabInd = calcularMediaTrabalhos(est, "Trabalhos Individuais", cursoOverride);
    const mediaTrabGrp = calcularMediaTrabalhos(est, "Trabalhos de Grupo", cursoOverride);
    const notaPresencaCalc = calcularNotaPresenca(est, cursoOverride);

    const camposNotas = ['teste1', 'teste2', 'exame', 'notaProf'];
    const temAlgumaNota = camposNotas.some(campo => parseNota(est[campo]) !== null) || mediaTrabInd !== null || mediaTrabGrp !== null || notaPresencaCalc !== null;

    if (!temAlgumaNota) {
        return { texto: "Pendente", valor: "-" };
    }

    const curso = cursoOverride || est.curso;
    const ano = est.ano || "2025-2026";
    const cadeira = est.cadeira || "geral";
    const pesos = obterPercentagens(curso, ano, cadeira);

    const presencaVal = notaPresencaCalc !== null ? notaPresencaCalc : 0;
    const t1Val = parseNota(est.teste1) !== null ? parseNota(est.teste1) : 0;
    const t2Val = parseNota(est.teste2) !== null ? parseNota(est.teste2) : 0;
    const mediaTestes = (t1Val + t2Val) / 2;

    const trabIndVal = mediaTrabInd !== null ? mediaTrabInd : 0;
    const trabGrpVal = mediaTrabGrp !== null ? mediaTrabGrp : 0;

    const calculo = (presencaVal * pesos.presenca) +
        (mediaTestes * pesos.testes) +
        (trabIndVal * pesos.trabInd) +
        (trabGrpVal * pesos.trabGrp);

    const exameParsed = parseNota(est.exame);
    const temExame = exameParsed !== null;
    const exameVal = temExame ? exameParsed : 0;

    const notaProfParsed = parseNota(est.notaProf);
    const temNotaProf = notaProfParsed !== null;
    const notaProfVal = temNotaProf ? notaProfParsed : 0;

    const LIMIAR = 9.4999;

    let calculoComProf = calculo;
    let exameComProf = exameVal;

    if (temNotaProf) {
        if (!temExame) {
            calculoComProf += notaProfVal;
        } else {
            exameComProf += notaProfVal;
        }
    }

    const aprovadoPorCalculo = calculoComProf > LIMIAR;
    const aprovadoPorExame = temExame && (exameComProf > LIMIAR || exameVal > LIMIAR);

    if (aprovadoPorCalculo || aprovadoPorExame) {
        let maiorNota = calculoComProf;
        if (temExame) {
            maiorNota = Math.max(calculoComProf, exameComProf, exameVal);
        }
        if (temNotaProf && !temExame) {
            maiorNota = Math.max(calculoComProf, calculo + notaProfVal);
        }
        const notaArred = Math.round(maiorNota);
        return { texto: `Aprovado(a) (${notaArred})`, valor: notaArred };
    }

    if (!temExame) {
        let maiorNotaExame = calculo;
        if (temNotaProf) maiorNotaExame = calculo + notaProfVal;
        const notaCalculoArred = Math.round(Math.max(calculo, maiorNotaExame));
        return { texto: `Exame (${notaCalculoArred})`, valor: notaCalculoArred };
    }

    let maiorNotaReprovado = Math.max(calculo, calculoComProf, exameVal, exameComProf);
    const notaReprovadoArred = Math.round(maiorNotaReprovado);
    return { texto: `Reprovado (${notaReprovadoArred})`, valor: notaReprovadoArred };
}

// Carregar dados da nuvem ao iniciar (com TTL, AbortController e fallback)
async function inicializarSistemaPauta(forcarRede = false) {
    const chaveCacheTTL = 'pauta_estado_ttl_v1';
    const cachedTTL = lerCachePautaIntegrado(chaveCacheTTL, TTL_PAUTA_INTEGRADO_MS);

    if (!forcarRede && cachedTTL && cachedTTL.valido && cachedTTL.dados && cachedTTL.dados.estudantes && cachedTTL.dados.estudantes.length > 0) {
        pautaEstado.estudantes = cachedTTL.dados.estudantes;
        pautaEstado.planilhasColunasPorCadeira = cachedTTL.dados.planilhasColunasPorCadeira || cachedTTL.dados.planilhasColunas || {};
        pautaEstado.percentagens = cachedTTL.dados.percentagens || {};
        configurarEventosAutopreenchimento();
        atualizarBarraControle4Colunas();
        return;
    }

    try {
        const resposta = await fetchPautaIntegradoComTimeout(PAUTA_API_URL_INTEGRADA, {}, TIMEOUT_PAUTA_INTEGRADO_MS);
        if (resposta.ok) {
            const dados = await resposta.json();
            if (dados && dados.estudantes && dados.estudantes.length > 0) {
                pautaEstado.estudantes = dados.estudantes;
                pautaEstado.planilhasColunasPorCadeira = dados.planilhasColunasPorCadeira || dados.planilhasColunas || {};
                pautaEstado.percentagens = dados.percentagens || {};
                guardarCachePautaIntegrado(chaveCacheTTL, dados);
                try { localStorage.setItem('pautaEstadoGlobal', JSON.stringify(dados)); } catch (e) { }
                exibirAvisoFallbackPautaIntegrado(dados.fallback ? (dados.aviso || 'A mostrar dados em cache do servidor.') : '');
                configurarEventosAutopreenchimento();
                atualizarBarraControle4Colunas();
                return;
            }
        } else {
            throw new Error(`HTTP ${resposta.status}`);
        }
    } catch (erro) {
        console.warn("Aviso ao carregar da API:", erro);
        const motivo = erro && erro.name === 'AbortError' ? 'timeout' : (erro.message || 'erro de ligação');
        exibirAvisoFallbackPautaIntegrado(`Ligação à nuvem demorou ou falhou (${motivo}). A usar cache local.`);
    }

    if (cachedTTL && cachedTTL.dados && Array.isArray(cachedTTL.dados.estudantes)) {
        pautaEstado.estudantes = cachedTTL.dados.estudantes;
        pautaEstado.planilhasColunasPorCadeira = cachedTTL.dados.planilhasColunasPorCadeira || cachedTTL.dados.planilhasColunas || {};
        pautaEstado.percentagens = cachedTTL.dados.percentagens || {};
        configurarEventosAutopreenchimento();
        atualizarBarraControle4Colunas();
        return;
    }

    const localSalvo = localStorage.getItem('pautaEstadoGlobal');
    if (localSalvo) {
        try {
            const dadosLocais = JSON.parse(localSalvo);
            pautaEstado.estudantes = dadosLocais.estudantes || [];
            pautaEstado.planilhasColunasPorCadeira = dadosLocais.planilhasColunasPorCadeira || dadosLocais.planilhasColunas || {};
            pautaEstado.percentagens = dadosLocais.percentagens || {};
        } catch (e) {
            console.error("Erro ao ler dados locais:", e);
        }
    }
    configurarEventosAutopreenchimento();
    atualizarBarraControle4Colunas();
}

// Sincronização com a nuvem (com AbortController e atualização de cache TTL)
async function salvarNaNuvem() {
    const dadosParaSalvar = {
        estudantes: pautaEstado.estudantes,
        planilhasColunasPorCadeira: pautaEstado.planilhasColunasPorCadeira,
        percentagens: pautaEstado.percentagens
    };

    guardarCachePautaIntegrado('pauta_estado_ttl_v1', dadosParaSalvar);

    try {
        localStorage.setItem('pautaEstadoGlobal', JSON.stringify(dadosParaSalvar));
    } catch (e) {
        console.error("Erro ao salvar localmente:", e);
    }

    try {
        const resposta = await fetchPautaIntegradoComTimeout(PAUTA_API_URL_INTEGRADA, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosParaSalvar)
        }, 9000);

        if (!resposta.ok) {
            const erroJson = await resposta.json().catch(() => ({}));
            console.error("Erro retornado pelo servidor:", erroJson);
            alert("⚠️ AVISO: As alterações foram guardadas neste computador, mas FALHARAM ao sincronizar com a nuvem: " + (erroJson.error || "Erro desconhecido."));
            return false;
        }
        exibirAvisoFallbackPautaIntegrado('');
        return true;
    } catch (erro) {
        console.error("Erro de rede ao sincronizar com a nuvem:", erro);
        const detalhe = erro && erro.name === 'AbortError' ? 'Tempo limite excedido (timeout).' : 'Sem ligação à internet.';
        alert(`⚠️ AVISO: ${detalhe} Os dados foram salvos apenas localmente.`);
        return false;
    }
}

let graficoTurmaInstancia = null;
let graficoEstudanteInstancia = null;

inicializarSistemaPauta();

// AUTENTICAÇÃO E NAVEGAÇÃO
function autenticarUtilizador() {
    const idInput = document.getElementById('pauta-user-id').value.trim();
    const senhaInput = document.getElementById('pauta-user-senha').value.trim();
    const erroDiv = document.getElementById('pauta-login-error');
    erroDiv.textContent = "";

    if (!idInput || !senhaInput) {
        erroDiv.textContent = "Por favor, preencha o ID e a senha.";
        return;
    }

    if ((idInput.toLowerCase() === "docente" || idInput.toLowerCase() === "wadiley") && senhaInput === "Wad&Mig2022") {
        pautaEstado.utilizadorAtual = { id: idInput, tipo: "docente", nome: "Wadiley", curso: "biologia" };
        entrarPainelDocente();
        return;
    }

    const estudante = pautaEstado.estudantes.find(e => e.id === idInput && e.senha === senhaInput);
    if (estudante) {
        pautaEstado.utilizadorAtual = { id: estudante.id, tipo: "estudante", nome: estudante.nome, curso: estudante.curso };
        entrarPainelEstudante(estudante);
        return;
    }

    erroDiv.textContent = "ID ou senha incorretos.";
}

function terminarSessao() {
    pautaEstado.utilizadorAtual = null;
    document.getElementById('pauta-login-section').classList.remove('pauta-hidden');
    document.getElementById('vista-docente').classList.add('pauta-hidden');
    document.getElementById('vista-estudante').classList.add('pauta-hidden');
}

function entrarPainelDocente() {
    document.getElementById('pauta-login-section').classList.add('pauta-hidden');
    document.getElementById('vista-docente').classList.remove('pauta-hidden');
    document.getElementById('vista-estudante').classList.add('pauta-hidden');
    document.getElementById('docente-acao-select').value = "";
    atualizarBarraControle4Colunas();
    mudarSecaoDocenteDinamica();
    recarregarDadosDocente();
}

// Garante que os eventos de autopreenchimento são ativados sempre que abrir a secção de criar estudante.
function mudarSecaoDocenteDinamica() {
    const acao = document.getElementById('docente-acao-select').value;
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;

    // A consulta individual é independente de Curso e Ano Letivo
    if (acao && acao !== "consultar-estudante" && (!cursoSel || !anoSel || cursoSel === "" || anoSel === "")) {
        alert("⚠️ Por favor, selecione primeiro o 'Curso' e o 'Ano Lectivo' no painel superior antes de prosseguir.");
        document.getElementById('docente-acao-select').value = "";
        atualizarBarraControle4Colunas();
        return;
    }

    atualizarBarraControle4Colunas();

    document.getElementById('subseccao-criar-estudante').classList.add('pauta-hidden');
    document.getElementById('subseccao-actualizar').classList.add('pauta-hidden');
    document.getElementById('subseccao-planilha').classList.add('pauta-hidden');
    document.getElementById('subseccao-percentagens').classList.add('pauta-hidden');
    document.getElementById('subseccao-visualizar').classList.add('pauta-hidden');

    const secConsulta = document.getElementById('subseccao-consultar-estudante');
    if (secConsulta) secConsulta.classList.add('pauta-hidden');

    if (acao === "consultar-estudante") {
        abrirSecaoConsultaIndividualDocente();
    } else if (acao === "visualizar") {
        document.getElementById('subseccao-visualizar').classList.remove('pauta-hidden');
        recarregarDadosDocente();
    } else if (acao === "criar-estudante") {
        document.getElementById('subseccao-criar-estudante').classList.remove('pauta-hidden');
        configurarEventosAutopreenchimento();
        recarregarDadosDocente();
    } else if (acao === "actualizar") {
        document.getElementById('subseccao-actualizar').classList.remove('pauta-hidden');
        controlarCamposAtualizacao();
    } else if (acao === "planilha") {
        document.getElementById('subseccao-planilha').classList.remove('pauta-hidden');
        inicializarGestaoPlanilhas();
    } else if (acao === "percentagens") {
        document.getElementById('subseccao-percentagens').classList.remove('pauta-hidden');
        carregarCamposPercentagensAtuais();
        atualizarSelectUCPonderacaoPauta3();
    }
}

// ================= GESTÃO DE COLUNAS POR U.C., CURSO E ANO =================
function inicializarGestaoPlanilhas() {
    atualizarSelectCadeirasGestaoPlanilhas();
    carregarSelectPlanilhas();
}

function atualizarSelectCadeirasGestaoPlanilhas() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;
    const ucAtiva = obterUCParaPlanilhas(cursoSel, anoSel);

    // O seletor de U.C. já está no Controlo de Operações da Pauta (4 colunas), então remove o seletor duplicado de baixo
    const selectAntigo = document.getElementById('select-cadeira-planilha-ativa');
    if (selectAntigo) {
        const blocoPai = selectAntigo.closest('.pauta-form-group') || selectAntigo.parentElement;
        if (blocoPai && blocoPai.id !== 'subseccao-planilha') {
            blocoPai.remove();
        } else {
            selectAntigo.remove();
        }
    }

    // Mantém um input oculto sincronizado por compatibilidade caso algum script leia #select-cadeira-planilha-ativa
    const secaoPlanilha = document.getElementById('subseccao-planilha');
    if (secaoPlanilha) {
        const sincronizadorOculto = document.createElement('input');
        sincronizadorOculto.type = 'hidden';
        sincronizadorOculto.id = 'select-cadeira-planilha-ativa';
        sincronizadorOculto.value = ucAtiva;
        secaoPlanilha.appendChild(sincronizadorOculto);
    }
}

function carregarSelectPlanilhas() {
    const select = document.getElementById('select-planilha-ativa');
    if (!select) return;

    select.innerHTML = '<option value="" selected disabled>-- Selecione uma categoria --</option>';
    const planilhasFixas = ["Presenças", "Trabalhos Individuais", "Trabalhos de Grupo"];
    planilhasFixas.forEach(nome => {
        select.innerHTML += `<option value="${nome}">${nome}</option>`;
    });

    carregarColunasDaPlanilha();
}

function carregarColunasDaPlanilha() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;
    const cadeiraSel = obterUCParaPlanilhas(cursoSel, anoSel);
    const nomePlanilha = document.getElementById('select-planilha-ativa').value;
    const selectColuna = document.getElementById('select-coluna-ativa');

    if (!selectColuna) return;

    selectColuna.innerHTML = '<option value="" selected disabled>-- Selecione uma coluna --</option>';

    if (nomePlanilha) {
        const colunas = obterColunasCadeira(cursoSel, anoSel, cadeiraSel, nomePlanilha);
        colunas.forEach(coluna => {
            selectColuna.innerHTML += `<option value="${coluna}">${coluna}</option>`;
        });
    }
    document.getElementById('gp-nome-coluna').value = "";
}

function preencherNomeColunaEdicao() {
    const colunaSel = document.getElementById('select-coluna-ativa').value;
    if (colunaSel) {
        document.getElementById('gp-nome-coluna').value = colunaSel;
    }
}

async function adicionarColunaNaPlanilha() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;
    const cadeiraSel = obterUCParaPlanilhas(cursoSel, anoSel);
    const nomePlanilha = document.getElementById('select-planilha-ativa').value;
    const nomeColuna = document.getElementById('gp-nome-coluna').value.trim();

    if (!cursoSel || !anoSel) {
        alert("Por favor, selecione um curso e ano letivo globalmente primeiro.");
        return;
    }
    if (!nomePlanilha) {
        alert("Por favor, selecione primeiro uma categoria (ex: Presenças).");
        return;
    }
    if (!nomeColuna) {
        alert("Insira o nome da coluna (ex: Aula 1).");
        return;
    }

    const cid = `${cursoSel}_${anoSel}_${cadeiraSel}`.toLowerCase().replace(/\s+/g, '_');
    if (!pautaEstado.planilhasColunasPorCadeira[cid]) {
        pautaEstado.planilhasColunasPorCadeira[cid] = {
            "Presenças": [],
            "Trabalhos Individuais": [],
            "Trabalhos de Grupo": []
        };
    }

    if (pautaEstado.planilhasColunasPorCadeira[cid][nomePlanilha].includes(nomeColuna)) {
        alert("Esta coluna já existe nesta categoria para este curso, ano e Unidade Curricular.");
        return;
    }

    pautaEstado.planilhasColunasPorCadeira[cid][nomePlanilha].push(nomeColuna);
    await salvarNaNuvem();
    alert(`Coluna "${nomeColuna}" adicionada a "${nomePlanilha}" (${cadeiraSel} - ${cursoSel} - ${anoSel}) com sucesso!`);
    document.getElementById('gp-nome-coluna').value = "";
    carregarColunasDaPlanilha();
    recarregarDadosDocente();
}

async function atualizarNomeColuna() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;
    const cadeiraSel = obterUCParaPlanilhas(cursoSel, anoSel);
    const nomePlanilha = document.getElementById('select-planilha-ativa').value;
    const colunaAntiga = document.getElementById('select-coluna-ativa').value;
    const novoNomeColuna = document.getElementById('gp-nome-coluna').value.trim();

    if (!nomePlanilha || !colunaAntiga) {
        alert("Selecione a categoria e a coluna que deseja atualizar.");
        return;
    }
    if (!novoNomeColuna) {
        alert("Insira o novo nome para a coluna.");
        return;
    }

    const cid = `${cursoSel}_${anoSel}_${cadeiraSel}`.toLowerCase().replace(/\s+/g, '_');
    const colunas = pautaEstado.planilhasColunasPorCadeira[cid]?.[nomePlanilha] || [];
    const index = colunas.indexOf(colunaAntiga);
    if (index !== -1) {
        colunas[index] = novoNomeColuna;
        await salvarNaNuvem();
        alert("Nome da coluna atualizado com sucesso!");
        document.getElementById('gp-nome-coluna').value = "";
        carregarColunasDaPlanilha();
        recarregarDadosDocente();
    }
}

async function eliminarColunaDaPlanilha() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;
    const cadeiraSel = obterUCParaPlanilhas(cursoSel, anoSel);
    const nomePlanilha = document.getElementById('select-planilha-ativa').value;
    const colunaSel = document.getElementById('select-coluna-ativa').value;

    if (!nomePlanilha || !colunaSel) {
        alert("Selecione a categoria e a coluna que deseja eliminar.");
        return;
    }

    if (confirm(`Tem a certeza que deseja eliminar a coluna "${colunaSel}"?`)) {
        const cid = `${cursoSel}_${anoSel}_${cadeiraSel}`.toLowerCase().replace(/\s+/g, '_');
        if (pautaEstado.planilhasColunasPorCadeira[cid]?.[nomePlanilha]) {
            pautaEstado.planilhasColunasPorCadeira[cid][nomePlanilha] =
                pautaEstado.planilhasColunasPorCadeira[cid][nomePlanilha].filter(c => c !== colunaSel);
        }
        await salvarNaNuvem();
        alert("Coluna eliminada.");
        carregarColunasDaPlanilha();
        recarregarDadosDocente();
    }
}

// ================= GESTÃO DE PERCENTAGENS =================
function carregarCamposPercentagensAtuais() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;

    const inputPresenca = document.getElementById('pc-presenca');
    const inputTestes = document.getElementById('pc-testes');
    const inputTrabInd = document.getElementById('pc-trabind');
    const inputTrabGrp = document.getElementById('pc-trabgrp');

    if (!cursoSel || !anoSel || cursoSel === "" || anoSel === "") {
        inputPresenca.value = "";
        inputTestes.value = "";
        inputTrabInd.value = "";
        inputTrabGrp.value = "";
        return;
    }

    const estExemplo = pautaEstado.estudantes.find(e => e.curso === cursoSel && (e.ano === anoSel || !e.ano) && estudanteCorrespondeUCGlobal(e));
    const cadeiraSel = estExemplo ? (estExemplo.cadeira || "geral") : "geral";

    const cursoKey = cursoSel.trim().toLowerCase();
    const anoKey = anoSel.trim().toLowerCase();
    const cadeiraKey = cadeiraSel.trim().toLowerCase();
    const chave = `${cursoKey}_${anoKey}_${cadeiraKey}`.replace(/\s+/g, '_');

    if (pautaEstado.percentagens && pautaEstado.percentagens[chave]) {
        const pesos = pautaEstado.percentagens[chave];
        inputPresenca.value = pesos.presenca > 0 ? pesos.presenca * 100 : "";
        inputTestes.value = pesos.testes > 0 ? pesos.testes * 100 : "";
        inputTrabInd.value = pesos.trabInd > 0 ? pesos.trabInd * 100 : "";
        inputTrabGrp.value = pesos.trabGrp > 0 ? pesos.trabGrp * 100 : "";
    } else {
        inputPresenca.value = "";
        inputTestes.value = "";
        inputTrabInd.value = "";
        inputTrabGrp.value = "";
    }
}

async function guardarPercentagensCurso() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;

    if (!cursoSel || !anoSel || cursoSel === "" || anoSel === "") {
        alert("Por favor, selecione um Curso e um Ano Letivo válidos.");
        return;
    }

    const estExemplo = pautaEstado.estudantes.find(e => e.curso === cursoSel && (e.ano === anoSel || !e.ano) && estudanteCorrespondeUCGlobal(e));
    const cadeiraSel = estExemplo ? (estExemplo.cadeira || "geral") : "geral";

    const cursoKey = cursoSel.trim().toLowerCase();
    const anoKey = anoSel.trim().toLowerCase();
    const cadeiraKey = cadeiraSel.trim().toLowerCase();
    const chave = `${cursoKey}_${anoKey}_${cadeiraKey}`.replace(/\s+/g, '_');

    let pPresenca = parseFloat(document.getElementById('pc-presenca').value) || 0;
    let pTestes = parseFloat(document.getElementById('pc-testes').value) || 0;
    let pTrabInd = parseFloat(document.getElementById('pc-trabind').value) || 0;
    let pTrabGrp = parseFloat(document.getElementById('pc-trabgrp').value) || 0;

    if (pPresenca > 1 || pTestes > 1 || pTrabInd > 1 || pTrabGrp > 1) {
        pPresenca /= 100; pTestes /= 100; pTrabInd /= 100; pTrabGrp /= 100;
    }

    pautaEstado.percentagens[chave] = {
        presenca: pPresenca,
        testes: pTestes,
        trabInd: pTrabInd,
        trabGrp: pTrabGrp
    };

    await salvarNaNuvem();
    alert("Percentagens guardadas com sucesso!");
    recarregarDadosDocente();
}

// ================= SELEÇÃO E GUARDA DE PERCENTAGENS POR UNIDADE CURRICULAR (U.C.) =================
function atualizarSelectUCPonderacaoPauta3() {
    const subSec = document.getElementById('subseccao-percentagens');
    const cursoSel = document.getElementById('docente-curso-global')?.value;
    const anoSel = document.getElementById('docente-ano-global')?.value;
    if (!subSec || !cursoSel || !anoSel) return;

    const wrapperAntigo = document.getElementById('pauta3-wrapper-uc-perc');
    if (wrapperAntigo) wrapperAntigo.remove();

    const inputPresenca = document.getElementById('pc-presenca');
    const btnGuardar = subSec.querySelector('button[onclick*="guardarPercentagens"]');
    const grelha = inputPresenca?.closest('.pauta-form-row, .pauta-grid-3col') || inputPresenca?.parentElement?.parentElement;

    if (grelha) {
        grelha.style.display = 'grid';
        grelha.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
        grelha.style.gap = '16px';
        grelha.style.alignItems = 'end';
    }

    let campoUC = document.getElementById('pauta3-campo-uc-grid');
    if (!campoUC) {
        campoUC = document.createElement('div');
        campoUC.id = 'pauta3-campo-uc-grid';
        campoUC.className = 'pauta-form-group';
        campoUC.innerHTML = `
            <label for="pauta3-select-uc-perc">Unidade Curricular (U.C.):</label>
            <select id="pauta3-select-uc-perc" class="pauta-input" onchange="carregarPercentagensPorUCSelecionada()">
                <option value="" disabled selected>-- Selecione a U.C. --</option>
            </select>
        `;
    }

    if (grelha && campoUC.parentElement !== grelha) {
        const alvoBtn = btnGuardar?.closest('.pauta-form-group') || btnGuardar;
        if (alvoBtn && alvoBtn.parentElement === grelha) {
            grelha.insertBefore(campoUC, alvoBtn);
        } else {
            grelha.appendChild(campoUC);
        }
    }

    if (btnGuardar) {
        btnGuardar.setAttribute('onclick', 'guardarPercentagensPorUCSelecionada()');
    }

    const selectUC = document.getElementById('pauta3-select-uc-perc');
    if (!selectUC) return;

    const cursoKey = cursoSel.trim().toLowerCase();
    const anoKey = anoSel.trim().toLowerCase();
    const ucsSet = new Set();

    pautaEstado.estudantes.forEach(e => {
        const mesmoCurso = String(e.curso || '').trim().toLowerCase() === cursoKey;
        const mesmoAno = !e.ano || String(e.ano || '').trim().toLowerCase() === anoKey;
        const uc = String(e.cadeira || '').trim();
        if (mesmoCurso && mesmoAno && uc) {
            ucsSet.add(uc);
        }
    });

    Object.keys(pautaEstado.percentagens || {}).forEach(chave => {
        const partes = chave.split('_');
        if (partes.length >= 3 && partes[0] === cursoKey && partes[1] === anoKey) {
            const ucChave = partes.slice(2).join('_');
            const existente = Array.from(ucsSet).find(x => x.trim().toLowerCase().replace(/\s+/g, '_') === ucChave);
            ucsSet.add(existente || ucChave);
        }
    });

    const ucGlobal = obterFiltroUCGlobal();
    const anterior = (!ucGlobal || ucGlobal === PAUTA_UC_TODAS) ? selectUC.value : ucGlobal;
    selectUC.innerHTML = '<option value="" disabled selected>-- Selecione a U.C. --</option>';

    Array.from(ucsSet).sort((a, b) => a.localeCompare(b, 'pt')).forEach(uc => {
        selectUC.innerHTML += `<option value="${uc}">${uc}</option>`;
    });

    if (anterior && Array.from(selectUC.options).some(o => o.value === anterior)) {
        selectUC.value = anterior;
    } else if (selectUC.options.length === 2) {
        selectUC.selectedIndex = 1;
    }

    carregarPercentagensPorUCSelecionada();
}

function carregarPercentagensPorUCSelecionada() {
    const cursoSel = (document.getElementById('docente-curso-global')?.value || '').trim();
    const anoSel = (document.getElementById('docente-ano-global')?.value || '').trim();
    const ucSel = (document.getElementById('pauta3-select-uc-perc')?.value || '').trim();

    const inputPresenca = document.getElementById('pc-presenca');
    const inputTestes = document.getElementById('pc-testes');
    const inputTrabInd = document.getElementById('pc-trabind');
    const inputTrabGrp = document.getElementById('pc-trabgrp');

    if (!cursoSel || !anoSel || !ucSel) {
        if (inputPresenca) inputPresenca.value = "";
        if (inputTestes) inputTestes.value = "";
        if (inputTrabInd) inputTrabInd.value = "";
        if (inputTrabGrp) inputTrabGrp.value = "";
        return;
    }

    const cursoKey = cursoSel.toLowerCase();
    const anoKey = anoSel.toLowerCase();
    const cadeiraKey = ucSel.toLowerCase();
    const chaveExata = `${cursoKey}_${anoKey}_${cadeiraKey}`.replace(/\s+/g, '_');

    let pesos = pautaEstado.percentagens && pautaEstado.percentagens[chaveExata];
    if (!pesos && pautaEstado.percentagens && typeof normalizarComparacaoPauta3 === 'function') {
        const alvoNorm = `${normalizarComparacaoPauta3(cursoSel)}_${normalizarComparacaoPauta3(anoSel)}_${normalizarComparacaoPauta3(ucSel)}`;
        const chaveEncontrada = Object.keys(pautaEstado.percentagens).find(k => {
            const p = String(k).split('_');
            if (p.length < 3) return false;
            const kNorm = `${normalizarComparacaoPauta3(p[0])}_${normalizarComparacaoPauta3(p[1])}_${normalizarComparacaoPauta3(p.slice(2).join('_'))}`;
            return kNorm === alvoNorm;
        });
        if (chaveEncontrada) pesos = pautaEstado.percentagens[chaveEncontrada];
    }

    if (pesos) {
        if (inputPresenca) inputPresenca.value = pesos.presenca > 0 ? pesos.presenca * 100 : "";
        if (inputTestes) inputTestes.value = pesos.testes > 0 ? pesos.testes * 100 : "";
        if (inputTrabInd) inputTrabInd.value = pesos.trabInd > 0 ? pesos.trabInd * 100 : "";
        if (inputTrabGrp) inputTrabGrp.value = pesos.trabGrp > 0 ? pesos.trabGrp * 100 : "";
    } else {
        if (inputPresenca) inputPresenca.value = "";
        if (inputTestes) inputTestes.value = "";
        if (inputTrabInd) inputTrabInd.value = "";
        if (inputTrabGrp) inputTrabGrp.value = "";
    }
}

async function guardarPercentagensPorUCSelecionada() {
    const cursoSel = (document.getElementById('docente-curso-global')?.value || '').trim();
    const anoSel = (document.getElementById('docente-ano-global')?.value || '').trim();
    const ucSel = (document.getElementById('pauta3-select-uc-perc')?.value || '').trim();

    if (!cursoSel || !anoSel || !ucSel) {
        alert("⚠️ Selecione o Curso, o Ano Letivo e a Unidade Curricular (U.C.).");
        return;
    }

    const cursoKey = cursoSel.toLowerCase();
    const anoKey = anoSel.toLowerCase();
    const cadeiraKey = ucSel.toLowerCase();
    const chave = `${cursoKey}_${anoKey}_${cadeiraKey}`.replace(/\s+/g, '_');

    let pPresenca = parseFloat(document.getElementById('pc-presenca').value) || 0;
    let pTestes = parseFloat(document.getElementById('pc-testes').value) || 0;
    let pTrabInd = parseFloat(document.getElementById('pc-trabind').value) || 0;
    let pTrabGrp = parseFloat(document.getElementById('pc-trabgrp').value) || 0;

    if (pPresenca > 1 || pTestes > 1 || pTrabInd > 1 || pTrabGrp > 1) {
        pPresenca /= 100; pTestes /= 100; pTrabInd /= 100; pTrabGrp /= 100;
    }

    pautaEstado.percentagens[chave] = {
        presenca: pPresenca,
        testes: pTestes,
        trabInd: pTrabInd,
        trabGrp: pTrabGrp
    };

    await salvarNaNuvem();
    alert(`✅ Percentagens guardadas para "${ucSel}" (${anoSel})!`);
    recarregarDadosDocente();
}

// Auxiliar para montar uma única linha no <thead> mesclando as colunas do grupo sem duplicar nomes no topo
function montarTheadSemDuplicacao(colunasFixas, tituloGrupo, totalSubcolunas) {
    const span = totalSubcolunas > 0 ? totalSubcolunas : 1;
    const thFixas = colunasFixas.map(col => `<th>${col}</th>`).join('');
    return `<tr>${thFixas}<th colspan="${span}" style="text-align:center;">${tituloGrupo}</th></tr>`;
}

// RECARREGAR DADOS DOCENTE E TABELAS INDIVIDUAIS (com filtro por U.C. e "Todas as U.C.")
function recarregarDadosDocente() {
    atualizarBarraControle4Colunas();

    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;

    const tbodyResumo = document.getElementById('tabela-docente-resumo');
    const tbodyPresenca = document.getElementById('tabela-docente-presenca');
    const tbodyTrabInd = document.getElementById('tabela-docente-trabind');
    const tbodyTrabGrp = document.getElementById('tabela-docente-trabgrp');

    const theadPresenca = document.getElementById('thead-docente-presenca');
    const theadTrabInd = document.getElementById('thead-docente-trabind');
    const theadTrabGrp = document.getElementById('thead-docente-trabgrp');
    const selectApagar = document.getElementById('select-apagar-estudante');

    if (!cursoSel || !anoSel || cursoSel === "" || anoSel === "") {
        if (tbodyResumo) tbodyResumo.innerHTML = "";
        if (tbodyPresenca) tbodyPresenca.innerHTML = "";
        if (tbodyTrabInd) tbodyTrabInd.innerHTML = "";
        if (tbodyTrabGrp) tbodyTrabGrp.innerHTML = "";
        if (selectApagar) selectApagar.innerHTML = "";
        return;
    }

    const filtrados = pautaEstado.estudantes.filter(e =>
        e.curso === cursoSel &&
        (e.ano === anoSel || !e.ano) &&
        estudanteCorrespondeUCGlobal(e)
    );

    let todasColsPresenca = [];
    let todasColsTrabInd = [];
    let todasColsTrabGrp = [];

    filtrados.forEach(e => {
        const cadeiraAtual = e.cadeira || "Geral";
        const anoEstudante = e.ano || anoSel;

        obterColunasCadeira(cursoSel, anoEstudante, cadeiraAtual, "Presenças").forEach(c => { if (!todasColsPresenca.includes(c)) todasColsPresenca.push(c); });
        obterColunasCadeira(cursoSel, anoEstudante, cadeiraAtual, "Trabalhos Individuais").forEach(c => { if (!todasColsTrabInd.includes(c)) todasColsTrabInd.push(c); });
        obterColunasCadeira(cursoSel, anoEstudante, cadeiraAtual, "Trabalhos de Grupo").forEach(c => { if (!todasColsTrabGrp.includes(c)) todasColsTrabGrp.push(c); });
    });

    if (theadPresenca) {
        theadPresenca.innerHTML = montarTheadSemDuplicacao(["ID", "Nome", "U.C."], "Presenças", todasColsPresenca.length);
    }

    if (theadTrabInd) {
        theadTrabInd.innerHTML = montarTheadSemDuplicacao(["ID", "Nome", "U.C."], "Trabalhos Individuais", todasColsTrabInd.length);
    }

    if (theadTrabGrp) {
        theadTrabGrp.innerHTML = montarTheadSemDuplicacao(["ID", "Nome", "U.C."], "Trabalhos de Grupo", todasColsTrabGrp.length);
    }

    const htmlResumoArr = [];
    const htmlPresencaArr = [];
    const htmlTrabIndArr = [];
    const htmlTrabGrpArr = [];
    const opcoesApagarArr = [];

    filtrados.forEach((est) => {
        est.trabInd = calcularMediaTrabalhos(est, "Trabalhos Individuais", cursoSel);
        est.trabGrp = calcularMediaTrabalhos(est, "Trabalhos de Grupo", cursoSel);

        const notaPresCalc = calcularNotaPresenca(est, cursoSel);
        if (notaPresCalc !== null) est.presenca = notaPresCalc;

        const avaliacao = calcularSituacaoEstudante(est, cursoSel);
        est.situacao = avaliacao.texto;

        if (tbodyResumo) {
            htmlResumoArr.push(`<tr>
                <td>${est.id}</td><td>${est.nome}</td><td>${est.curso}</td><td>${est.cadeira || '-'}</td><td>${est.estatuto}</td><td>${est.ano || anoSel}</td>
                <td>${formatarNota(est.presenca)}</td><td>${formatarNota(est.trabInd)}</td><td>${formatarNota(est.trabGrp)}</td>
                <td>${formatarNota(est.teste1)}</td><td>${formatarNota(est.teste2)}</td><td>${formatarNota(est.exame)}</td><td>${formatarNota(est.notaProf)}</td><td><strong>${est.situacao}</strong></td>
            </tr>`);
        }

        const anoEstudante = est.ano || anoSel;
        const colsCadeiraPres = obterColunasCadeira(cursoSel, anoEstudante, est.cadeira, "Presenças");
        const colsCadeiraTI = obterColunasCadeira(cursoSel, anoEstudante, est.cadeira, "Trabalhos Individuais");
        const colsCadeiraTG = obterColunasCadeira(cursoSel, anoEstudante, est.cadeira, "Trabalhos de Grupo");

        if (tbodyPresenca) {
            let linhaDatasP = `<tr style="background-color: #f8fafc; font-weight: bold; color: #1e293b;">
                <td colspan="3" style="border-right: none;"></td>`;
            if (todasColsPresenca.length > 0) {
                todasColsPresenca.forEach(colGlobal => {
                    if (colsCadeiraPres.includes(colGlobal)) {
                        linhaDatasP += `<td style="font-size: 0.9em; text-align: center;">${colGlobal}</td>`;
                    } else {
                        linhaDatasP += `<td style="font-size: 0.9em; text-align: center; color: #cbd5e1;">-</td>`;
                    }
                });
            } else {
                linhaDatasP += `<td style="font-size: 0.9em; text-align: center;">Geral</td>`;
            }
            linhaDatasP += `</tr>`;

            let rowPresenca = `<tr><td>${est.id}</td><td>${est.nome}</td><td>${est.cadeira || 'Geral'}</td>`;
            if (todasColsPresenca.length > 0) {
                todasColsPresenca.forEach(colGlobal => {
                    if (colsCadeiraPres.includes(colGlobal)) {
                        const chaveKey = "pres_" + colGlobal;
                        const val = (est.subNotas && est.subNotas[chaveKey] !== undefined) ? est.subNotas[chaveKey] : "---";
                        rowPresenca += `<td style="text-align: center;">${formatarNota(val)}</td>`;
                    } else {
                        rowPresenca += `<td style="text-align: center; color: #cbd5e1;">-</td>`;
                    }
                });
            } else {
                rowPresenca += `<td style="text-align: center;">${formatarNota(est.presenca)}</td>`;
            }
            rowPresenca += `</tr>`;

            htmlPresencaArr.push(linhaDatasP + rowPresenca);
        }

        if (tbodyTrabInd) {
            let linhaDatasTI = `<tr style="background-color: #f8fafc; font-weight: bold; color: #1e293b;">
                <td colspan="3" style="border-right: none;"></td>`;
            if (todasColsTrabInd.length > 0) {
                todasColsTrabInd.forEach(colGlobal => {
                    if (colsCadeiraTI.includes(colGlobal)) {
                        linhaDatasTI += `<td style="font-size: 0.9em; text-align: center;">${colGlobal}</td>`;
                    } else {
                        linhaDatasTI += `<td style="font-size: 0.9em; text-align: center; color: #cbd5e1;">-</td>`;
                    }
                });
            } else {
                linhaDatasTI += `<td style="font-size: 0.9em; text-align: center;">Geral</td>`;
            }
            linhaDatasTI += `</tr>`;

            let rowTrabInd = `<tr><td>${est.id}</td><td>${est.nome}</td><td>${est.cadeira || 'Geral'}</td>`;
            if (todasColsTrabInd.length > 0) {
                todasColsTrabInd.forEach(colGlobal => {
                    if (colsCadeiraTI.includes(colGlobal)) {
                        const chaveKey = "indiv_" + colGlobal;
                        const val = (est.subNotas && est.subNotas[chaveKey] !== undefined) ? est.subNotas[chaveKey] : "---";
                        rowTrabInd += `<td style="text-align: center;">${formatarNota(val)}</td>`;
                    } else {
                        rowTrabInd += `<td style="text-align: center; color: #cbd5e1;">-</td>`;
                    }
                });
            } else {
                rowTrabInd += `<td style="text-align: center;">---</td>`;
            }
            rowTrabInd += `</tr>`;

            htmlTrabIndArr.push(linhaDatasTI + rowTrabInd);
        }

        if (tbodyTrabGrp) {
            let linhaDatasTG = `<tr style="background-color: #f8fafc; font-weight: bold; color: #1e293b;">
                <td colspan="3" style="border-right: none;"></td>`;
            if (todasColsTrabGrp.length > 0) {
                todasColsTrabGrp.forEach(colGlobal => {
                    if (colsCadeiraTG.includes(colGlobal)) {
                        linhaDatasTG += `<td style="font-size: 0.9em; text-align: center;">${colGlobal}</td>`;
                    } else {
                        linhaDatasTG += `<td style="font-size: 0.9em; text-align: center; color: #cbd5e1;">-</td>`;
                    }
                });
            } else {
                linhaDatasTG += `<td style="font-size: 0.9em; text-align: center;">Geral</td>`;
            }
            linhaDatasTG += `</tr>`;

            let rowTrabGrp = `<tr><td>${est.id}</td><td>${est.nome}</td><td>${est.cadeira || 'Geral'}</td>`;
            if (todasColsTrabGrp.length > 0) {
                todasColsTrabGrp.forEach(colGlobal => {
                    if (colsCadeiraTG.includes(colGlobal)) {
                        const chaveKey = "grp_" + colGlobal;
                        const val = (est.subNotas && est.subNotas[chaveKey] !== undefined) ? est.subNotas[chaveKey] : "---";
                        rowTrabGrp += `<td style="text-align: center;">${formatarNota(val)}</td>`;
                    } else {
                        rowTrabGrp += `<td style="text-align: center; color: #cbd5e1;">-</td>`;
                    }
                });
            } else {
                rowTrabGrp += `<td style="text-align: center;">---</td>`;
            }
            rowTrabGrp += `</tr>`;

            htmlTrabGrpArr.push(linhaDatasTG + rowTrabGrp);
        }

        if (selectApagar) {
            opcoesApagarArr.push(`<option value="${est.id}">${est.id} - ${est.nome} (${est.cadeira || 'Geral'})</option>`);
        }
    });

    if (tbodyResumo) tbodyResumo.innerHTML = htmlResumoArr.join('');
    if (tbodyPresenca) tbodyPresenca.innerHTML = htmlPresencaArr.join('');
    if (tbodyTrabInd) tbodyTrabInd.innerHTML = htmlTrabIndArr.join('');
    if (tbodyTrabGrp) tbodyTrabGrp.innerHTML = htmlTrabGrpArr.join('');
    if (selectApagar) selectApagar.innerHTML = opcoesApagarArr.join('');

    renderizarGraficoTurma(filtrados);

    if (typeof inicializarPesquisaIndividualDocente === 'function') {
        inicializarPesquisaIndividualDocente();
    }
}

// ================= AUTO-PREENCHIMENTO INTELIGENTE (CHAVE MESTRA ID / NOME) =================
function configurarEventosAutopreenchimento() {
    const inputId = document.getElementById('ce-id');
    const inputNome = document.getElementById('ce-nome');
    const inputSenha = document.getElementById('ce-senha');
    const inputCadeira = document.getElementById('ce-cadeira');
    const selectEstatuto = document.getElementById('ce-estatuto');
    const selectCursoGlobal = document.getElementById('docente-curso-global');
    const selectAnoGlobal = document.getElementById('docente-ano-global');

    if (!inputId || !inputNome || !inputSenha) return;

    if (inputId.dataset.autoConfigurado === "true") return;
    inputId.dataset.autoConfigurado = "true";

    inputId.addEventListener('input', () => {
        if (inputId.readOnly) return;

        const idVal = inputId.value.trim().toLowerCase();
        if (!idVal) {
            desbloquearELimparCamposEstudante('id');
            return;
        }

        const registos = pautaEstado.estudantes.filter(e => String(e.id).trim().toLowerCase() === idVal);
        const existente = registos[registos.length - 1];

        if (existente) {
            inputNome.value = existente.nome || "";
            inputSenha.value = existente.senha || "";

            inputNome.readOnly = true;
            inputSenha.readOnly = true;
            inputNome.style.backgroundColor = "#f1f5f9";
            inputSenha.style.backgroundColor = "#f1f5f9";

            if (inputCadeira && existente.cadeira) inputCadeira.value = existente.cadeira;
            if (selectEstatuto && existente.estatuto) selectEstatuto.value = existente.estatuto;
            if (selectCursoGlobal && existente.curso) selectCursoGlobal.value = existente.curso;
            if (selectAnoGlobal && existente.ano) selectAnoGlobal.value = existente.ano;
        } else {
            desbloquearELimparCamposEstudante('id');
        }
    });

    inputNome.addEventListener('input', () => {
        if (inputNome.readOnly) return;

        const nomeVal = inputNome.value.trim().toLowerCase();
        if (!nomeVal) {
            desbloquearELimparCamposEstudante('nome');
            return;
        }

        const registos = pautaEstado.estudantes.filter(e => String(e.nome).trim().toLowerCase() === nomeVal);
        const existente = registos[registos.length - 1];

        if (existente) {
            inputId.value = existente.id || "";
            inputSenha.value = existente.senha || "";

            inputId.readOnly = true;
            inputSenha.readOnly = true;
            inputId.style.backgroundColor = "#f1f5f9";
            inputSenha.style.backgroundColor = "#f1f5f9";

            if (inputCadeira && existente.cadeira) inputCadeira.value = existente.cadeira;
            if (selectEstatuto && existente.estatuto) selectEstatuto.value = existente.estatuto;
            if (selectCursoGlobal && existente.curso) selectCursoGlobal.value = existente.curso;
            if (selectAnoGlobal && existente.ano) selectAnoGlobal.value = existente.ano;
        } else {
            desbloquearELimparCamposEstudante('nome');
        }
    });
}

function desbloquearELimparCamposEstudante(origem) {
    const inputId = document.getElementById('ce-id');
    const inputNome = document.getElementById('ce-nome');
    const inputSenha = document.getElementById('ce-senha');

    if (origem === 'id' && inputNome.readOnly) {
        inputNome.value = "";
        inputSenha.value = "";
    }
    if (origem === 'nome' && inputId.readOnly) {
        inputId.value = "";
        inputSenha.value = "";
    }

    inputId.readOnly = false;
    inputNome.readOnly = false;
    inputSenha.readOnly = false;

    inputId.style.backgroundColor = "";
    inputNome.style.backgroundColor = "";
    inputSenha.style.backgroundColor = "";
}

function parseDataColuna(colStr) {
    if (!colStr) return null;
    const partes = String(colStr).trim().split('/');
    if (partes.length === 3) {
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1;
        const ano = parseInt(partes[2], 10);
        const d = new Date(ano, mes, dia);
        return isNaN(d.getTime()) ? null : d.setHours(0, 0, 0, 0);
    }
    const d = new Date(colStr);
    return isNaN(d.getTime()) ? null : d.setHours(0, 0, 0, 0);
}

// REGISTAR ESTUDANTE COM HERANÇA AUTOMÁTICA DE COLUNAS E FALTAS RETROATIVAS
async function registarNovoEstudante() {
    const curso = document.getElementById('docente-curso-global').value;
    const ano = document.getElementById('docente-ano-global').value;

    if (!curso || !ano || curso === "" || ano === "") {
        alert("⚠️ Por favor, selecione primeiro o 'Curso' e o 'Ano Lectivo' no painel superior.");
        return;
    }

    const idInput = document.getElementById('ce-id').value.trim();
    const senhaInput = document.getElementById('ce-senha').value.trim();
    const nomeInput = document.getElementById('ce-nome').value.trim();
    const cadeiraInput = document.getElementById('ce-cadeira').value.trim();
    const cadeira = cadeiraInput || (!isTodasUCSelecionada() ? obterFiltroUCGlobal() : "");
    const estatuto = document.getElementById('ce-estatuto').value;

    if (!idInput || !senhaInput || !nomeInput) {
        alert("Preencha os campos obrigatórios: ID, Senha e Nome.");
        return;
    }

    const conflitoId = pautaEstado.estudantes.find(
        e => String(e.id).trim().toLowerCase() === idInput.toLowerCase() &&
            String(e.nome).trim().toLowerCase() !== nomeInput.toLowerCase()
    );
    const conflitoNome = pautaEstado.estudantes.find(
        e => String(e.nome).trim().toLowerCase() === nomeInput.toLowerCase() &&
            String(e.id).trim().toLowerCase() !== idInput.toLowerCase()
    );

    if (conflitoId) {
        alert(`⚠️ O ID "${idInput}" já pertence a outro estudante (${conflitoId.nome}).`);
        return;
    }
    if (conflitoNome) {
        alert(`⚠️ O Nome "${nomeInput}" já está associado ao ID (${conflitoNome.id}).`);
        return;
    }

    const duplicadoExato = pautaEstado.estudantes.some(e =>
        String(e.id).trim().toLowerCase() === idInput.toLowerCase() &&
        String(e.curso).trim().toLowerCase() === curso.trim().toLowerCase() &&
        String(e.cadeira || '').trim().toLowerCase() === cadeira.toLowerCase() &&
        String(e.ano || '').trim().toLowerCase() === ano.trim().toLowerCase()
    );

    if (duplicadoExato) {
        alert("⚠️ Este estudante já se encontra registado nesta mesma Unidade Curricular, Curso e Ano Letivo.");
        return;
    }

    const existenteGlobal = pautaEstado.estudantes.find(e => String(e.id).trim().toLowerCase() === idInput.toLowerCase());
    const idOficial = existenteGlobal ? existenteGlobal.id : idInput;
    const nomeOficial = existenteGlobal ? existenteGlobal.nome : nomeInput;
    const senhaOficial = existenteGlobal ? existenteGlobal.senha : senhaInput;

    let subNotasGeradas = {};
    const timestampCriacao = new Date().setHours(0, 0, 0, 0);

    const colsPresenca = obterColunasCadeira(curso, ano, cadeira, "Presenças");
    const colsTrabInd = obterColunasCadeira(curso, ano, cadeira, "Trabalhos Individuais");
    const colsTrabGrp = obterColunasCadeira(curso, ano, cadeira, "Trabalhos de Grupo");

    colsPresenca.forEach(col => {
        const timestampAula = parseDataColuna(col);
        if (timestampAula !== null && timestampAula < timestampCriacao) {
            subNotasGeradas["pres_" + col] = "F";
        } else {
            subNotasGeradas["pres_" + col] = "";
        }
    });

    colsTrabInd.forEach(col => {
        subNotasGeradas["indiv_" + col] = "";
    });

    colsTrabGrp.forEach(col => {
        subNotasGeradas["grp_" + col] = "";
    });

    pautaEstado.estudantes.push({
        id: idOficial,
        senha: senhaOficial,
        nome: nomeOficial,
        cadeira,
        estatuto,
        curso,
        ano,
        presenca: "",
        trabInd: "",
        trabGrp: "",
        teste1: "",
        teste2: "",
        exame: "",
        notaProf: "",
        subNotas: subNotasGeradas,
        dataCriacao: timestampCriacao,
        situacao: "Pendente"
    });

    await salvarNaNuvem();
    alert("✅ Estudante registado com sucesso!");

    document.getElementById('ce-id').value = "";
    document.getElementById('ce-senha').value = "";
    document.getElementById('ce-nome').value = "";
    document.getElementById('ce-cadeira').value = "";
    desbloquearELimparCamposEstudante('ambos');

    recarregarDadosDocente();
}

async function executarApagarEstudante() {
    const idApagar = document.getElementById('select-apagar-estudante').value;
    if (!idApagar) return;

    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;

    if (confirm("Tem certeza que deseja apagar este registo de estudante?")) {
        if (!isTodasUCSelecionada() && cursoSel && anoSel) {
            const ucFiltroNorm = String(obterFiltroUCGlobal()).trim().toLowerCase();
            pautaEstado.estudantes = pautaEstado.estudantes.filter(e => {
                const mesmoRegisto = e.id === idApagar && e.curso === cursoSel && (e.ano === anoSel || !e.ano);
                if (!mesmoRegisto) return true;
                const ucEst = String(e.cadeira || 'Geral').trim().toLowerCase();
                return ucEst !== ucFiltroNorm;
            });
        } else {
            pautaEstado.estudantes = pautaEstado.estudantes.filter(e => e.id !== idApagar);
        }
        await salvarNaNuvem();
        alert("Registo apagado.");
        recarregarDadosDocente();
    }
}

// ================= GESTÃO DA SECÇÃO DE ATUALIZAÇÃO EM MASSA =================
function controlarCamposAtualizacao() {
    const tipoSecao = document.getElementById('act-secao-tipo').value;
    const grupoSubNota = document.getElementById('grupo-sub-nota');
    const grupoSubColuna = document.getElementById('grupo-sub-coluna');
    const containerTabelaMassa = document.getElementById('grupo-tabela-massa') || criarContainerTabelaMassa();
    const containerDadosGerais = document.getElementById('grupo-dados-gerais') || criarContainerDadosGerais();

    if (tipoSecao === "dados") {
        if (grupoSubNota) grupoSubNota.style.display = "none";
        if (grupoSubColuna) grupoSubColuna.style.display = "none";
        containerTabelaMassa.style.display = "none";
        containerDadosGerais.style.display = "block";
        carregarSelectEstudantesUnico();
        preencherCamposDadosGerais();
    } else if (tipoSecao === "notas") {
        containerDadosGerais.style.display = "none";
        containerTabelaMassa.style.display = "block";
        if (grupoSubNota) grupoSubNota.style.display = "block";
        atualizarOpcoesNotaAtualizacaoMassa();
    }
}

function criarContainerTabelaMassa() {
    const secaoAtualizar = document.getElementById('subseccao-actualizar');
    if (!secaoAtualizar) return null;

    let div = document.getElementById('grupo-tabela-massa');
    if (div) div.remove();

    div = document.createElement('div');
    div.id = 'grupo-tabela-massa';
    div.style.marginTop = '15px';
    secaoAtualizar.appendChild(div);
    return div;
}

function criarContainerDadosGerais() {
    const secaoAtualizar = document.getElementById('subseccao-actualizar');
    if (!secaoAtualizar) return null;

    let div = document.getElementById('grupo-dados-gerais');
    if (div) div.remove();

    const cursosUnicos = [...new Set(pautaEstado.estudantes.map(e => e.curso).filter(Boolean))];
    const estatutosUnicos = [...new Set(pautaEstado.estudantes.map(e => e.estatuto).filter(Boolean))];
    const anosUnicos = [...new Set(pautaEstado.estudantes.map(e => e.ano).filter(Boolean))];

    div = document.createElement('div');
    div.id = 'grupo-dados-gerais';
    div.className = 'pauta-grid-3col';
    div.style.marginTop = '20px';

    div.innerHTML = `
    <div class="pauta-form-row">
        <div class="pauta-form-group">
            <label>ID do Estudante a Editar Dados:</label>
            <select id="act-estudante-id-unico" class="pauta-input" onchange="preencherCamposDadosGerais()"></select>
        </div>
        <div class="pauta-form-group">
            <label>Nome:</label>
            <input type="text" id="act-dg-nome" class="pauta-input" placeholder="Nome Completo">
        </div>
        <div class="pauta-form-group">
            <label>Curso:</label>
            <select id="act-dg-curso" class="pauta-input">
                ${cursosUnicos.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
        </div>
        <div class="pauta-form-group">
            <label>Unidade Curricular:</label>
            <input type="text" id="act-dg-cadeira" class="pauta-input" placeholder="Cadeira">
        </div>
        <div class="pauta-form-group">
            <label>Estatuto:</label>
            <select id="act-dg-estatuto" class="pauta-input">
                ${estatutosUnicos.map(e => `<option value="${e}">${e}</option>`).join('')}
            </select>
        </div>
        <div class="pauta-form-group">
            <label>Ano Letivo:</label>
            <select id="act-dg-ano" class="pauta-input">
                ${anosUnicos.map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>
        </div>
    </div>
    <button type="button" class="pauta-btn" style="margin-top: 15px;" onclick="executarAtualizacaoDadosEstudante()">💾 Guardar Dados Alterados</button>
    `;

    secaoAtualizar.appendChild(div);
    carregarSelectEstudantesUnico();
    return div;
}

function carregarSelectEstudantesUnico() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;

    const filtrados = pautaEstado.estudantes.filter(e =>
        e.curso === cursoSel &&
        (e.ano === anoSel || !e.ano) &&
        estudanteCorrespondeUCGlobal(e)
    );
    const selectEst = document.getElementById('act-estudante-id-unico');
    if (!selectEst) return;

    selectEst.innerHTML = "";
    if (filtrados.length === 0) {
        selectEst.innerHTML = `<option value="" disabled selected>-- Nenhum estudante neste curso e ano --</option>`;
        preencherCamposDadosGerais();
        return;
    }

    filtrados.forEach(est => {
        selectEst.innerHTML += `<option value="${est.id}">${est.id} - ${est.nome} (${est.cadeira || 'Geral'})</option>`;
    });
    preencherCamposDadosGerais();
}

function preencherCamposDadosGerais() {
    const idEst = document.getElementById('act-estudante-id-unico')?.value;
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;

    const est = pautaEstado.estudantes.find(e =>
        e.id === idEst &&
        e.curso === cursoSel &&
        (e.ano === anoSel || !e.ano) &&
        estudanteCorrespondeUCGlobal(e)
    );
    if (!est) {
        if (document.getElementById('act-dg-nome')) {
            document.getElementById('act-dg-nome').value = "";
            document.getElementById('act-dg-cadeira').value = "";
        }
        return;
    }

    if (document.getElementById('act-dg-nome')) {
        document.getElementById('act-dg-nome').value = est.nome || "";
        document.getElementById('act-dg-curso').value = est.curso || "";
        document.getElementById('act-dg-cadeira').value = est.cadeira || "";
        document.getElementById('act-dg-estatuto').value = est.estatuto || "";
        document.getElementById('act-dg-ano').value = est.ano || "";
    }
}

async function executarAtualizacaoDadosEstudante() {
    const idEst = document.getElementById('act-estudante-id-unico').value;
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;

    const est = pautaEstado.estudantes.find(e =>
        e.id === idEst &&
        e.curso === cursoSel &&
        (e.ano === anoSel || !e.ano) &&
        estudanteCorrespondeUCGlobal(e)
    );
    if (!est) return;

    const novoNome = document.getElementById('act-dg-nome').value.trim();
    const novoCurso = document.getElementById('act-dg-curso').value;
    const novaCadeira = document.getElementById('act-dg-cadeira').value.trim();
    const novoEstatuto = document.getElementById('act-dg-estatuto').value;
    const novoAno = document.getElementById('act-dg-ano').value;

    if (!novoNome) {
        alert("O nome não pode estar vazio.");
        return;
    }

    est.nome = novoNome;
    est.curso = novoCurso;
    est.cadeira = novaCadeira;
    est.estatuto = novoEstatuto;
    est.ano = novoAno;

    await salvarNaNuvem();
    alert("✅ Dados do estudante atualizados com sucesso!");
    recarregarDadosDocente();
}

function atualizarOpcoesNotaAtualizacaoMassa() {
    const tipoNota = document.getElementById('act-nota-tipo').value;
    const grupoSubNota = document.getElementById('grupo-sub-nota');
    const grupoSubColuna = document.getElementById('grupo-sub-coluna');
    const selectSub = document.getElementById('act-subcoluna-select');
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;

    const requerSubColuna = (tipoNota === "TrabalhosIndividuais" || tipoNota === "TrabalhoGrupo" || tipoNota === "Presenca");

    if (requerSubColuna && grupoSubColuna) {
        grupoSubColuna.style.display = "block";

        if (selectSub) {
            selectSub.innerHTML = "";
            let nomeCategoria = tipoNota === "Presenca" ? "Presenças" : (tipoNota === "TrabalhosIndividuais" ? "Trabalhos Individuais" : "Trabalhos de Grupo");

            const estudantesCursoAno = pautaEstado.estudantes.filter(e =>
                e.curso === cursoSel &&
                (e.ano === anoSel || !e.ano) &&
                estudanteCorrespondeUCGlobal(e)
            );
            let cadeirasCursoAno = [...new Set(estudantesCursoAno.map(e => e.cadeira || "Geral"))];
            if (cadeirasCursoAno.length === 0 && !isTodasUCSelecionada()) {
                cadeirasCursoAno = [obterFiltroUCGlobal()];
            }

            let colunasEncontradas = [];
            cadeirasCursoAno.forEach(cad => {
                const cols = obterColunasCadeira(cursoSel, anoSel, cad, nomeCategoria);
                cols.forEach(c => {
                    if (!colunasEncontradas.includes(c)) colunasEncontradas.push(c);
                });
            });

            if (colunasEncontradas.length === 0) {
                selectSub.innerHTML = `<option value="" disabled selected>-- Nenhuma coluna criada nas Planilhas para este curso/ano --</option>`;
            } else {
                colunasEncontradas.forEach(col => {
                    selectSub.innerHTML += `<option value="${col}">${col}</option>`;
                });
            }
        }
    } else {
        if (grupoSubColuna) grupoSubColuna.style.display = "none";
    }

    renderizarTabelaAtualizacaoMassa();
}

function renderizarTabelaAtualizacaoMassa() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;
    const container = document.getElementById('grupo-tabela-massa');
    if (!container) return;

    if (!cursoSel || !anoSel) {
        container.innerHTML = "<p>Selecione o curso e o ano letivo no painel superior.</p>";
        return;
    }

    const filtrados = pautaEstado.estudantes.filter(e =>
        e.curso === cursoSel &&
        (e.ano === anoSel || !e.ano) &&
        estudanteCorrespondeUCGlobal(e)
    );
    const tipoNota = document.getElementById('act-nota-tipo').value;
    const selectSub = document.getElementById('act-subcoluna-select');
    const subCol = selectSub ? selectSub.value : "";

    let html = `
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 15px;">
            <h4 style="margin-top: 0; color: #1e293b;">📋 Lançamento em Massa (${tipoNota}${subCol ? ' - ' + subCol : ''})</h4>
            <p style="font-size: 0.9em; color: #64748b; margin-bottom: 15px;">Insira os valores para cada estudante e clique em 'Guardar Todos'.</p>
            
            <div style="max-height: 400px; overflow-y: auto; border: 1px solid #cbd5e1; border-radius: 6px; background: white;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                    <thead>
                        <tr style="background: #e2e8f0; color: #1e293b; text-align: left; position: sticky; top: 0;">
                            <th style="padding: 10px;">ID</th>
                            <th style="padding: 10px;">Nome</th>
                            <th style="padding: 10px;">U.C. (Cadeira)</th>
                            <th style="padding: 10px; text-align: center;">Valor / Nota</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    if (filtrados.length === 0) {
        html += `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">Nenhum estudante encontrado para este curso, ano letivo e U.C.</td></tr>`;
    } else {
        filtrados.forEach(est => {
            let valorAtual = "";
            if (!est.subNotas) est.subNotas = {};

            if (tipoNota === "Presenca" && subCol) {
                valorAtual = est.subNotas["pres_" + subCol] !== undefined ? est.subNotas["pres_" + subCol] : "";
            } else if (tipoNota === "TrabalhosIndividuais" && subCol) {
                valorAtual = est.subNotas["indiv_" + subCol] !== undefined ? est.subNotas["indiv_" + subCol] : "";
            } else if (tipoNota === "TrabalhoGrupo" && subCol) {
                valorAtual = est.subNotas["grp_" + subCol] !== undefined ? est.subNotas["grp_" + subCol] : "";
            } else {
                const chaveNota = tipoNota === "Teste1" ? "teste1" :
                    tipoNota === "Teste2" ? "teste2" :
                        tipoNota === "Exame" ? "exame" : "notaProf";
                valorAtual = (est[chaveNota] !== undefined && est[chaveNota] !== null) ? est[chaveNota] : "";
            }

            html += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 10px;">${est.id}</td>
                    <td style="padding: 10px; font-weight: 500;">${est.nome}</td>
                    <td style="padding: 10px; color: #475569;">${est.cadeira || 'Geral'}</td>
                    <td style="padding: 10px; text-align: center;">
                        <input type="text" class="pauta-input input-massa-est" data-est-id="${est.id}" data-cadeira="${est.cadeira || ''}" value="${valorAtual}" placeholder="${tipoNota === 'Presenca' ? 'P / F' : 'Nota'}" style="width: 100px; text-align: center; padding: 6px;">
                    </td>
                </tr>
            `;
        });
    }

    html += `
                    </tbody>
                </table>
            </div>
            <button type="button" class="pauta-btn" style="margin-top: 20px; background-color: #16a34a; color: white; width: 100%; padding: 12px; font-weight: bold;" onclick="executarAtualizacaoMassa()">💾 Guardar Todos em Massa</button>
        </div>
    `;

    container.innerHTML = html;
}

async function executarAtualizacaoMassa() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;
    const tipoNota = document.getElementById('act-nota-tipo').value;
    const selectSub = document.getElementById('act-subcoluna-select');
    const subCol = selectSub ? selectSub.value : "";

    const inputs = document.querySelectorAll('.input-massa-est');

    inputs.forEach(input => {
        const estId = input.getAttribute('data-est-id');
        const estCadeira = input.getAttribute('data-cadeira');
        const novoValor = input.value.trim();

        const registos = pautaEstado.estudantes.filter(e => e.id === estId && e.curso === cursoSel && (e.ano === anoSel || !e.ano) && (e.cadeira || '') === estCadeira);

        registos.forEach(est => {
            if (!est.subNotas) est.subNotas = {};

            if (tipoNota === "Presenca") {
                if (subCol) est.subNotas["pres_" + subCol] = novoValor.toUpperCase();
            } else if (tipoNota === "TrabalhosIndividuais") {
                if (subCol) est.subNotas["indiv_" + subCol] = novoValor;
            } else if (tipoNota === "TrabalhoGrupo") {
                if (subCol) est.subNotas["grp_" + subCol] = novoValor;
            } else {
                if (tipoNota === "Teste1") est.teste1 = novoValor;
                if (tipoNota === "Teste2") est.teste2 = novoValor;
                if (tipoNota === "Exame") est.exame = novoValor;
                if (tipoNota === "NotaProfessor") est.notaProf = novoValor;
            }
        });
    });

    const sucesso = await salvarNaNuvem();
    if (sucesso) {
        alert("✅ Atualização em massa guardada e sincronizada com sucesso!");
        recarregarDadosDocente();
    }
}

// ================= PAINEL ESTUDANTE (CABEÇALHO MODERNO + ORDENAÇÃO + TABELAS) =================

function extrairPesoAnoLectivo(anoStr) {
    const match = String(anoStr || "").match(/(\d{4})/);
    return match ? parseInt(match[1], 10) : 0;
}

function ordenarRegistosPorAnoDesc(registos) {
    return [...registos].sort((a, b) => {
        const anoA = String(a.ano || "2025-2026").trim();
        const anoB = String(b.ano || "2025-2026").trim();
        const pesoA = extrairPesoAnoLectivo(anoA);
        const pesoB = extrairPesoAnoLectivo(anoB);

        if (pesoB !== pesoA) return pesoB - pesoA;
        return anoB.localeCompare(anoA);
    });
}

function formatarNomeCurso(cursoStr) {
    const raw = String(cursoStr || "Geral").trim();
    if (!raw) return "Geral";

    const mapaNomesCursos = {
        "biologia": "Biologia",
        "cienciasnaturais": "Ensino Básico - C. N. Sociais",
        "matematica": "Matemática",
        "economia": "Economia",
        "gestao-empresa": "Gestão de Empresa",
        "gestao-iscgvsm": "Gestão em Saúde - ISCSVSM",
        "enfermagem-a": "Enfermagem - A",
        "enfermagem-b": "Enfermagem - B",
        "contabilidade": "Contabilidade",
        "agronomia": "Agronomia",
        "turismo": "Turismo",
        "geografia": "Geografia",
        "educacao-infancia": "Educação de Infância"
    };

    const chave = raw.toLowerCase();
    if (mapaNomesCursos[chave]) {
        return mapaNomesCursos[chave];
    }

    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function deveMostrarBadgeActual(reg, anoMaisRecente) {
    const anoTexto = String(reg.ano || "2025-2026").trim();
    if (anoTexto !== anoMaisRecente) {
        return false;
    }

    const sitLower = String(reg.situacao || "").toLowerCase();
    const estaAprovado = sitLower.includes("aprovado");

    if (!estaAprovado) {
        if (reg.dataAprovacao) {
            delete reg.dataAprovacao;
        }
        return true;
    }

    if (!reg.dataAprovacao) {
        reg.dataAprovacao = Date.now();
    }

    const dataAprov = new Date(reg.dataAprovacao);
    if (isNaN(dataAprov.getTime())) {
        return false;
    }

    const limiteTresMeses = new Date(dataAprov.getTime());
    limiteTresMeses.setMonth(limiteTresMeses.getMonth() + 3);

    const hoje = new Date();
    return hoje <= limiteTresMeses;
}

function alterarFotoEstudante(event, estudanteId) {
    const ficheiro = event.target.files && event.target.files[0];
    if (!ficheiro) return;

    if (!ficheiro.type.startsWith('image/')) {
        alert("⚠️ Por favor, selecione um ficheiro de imagem válido (JPG, PNG, WEBP).");
        return;
    }

    const leitor = new FileReader();
    leitor.onload = function (e) {
        const img = new Image();
        img.onload = async function () {
            const maxTamanho = 240;
            let largura = img.width;
            let altura = img.height;

            if (largura > altura) {
                if (largura > maxTamanho) {
                    altura = Math.round((altura * maxTamanho) / largura);
                    largura = maxTamanho;
                }
            } else {
                if (altura > maxTamanho) {
                    largura = Math.round((largura * maxTamanho) / altura);
                    altura = maxTamanho;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = largura;
            canvas.height = altura;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, largura, altura);

            const fotoBase64 = canvas.toDataURL('image/jpeg', 0.82);

            pautaEstado.estudantes.forEach(reg => {
                if (String(reg.id).trim().toLowerCase() === String(estudanteId).trim().toLowerCase()) {
                    reg.foto = fotoBase64;
                }
            });

            const avatarBox = document.getElementById('est-avatar-box');
            if (avatarBox) {
                avatarBox.innerHTML = `<img src="${fotoBase64}" alt="Foto do estudante" class="est-avatar-img">`;
            }

            await salvarNaNuvem();
        };
        img.src = e.target.result;
    };
    leitor.readAsDataURL(ficheiro);
}

// PAINEL ESTUDANTE (TABELAS COMPACTAS POR REGISTO: SEM "-" ESPALHADOS NEM IR ATÉ AO FIM)
function entrarPainelEstudante(estudante) {
    document.getElementById('pauta-login-section').classList.add('pauta-hidden');
    document.getElementById('vista-docente').classList.add('pauta-hidden');
    document.getElementById('vista-estudante').classList.remove('pauta-hidden');

    const registosBrutos = pautaEstado.estudantes.filter(e => e.id === estudante.id);
    const registosEstudante = ordenarRegistosPorAnoDesc(registosBrutos);
    const primeiroRegisto = registosEstudante[0] || estudante;

    registosEstudante.forEach(reg => {
        reg.trabInd = calcularMediaTrabalhos(reg, "Trabalhos Individuais", reg.curso);
        reg.trabGrp = calcularMediaTrabalhos(reg, "Trabalhos de Grupo", reg.curso);
        const notaPresCalc = calcularNotaPresenca(reg, reg.curso);
        if (notaPresCalc !== null) reg.presenca = notaPresCalc;

        const avaliacao = calcularSituacaoEstudante(reg, reg.curso);
        reg.situacao = avaliacao.texto;
        reg._valorNota = avaliacao.valor;

        if (String(reg.situacao || "").toLowerCase().includes("aprovado")) {
            if (!reg.dataAprovacao) {
                reg.dataAprovacao = Date.now();
            }
        } else if (reg.dataAprovacao) {
            delete reg.dataAprovacao;
        }
    });

    renderizarCabecalhoEstudante(primeiroRegisto, registosEstudante);

    const theadEstResumo = document.getElementById('thead-estudante-resumo') || document.querySelector('#tabela-estudante-resumo')?.parentElement.querySelector('thead');
    if (theadEstResumo) {
        theadEstResumo.innerHTML = `<tr>
            <th>Curso</th><th>U.C.</th><th>Ano Letivo</th><th>Estatuto</th>
            <th>Presença</th><th>Trab. Ind.</th><th>Trab. Grupo</th>
            <th>1º Teste</th><th>2º Teste</th><th>Exame</th><th>Nota Prof.</th><th>Situação</th>
        </tr>`;
    }

    function obterTbodySeguro(idElemento) {
        let el = document.getElementById(idElemento);
        if (!el) return null;
        if (el.tagName.toLowerCase() === 'table') {
            let tbody = el.querySelector('tbody');
            if (!tbody) {
                tbody = document.createElement('tbody');
                el.appendChild(tbody);
            }
            return tbody;
        }
        return el;
    }

    const tbodyEstResumo = obterTbodySeguro('tabela-estudante-resumo');
    const tbodyEstPresenca = obterTbodySeguro('tabela-estudante-presenca');
    const tbodyEstTrabInd = obterTbodySeguro('tabela-estudante-trabind');
    const tbodyEstTrabGrp = obterTbodySeguro('tabela-estudante-trabgrp');

    if (tbodyEstResumo) tbodyEstResumo.innerHTML = "";
    if (tbodyEstPresenca) tbodyEstPresenca.innerHTML = "";
    if (tbodyEstTrabInd) tbodyEstTrabInd.innerHTML = "";
    if (tbodyEstTrabGrp) tbodyEstTrabGrp.innerHTML = "";

    let maxColsPresenca = 1;
    let maxColsTrabInd = 1;
    let maxColsTrabGrp = 1;

    registosEstudante.forEach(reg => {
        const anoReg = reg.ano || "2025-2026";
        const cP = obterColunasCadeira(reg.curso, anoReg, reg.cadeira, "Presenças").length;
        const cTI = obterColunasCadeira(reg.curso, anoReg, reg.cadeira, "Trabalhos Individuais").length;
        const cTG = obterColunasCadeira(reg.curso, anoReg, reg.cadeira, "Trabalhos de Grupo").length;

        if (cP > maxColsPresenca) maxColsPresenca = cP;
        if (cTI > maxColsTrabInd) maxColsTrabInd = cTI;
        if (cTG > maxColsTrabGrp) maxColsTrabGrp = cTG;
    });

    const theadEstPresenca = document.getElementById('thead-estudante-presenca');
    if (theadEstPresenca) {
        theadEstPresenca.innerHTML = montarTheadSemDuplicacao(["Curso", "U.C.", "Ano"], "Presenças", maxColsPresenca);
    }

    const theadEstTrabInd = document.getElementById('thead-estudante-trabind');
    if (theadEstTrabInd) {
        theadEstTrabInd.innerHTML = montarTheadSemDuplicacao(["Curso", "U.C.", "Ano"], "Trabalhos Individuais", maxColsTrabInd);
    }

    const theadEstTrabGrp = document.getElementById('thead-estudante-trabgrp');
    if (theadEstTrabGrp) {
        theadEstTrabGrp.innerHTML = montarTheadSemDuplicacao(["Curso", "U.C.", "Ano"], "Trabalhos de Grupo", maxColsTrabGrp);
    }

    function renderizarBlocoRegistoIndividual(tbody, reg, colsCadeira, prefixoChave, valorSemColunasFallback) {
        if (!tbody) return;

        const cursoFormatado = formatarNomeCurso(reg.curso);
        const cadeiraFormatada = reg.cadeira || 'Geral';
        const anoFormatado = reg.ano || '2025-2026';
        const qtdCols = colsCadeira.length > 0 ? colsCadeira.length : 1;
        const spanRestante = Math.max(1, (tbody.closest('table')?.querySelector('thead th[colspan]')?.colSpan || qtdCols) - qtdCols);

        let linhaDatas = `<tr style="background-color: #f8fafc; font-weight: bold; color: #1e293b;">
            <td colspan="3" style="border-right: none; font-size: 0.85em; color: blue;">${cadeiraFormatada} (${anoFormatado})</td>`;

        if (colsCadeira.length > 0) {
            colsCadeira.forEach(col => {
                linhaDatas += `<td style="font-size: 0.88em; text-align: center; white-space: nowrap;">${col}</td>`;
            });
        } else {
            linhaDatas += `<td style="font-size: 0.88em; text-align: center;">Geral</td>`;
        }

        if (spanRestante > 0) {
            linhaDatas += `<td colspan="${spanRestante}"></td>`;
        }
        linhaDatas += `</tr>`;

        let linhaValores = `<tr>
            <td>${cursoFormatado}</td>
            <td>${cadeiraFormatada}</td>
            <td>${anoFormatado}</td>`;

        if (colsCadeira.length > 0) {
            colsCadeira.forEach(col => {
                const chave = prefixoChave + col;
                const val = (reg.subNotas && reg.subNotas[chave] !== undefined) ? reg.subNotas[chave] : "---";
                linhaValores += `<td style="text-align: center; white-space: nowrap;">${formatarNota(val)}</td>`;
            });
        } else {
            linhaValores += `<td style="text-align: center;">${valorSemColunasFallback}</td>`;
        }

        if (spanRestante > 0) {
            linhaValores += `<td colspan="${spanRestante}"></td>`;
        }
        linhaValores += `</tr>`;

        tbody.innerHTML += linhaDatas + linhaValores;
    }

    registosEstudante.forEach(reg => {
        const cursoFormatado = formatarNomeCurso(reg.curso);
        const anoReg = reg.ano || "2025-2026";

        if (tbodyEstResumo) {
            tbodyEstResumo.innerHTML += `<tr>
                <td>${cursoFormatado}</td><td>${reg.cadeira || '-'}</td><td>${anoReg}</td><td>${reg.estatuto}</td>
                <td>${formatarNota(reg.presenca)}</td><td>${formatarNota(reg.trabInd)}</td><td>${formatarNota(reg.trabGrp)}</td>
                <td>${formatarNota(reg.teste1)}</td><td>${formatarNota(reg.teste2)}</td><td>${formatarNota(reg.exame)}</td><td>${formatarNota(reg.notaProf)}</td><td><strong>${reg.situacao}</strong></td>
            </tr>`;
        }

        const colsCadeiraPres = obterColunasCadeira(reg.curso, anoReg, reg.cadeira, "Presenças");
        const colsCadeiraTI = obterColunasCadeira(reg.curso, anoReg, reg.cadeira, "Trabalhos Individuais");
        const colsCadeiraTG = obterColunasCadeira(reg.curso, anoReg, reg.cadeira, "Trabalhos de Grupo");

        renderizarBlocoRegistoIndividual(tbodyEstPresenca, reg, colsCadeiraPres, "pres_", formatarNota(reg.presenca));
        renderizarBlocoRegistoIndividual(tbodyEstTrabInd, reg, colsCadeiraTI, "indiv_", "---");
        renderizarBlocoRegistoIndividual(tbodyEstTrabGrp, reg, colsCadeiraTG, "grp_", "---");
    });

    renderizarGraficoEstudante(registosEstudante);
}

// Constrói o cabeçalho visual do estudante com avatar editável e histórico ordenado por ano decrescente
function renderizarCabecalhoEstudante(primeiroRegisto, registosEstudante) {
    const vistaEstudante = document.getElementById('vista-estudante');
    if (!vistaEstudante) return;

    const lblNomeAntigo = document.getElementById('est-lbl-nome');
    const cardCabecalho = lblNomeAntigo ? lblNomeAntigo.closest('.pauta-card') : vistaEstudante.querySelector('.pauta-card');
    if (!cardCabecalho) return;

    const regComFoto = registosEstudante.find(r => r.foto);
    const fotoAtual = (regComFoto && regComFoto.foto) || primeiroRegisto.foto || "";

    const anoMaisRecente = (registosEstudante[0] && String(registosEstudante[0].ano || "2025-2026").trim()) || "2025-2026";

    const gruposPorCurso = {};
    registosEstudante.forEach(reg => {
        const nomeCurso = formatarNomeCurso(reg.curso);
        if (!gruposPorCurso[nomeCurso]) {
            gruposPorCurso[nomeCurso] = [];
        }
        gruposPorCurso[nomeCurso].push(reg);
    });

    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const hoje = new Date();
    const dataAtualizadaStr = `${String(hoje.getDate()).padStart(2, '0')} ${meses[hoje.getMonth()]} ${hoje.getFullYear()}`;

    let htmlCursos = "";
    Object.keys(gruposPorCurso).forEach(cursoNome => {
        const cadeiras = ordenarRegistosPorAnoDesc(gruposPorCurso[cursoNome]);

        const temEmCurso = cadeiras.some(c => {
            const sit = (c.situacao || "").toLowerCase();
            return sit.includes("pendente") || sit.includes("exame");
        });

        htmlCursos += `<div class="est-curso-bloco">
            <div class="est-curso-titulo"><span style="font-weight: 750; color: blue;">Curso:</span> ${cursoNome}</div>`;

        if (temEmCurso) {
            htmlCursos += `<div class="est-curso-sublabel">Inscrições / U.C.</div>`;
        }

        cadeiras.forEach(reg => {
            const sit = (reg.situacao || "Pendente");
            const sitLower = sit.toLowerCase();
            const notaVal = (reg._valorNota !== undefined && reg._valorNota !== "-") ? `(${reg._valorNota})` : "";
            const anoTexto = reg.ano || "2025-2026";
            const cadeiraTexto = reg.cadeira || "Geral";
            const mostrarActual = deveMostrarBadgeActual(reg, anoMaisRecente);

            let badgeHtml = "";

            if (sitLower.includes("aprovado")) {
                badgeHtml = `
                    ${mostrarActual ? `<span class="est-badge est-badge-atual">Actual</span>` : ""}
                    <span class="est-badge est-badge-aprovado">Aprovado</span>
                    ${notaVal ? `<span class="est-nota-final">${notaVal}</span>` : ""}
                `;
            } else if (sitLower.includes("reprovado")) {
                badgeHtml = `
                    ${mostrarActual ? `<span class="est-badge est-badge-atual">Actual</span>` : ""}
                    <span class="est-badge est-badge-reprovado">Reprovado</span>
                    ${notaVal ? `<span class="est-nota-final">${notaVal}</span>` : ""}
                `;
            } else if (sitLower.includes("exame")) {
                badgeHtml = `
                    ${mostrarActual ? `<span class="est-badge est-badge-atual">Actual</span>` : ""}
                    <span class="est-badge est-badge-curso">Em Curso</span>
                    <span class="est-badge est-badge-exame">Exame ${notaVal}</span>
                `;
            } else {
                badgeHtml = `
                    ${mostrarActual ? `<span class="est-badge est-badge-atual">Actual</span>` : ""}
                    <span class="est-badge est-badge-curso">Em Curso</span>
                `;
            }

            htmlCursos += `
                <div class="est-cadeira-linha">
                    <span class="est-cadeira-nome">${cadeiraTexto}</span>
                    <span class="est-cadeira-ano">${anoTexto}</span>
                    <div class="est-badges-grupo">${badgeHtml}</div>
                </div>
            `;
        });

        htmlCursos += `</div>`;
    });

    const btnSair = cardCabecalho.querySelector('button[onclick*="terminarSessao"]');
    const btnSairHtml = btnSair ? `<div class="est-header-actions">${btnSair.outerHTML}</div>` : "";

    const conteudoAvatar = fotoAtual
        ? `<img src="${fotoAtual}" alt="Foto do estudante" class="est-avatar-img">`
        : `<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
               <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
               <circle cx="12" cy="7" r="4"></circle>
           </svg>`;

    cardCabecalho.classList.add('est-header-card');
    cardCabecalho.innerHTML = `
        ${btnSairHtml}
        <div class="est-header-grid">
            <div class="est-col-esquerda">
                <div class="est-sec-titulo">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>Informações Gerais do Estudante</span>
                </div>

                <div class="est-perfil-box">
                    <div class="est-avatar-wrapper">
                        <div class="est-avatar" id="est-avatar-box" title="Clique na câmara para adicionar ou alterar foto">
                            ${conteudoAvatar}
                        </div>
                        <label for="est-input-foto" class="est-avatar-btn" title="Adicionar ou alterar foto">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                            </svg>
                        </label>
                        <input type="file" id="est-input-foto" accept="image/*" style="display:none;" onchange="alterarFotoEstudante(event, '${primeiroRegisto.id}')">
                    </div>

                    <div class="est-dados-pessoais">
                        <div class="est-campo-label">Nome</div>
                        <div class="est-nome-valor" id="est-lbl-nome">${primeiroRegisto.nome}</div>

                        <div class="est-meta-linha">
                            <div>
                                <div class="est-campo-label">Grau / Nível</div>
                                <div class="est-meta-valor" id="est-lbl-curso">Licenciatura</div>
                            </div>
                            <div>
                                <div class="est-campo-label">ID Estudante</div>
                                <div class="est-meta-valor" id="est-lbl-id">${primeiroRegisto.id}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="est-col-direita">
                <div class="est-hist-titulo">Histórico Académico</div>
                <div class="est-cursos-lista">
                    ${htmlCursos}
                </div>
            </div>
        </div>

        <div class="est-header-rodape">
            Atualizado em: ${dataAtualizadaStr}
        </div>
    `;
}

// GRÁFICOS (Chart.js)
function renderizarGraficoTurma(estudantes) {
    const ctx = document.getElementById('chart-docente-turma').getContext('2d');
    if (graficoTurmaInstancia) graficoTurmaInstancia.destroy();

    const dadosNotas = estudantes.map(e => {
        const aval = calcularSituacaoEstudante(e);

        if (aval && typeof aval.valor === 'number' && !isNaN(aval.valor)) {
            return aval.valor;
        }

        if (aval && aval.texto) {
            const match = aval.texto.match(/\((\d+(\.\d+)?)\)/);
            if (match) {
                const num = parseFloat(match[1]);
                if (!isNaN(num)) return num;
            }
        }

        const notaEx = parseNota(e.exame);
        return notaEx !== null ? notaEx : 0;
    });

    graficoTurmaInstancia = new Chart(ctx, {
        type: 'line',
        data: {
            labels: estudantes.map(e => e.id),
            datasets: [{
                label: 'Desempenho Académico (Nota)',
                data: dadosNotas,
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                borderColor: 'rgba(37, 99, 235, 1)',
                borderWidth: 2,
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 20
                }
            }
        }
    });
}

function renderizarGraficoEstudante(registos) {
    const ctx = document.getElementById('chart-estudante-notas').getContext('2d');
    if (graficoEstudanteInstancia) graficoEstudanteInstancia.destroy();

    const paletaCores = [
        { bg: 'rgba(22, 163, 74, 0.2)', border: 'rgba(16, 185, 129, 1)' },
        { bg: 'rgba(37, 99, 235, 0.2)', border: 'rgba(37, 99, 235, 1)' },
        { bg: 'rgba(234, 179, 8, 0.2)', border: 'rgba(202, 138, 4, 1)' },
        { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(220, 38, 38, 1)' },
        { bg: 'rgba(168, 85, 247, 0.2)', border: 'rgba(147, 51, 234, 1)' },
        { bg: 'rgba(236, 72, 153, 0.2)', border: 'rgba(219, 39, 119, 1)' }
    ];

    const listaRegs = Array.isArray(registos) ? registos : [registos];

    const datasets = listaRegs.map((reg, index) => {
        const cor = paletaCores[index % paletaCores.length];
        const nomeCadeira = reg.cadeira || 'Geral';
        const nomeCurso = formatarNomeCurso(reg.curso || '');
        const anoLetivo = reg.ano || '2025-2026';

        return {
            label: `${nomeCadeira} (${nomeCurso} · ${anoLetivo})`,
            data: [
                parseNota(reg.presenca) || 0,
                parseNota(reg.trabInd) || 0,
                parseNota(reg.trabGrp) || 0,
                parseNota(reg.teste1) || 0,
                parseNota(reg.teste2) || 0,
                parseNota(reg.exame) || 0,
                parseNota(reg.notaProf) || 0
            ],
            backgroundColor: cor.bg,
            borderColor: cor.border,
            borderWidth: 2
        };
    });

    graficoEstudanteInstancia = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Presença', 'Trab. Ind.', 'Trab. Grupo', '1º Teste', '2º Teste', 'Exame', 'Nota Prof.'],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 20
                }
            }
        }
    });
}

// OUVINTES DE EVENTOS GLOBAIS
document.addEventListener("DOMContentLoaded", () => {
    atualizarBarraControle4Colunas();

    const selectCurso = document.getElementById('docente-curso-global');
    const selectAno = document.getElementById('docente-ano-global');
    const selectNotaTipo = document.getElementById('act-nota-tipo');
    const selectSecaoTipo = document.getElementById('act-secao-tipo');
    const selectSubCol = document.getElementById('act-subcoluna-select');

    if (selectCurso) {
        selectCurso.addEventListener('change', () => {
            atualizarBarraControle4Colunas();
            const acao = document.getElementById('docente-acao-select').value;
            if (acao === "percentagens") {
                carregarCamposPercentagensAtuais();
            }
            if (acao === "planilha") {
                atualizarSelectCadeirasGestaoPlanilhas();
                carregarColunasDaPlanilha();
            }
            if (acao === "actualizar") {
                controlarCamposAtualizacao();
            }
            recarregarDadosDocente();
        });
    }

    if (selectAno) {
        selectAno.addEventListener('change', () => {
            atualizarBarraControle4Colunas();
            const acao = document.getElementById('docente-acao-select').value;
            if (acao === "percentagens") {
                carregarCamposPercentagensAtuais();
            }
            if (acao === "planilha") {
                atualizarSelectCadeirasGestaoPlanilhas();
                carregarColunasDaPlanilha();
            }
            if (acao === "actualizar") {
                controlarCamposAtualizacao();
            }
            recarregarDadosDocente();
        });
    }

    if (selectNotaTipo) {
        selectNotaTipo.addEventListener('change', atualizarOpcoesNotaAtualizacaoMassa);
    }

    if (selectSubCol) {
        selectSubCol.addEventListener('change', renderizarTabelaAtualizacaoMassa);
    }

    if (selectSecaoTipo) {
        selectSecaoTipo.addEventListener('change', controlarCamposAtualizacao);
    }
});

// ================= CONSULTA INDIVIDUAL NA VISÃO DOCENTE (ESPELHO DO ESTUDANTE) =================
// ================= CONSULTA INDIVIDUAL INDEPENDENTE NA VISÃO DOCENTE =================

let graficoEspelhoDocenteInstancia = null;

function garantirOpcaoConsultaIndividualNoMenu() {
    const selectAcao = document.getElementById('docente-acao-select');
    if (!selectAcao) return;

    if (!selectAcao.querySelector('option[value="consultar-estudante"]')) {
        const opt = document.createElement('option');
        opt.value = 'consultar-estudante';
        opt.textContent = '🔍 Consultar Estudante Individual';
        selectAcao.appendChild(opt);
    }
}

function abrirSecaoConsultaIndividualDocente() {
    let secao = document.getElementById('subseccao-consultar-estudante');

    if (!secao) {
        const refViz = document.getElementById('subseccao-visualizar');
        if (!refViz || !refViz.parentNode) return;

        secao = document.createElement('div');
        secao.id = 'subseccao-consultar-estudante';
        secao.className = 'pauta-subseccao';
        secao.innerHTML = `
            <div class="pauta-card" style="margin-bottom: 18px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);">
                <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:14px;">
                    <h3 style="margin:0; font-size:1.12em; color:#0f172a; display:flex; align-items:center; gap:8px;">
                        <span>🔍</span>
                        <span>Consulta Individual de Estudante</span>
                    </h3>
                </div>

                <div style="margin-left: 12px; padding: 14px 16px; border-radius: 8px; background: #f4f5f7; display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
                    <label for="docente-input-busca-id" style="font-size:0.95em; font-weight:600; color:#334155; white-space:nowrap;">ID ou Nome do Estudante:</label>
                    <input type="text" id="docente-input-busca-id" list="datalist-estudantes-docente"
                        placeholder="Digite o ID ou Nome do Estudante (ex: ECON2014 ou Wadiley ... "
                        autocomplete="off"
                        style="flex:1; min-width:240px; max-width:360px; padding:10px 14px; border:1.5px solid #cbd5e1; border-radius:8px; font-size:0.95em; color:#0f172a; background:#ffffff; outline:none; transition:border-color 0.2s, box-shadow 0.2s;"
                        onfocus="this.style.borderColor='#2563eb'; this.style.boxShadow='0 0 0 3px rgba(37,99,235,0.14)';"
                        onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none';">
                    <datalist id="datalist-estudantes-docente"></datalist>

                    <button type="button"
                        onclick="pesquisarEstudanteVisaoDocente()"
                        style="margin:0; padding:10px 18px; border:none; border-radius:8px; background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color:#ffffff; font-weight:600; font-size:0.92em; cursor:pointer; box-shadow:0 3px 10px rgba(37,99,235,0.28); display:inline-flex; align-items:center; gap:6px; transition:transform 0.15s ease, box-shadow 0.15s ease;"
                        onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 5px 14px rgba(37,99,235,0.36)';"
                        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 3px 10px rgba(37,99,235,0.28)';">
                        <span>🔎</span>
                        <span>Pesquisar</span>
                    </button>

                    <button type="button"
                        onclick="limparConsultaIndividualDocente()"
                        style="margin:0; padding:10px 16px; border:1px solid #cbd5e1; border-radius:8px; background:#f1f5f9; color:#334155; font-weight:600; font-size:0.92em; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:background 0.15s ease, color 0.15s ease;"
                        onmouseover="this.style.background='#e2e8f0'; this.style.color='#0f172a';"
                        onmouseout="this.style.background='#f1f5f9'; this.style.color='#334155';">
                        <span>✕</span>
                        <span>Limpar Campo</span>
                    </button>
                </div>
            </div>
            <div id="docente-ficha-espelho-container" style="display:none;"></div>
        `;

        refViz.parentNode.insertBefore(secao, refViz);

        const inputBusca = document.getElementById('docente-input-busca-id');
        inputBusca.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                pesquisarEstudanteVisaoDocente();
            }
        });
    }

    secao.classList.remove('pauta-hidden');
    atualizarDatalistEstudantesDocente();

    const input = document.getElementById('docente-input-busca-id');
    if (input) input.focus();
}

function atualizarDatalistEstudantesDocente() {
    const datalist = document.getElementById('datalist-estudantes-docente');
    if (!datalist) return;

    const mapaUnicos = new Map();
    (pautaEstado.estudantes || []).forEach(est => {
        const idNorm = String(est.id || '').trim();
        if (idNorm && !mapaUnicos.has(idNorm.toLowerCase())) {
            mapaUnicos.set(idNorm.toLowerCase(), { id: idNorm, nome: est.nome || '' });
        }
    });

    datalist.innerHTML = '';
    mapaUnicos.forEach(item => {
        datalist.innerHTML += `<option value="${item.id}">${item.id} - ${item.nome}</option>`;
    });
}

function limparConsultaIndividualDocente() {
    const input = document.getElementById('docente-input-busca-id');
    const container = document.getElementById('docente-ficha-espelho-container');
    if (input) {
        input.value = '';
        input.focus();
    }
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
}

function pesquisarEstudanteVisaoDocente() {
    const termo = (document.getElementById('docente-input-busca-id')?.value || '').trim().toLowerCase();
    if (!termo) {
        alert("⚠️ Digite o ID ou o Nome do estudante para pesquisar.");
        return;
    }

    let match = pautaEstado.estudantes.find(e => String(e.id || '').trim().toLowerCase() === termo);
    if (!match) {
        match = pautaEstado.estudantes.find(e =>
            String(e.id || '').trim().toLowerCase().includes(termo) ||
            String(e.nome || '').trim().toLowerCase().includes(termo)
        );
    }

    if (!match) {
        alert(`⚠️ Nenhum estudante encontrado para "${termo}".`);
        return;
    }

    renderizarFichaEspelhoNoDocente(match.id);
}

function renderizarFichaEspelhoNoDocente(estudanteId) {
    const container = document.getElementById('docente-ficha-espelho-container');
    if (!container) return;

    const registosBrutos = pautaEstado.estudantes.filter(
        e => String(e.id || '').trim().toLowerCase() === String(estudanteId).trim().toLowerCase()
    );
    if (registosBrutos.length === 0) return;

    const registosEstudante = ordenarRegistosPorAnoDesc(registosBrutos);
    const primeiroRegisto = registosEstudante[0];

    registosEstudante.forEach(reg => {
        reg.trabInd = calcularMediaTrabalhos(reg, "Trabalhos Individuais", reg.curso);
        reg.trabGrp = calcularMediaTrabalhos(reg, "Trabalhos de Grupo", reg.curso);
        const notaPresCalc = calcularNotaPresenca(reg, reg.curso);
        if (notaPresCalc !== null) reg.presenca = notaPresCalc;

        const avaliacao = calcularSituacaoEstudante(reg, reg.curso);
        reg.situacao = avaliacao.texto;
        reg._valorNota = avaliacao.valor;
    });

    const regComFoto = registosEstudante.find(r => r.foto);
    const fotoAtual = (regComFoto && regComFoto.foto) || primeiroRegisto.foto || "";
    const anoMaisRecente = String(primeiroRegisto.ano || "2025-2026").trim();

    const gruposPorCurso = {};
    registosEstudante.forEach(reg => {
        const nomeCurso = formatarNomeCurso(reg.curso);
        if (!gruposPorCurso[nomeCurso]) gruposPorCurso[nomeCurso] = [];
        gruposPorCurso[nomeCurso].push(reg);
    });

    let htmlCursos = "";
    Object.keys(gruposPorCurso).forEach(cursoNome => {
        const cadeiras = ordenarRegistosPorAnoDesc(gruposPorCurso[cursoNome]);
        const temEmCurso = cadeiras.some(c => {
            const sit = (c.situacao || "").toLowerCase();
            return sit.includes("pendente") || sit.includes("exame");
        });

        htmlCursos += `<div class="est-curso-bloco">
            <div class="est-curso-titulo"><span style="font-weight: 500; color: #64748b;">Curso:</span> ${cursoNome}</div>`;

        if (temEmCurso) {
            htmlCursos += `<div class="est-curso-sublabel">Inscrições / U.C.</div>`;
        }

        cadeiras.forEach(reg => {
            const sitLower = String(reg.situacao || "Pendente").toLowerCase();
            const notaVal = (reg._valorNota !== undefined && reg._valorNota !== "-") ? `(${reg._valorNota})` : "";
            const anoTexto = reg.ano || "2025-2026";
            const cadeiraTexto = reg.cadeira || "Geral";
            const mostrarActual = deveMostrarBadgeActual(reg, anoMaisRecente);

            let badgeHtml = "";
            if (sitLower.includes("aprovado")) {
                badgeHtml = `${mostrarActual ? `<span class="est-badge est-badge-atual">Actual</span>` : ""}
                    <span class="est-badge est-badge-aprovado">Aprovado</span>
                    ${notaVal ? `<span class="est-nota-final">${notaVal}</span>` : ""}`;
            } else if (sitLower.includes("reprovado")) {
                badgeHtml = `${mostrarActual ? `<span class="est-badge est-badge-atual">Actual</span>` : ""}
                    <span class="est-badge est-badge-reprovado">Reprovado</span>
                    ${notaVal ? `<span class="est-nota-final">${notaVal}</span>` : ""}`;
            } else if (sitLower.includes("exame")) {
                badgeHtml = `${mostrarActual ? `<span class="est-badge est-badge-atual">Actual</span>` : ""}
                    <span class="est-badge est-badge-curso">Em Curso</span>
                    <span class="est-badge est-badge-exame">Exame ${notaVal}</span>`;
            } else {
                badgeHtml = `${mostrarActual ? `<span class="est-badge est-badge-atual">Actual</span>` : ""}
                    <span class="est-badge est-badge-curso">Em Curso</span>`;
            }

            htmlCursos += `
                <div class="est-cadeira-linha">
                    <span class="est-cadeira-nome">${cadeiraTexto}</span>
                    <span class="est-cadeira-ano">${anoTexto}</span>
                    <div class="est-badges-grupo">${badgeHtml}</div>
                </div>`;
        });
        htmlCursos += `</div>`;
    });

    const conteudoAvatar = fotoAtual
        ? `<img src="${fotoAtual}" alt="Foto do estudante" class="est-avatar-img">`
        : `<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
               <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
               <circle cx="12" cy="7" r="4"></circle>
           </svg>`;

    const linhasResumoHtml = registosEstudante.map(reg => `<tr>
        <td>${formatarNomeCurso(reg.curso)}</td><td>${reg.cadeira || '-'}</td><td>${reg.ano || '2025-2026'}</td><td>${reg.estatuto}</td>
        <td>${formatarNota(reg.presenca)}</td><td>${formatarNota(reg.trabInd)}</td><td>${formatarNota(reg.trabGrp)}</td>
        <td>${formatarNota(reg.teste1)}</td><td>${formatarNota(reg.teste2)}</td><td>${formatarNota(reg.exame)}</td><td>${formatarNota(reg.notaProf)}</td><td><strong>${reg.situacao}</strong></td>
    </tr>`).join('');

    let maxP = 1, maxTI = 1, maxTG = 1;
    registosEstudante.forEach(reg => {
        const a = reg.ano || "2025-2026";
        maxP = Math.max(maxP, obterColunasCadeira(reg.curso, a, reg.cadeira, "Presenças").length);
        maxTI = Math.max(maxTI, obterColunasCadeira(reg.curso, a, reg.cadeira, "Trabalhos Individuais").length);
        maxTG = Math.max(maxTG, obterColunasCadeira(reg.curso, a, reg.cadeira, "Trabalhos de Grupo").length);
    });

    function gerarLinhasIndividuaisHtml(categoria, prefixo, maxCols, usarFallbackPresenca) {
        return registosEstudante.map(reg => {
            const a = reg.ano || "2025-2026";
            const cols = obterColunasCadeira(reg.curso, a, reg.cadeira, categoria);
            const cursoFmt = formatarNomeCurso(reg.curso);
            const cadFmt = reg.cadeira || 'Geral';
            const qtd = cols.length > 0 ? cols.length : 1;
            const spanResto = Math.max(0, maxCols - qtd);
            const corRotulo = typeof obterCorCadeiraAno === 'function' ? obterCorCadeiraAno(cadFmt, a) : '#475569';

            let lDatas = `<tr style="background-color:#f8fafc; font-weight:bold;">
                <td colspan="3" style="border-right:none; font-size:0.85em; color:${corRotulo};">${cadFmt} (${a})</td>`;
            if (cols.length > 0) {
                cols.forEach(c => lDatas += `<td style="font-size:0.88em; text-align:center; white-space:nowrap;">${c}</td>`);
            } else {
                lDatas += `<td style="font-size:0.88em; text-align:center;">Geral</td>`;
            }
            if (spanResto > 0) lDatas += `<td colspan="${spanResto}"></td>`;
            lDatas += `</tr>`;

            let lVals = `<tr><td>${cursoFmt}</td><td>${cadFmt}</td><td>${a}</td>`;
            if (cols.length > 0) {
                cols.forEach(c => {
                    const val = (reg.subNotas && reg.subNotas[prefixo + c] !== undefined) ? reg.subNotas[prefixo + c] : "---";
                    lVals += `<td style="text-align:center; white-space:nowrap;">${formatarNota(val)}</td>`;
                });
            } else {
                lVals += `<td style="text-align:center;">${usarFallbackPresenca ? formatarNota(reg.presenca) : '---'}</td>`;
            }
            if (spanResto > 0) lVals += `<td colspan="${spanResto}"></td>`;
            lVals += `</tr>`;

            return lDatas + lVals;
        }).join('');
    }

    container.innerHTML = `
        <div class="pauta-card est-header-card">
            <div class="est-header-grid">
                <div class="est-col-esquerda">
                    <div class="est-sec-titulo"><span>Informações Gerais do Estudante</span></div>
                    <div class="est-perfil-box">
                        <div class="est-avatar-wrapper">
                            <div class="est-avatar">${conteudoAvatar}</div>
                        </div>
                        <div class="est-dados-pessoais">
                            <div class="est-campo-label">Nome</div>
                            <div class="est-nome-valor">${primeiroRegisto.nome}</div>
                            <div class="est-meta-linha">
                                <div>
                                    <div class="est-campo-label">Grau / Nível</div>
                                    <div class="est-meta-valor">Licenciatura</div>
                                </div>
                                <div>
                                    <div class="est-campo-label">ID Estudante</div>
                                    <div class="est-meta-valor">${primeiroRegisto.id}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="est-col-direita">
                    <div class="est-hist-titulo">Histórico Académico</div>
                    <div class="est-cursos-lista">${htmlCursos}</div>
                </div>
            </div>
        </div>

        <div class="pauta-card" style="margin-top:16px; overflow-x:auto;">
            <h4>📊 Resumo Geral das Unidades Curriculares</h4>
            <table class="pauta-table">
                <thead>
                    <tr>
                        <th>Curso</th><th>U.C.</th><th>Ano Letivo</th><th>Estatuto</th>
                        <th>Presença</th><th>Trab. Ind.</th><th>Trab. Grupo</th>
                        <th>1º Teste</th><th>2º Teste</th><th>Exame</th><th>Nota Prof.</th><th>Situação</th>
                    </tr>
                </thead>
                <tbody>${linhasResumoHtml}</tbody>
            </table>
        </div>

        <div class="pauta-card" style="margin-top:16px; overflow-x:auto;">
            <h4>📅 Detalhe de Presenças</h4>
            <table class="pauta-table">
                <thead>${montarTheadSemDuplicacao(["Curso", "U.C.", "Ano"], "Presenças", maxP)}</thead>
                <tbody>${gerarLinhasIndividuaisHtml("Presenças", "pres_", maxP, true)}</tbody>
            </table>
        </div>

        <div class="pauta-card" style="margin-top:16px; overflow-x:auto;">
            <h4>📝 Detalhe de Trabalhos Individuais</h4>
            <table class="pauta-table">
                <thead>${montarTheadSemDuplicacao(["Curso", "U.C.", "Ano"], "Trabalhos Individuais", maxTI)}</thead>
                <tbody>${gerarLinhasIndividuaisHtml("Trabalhos Individuais", "indiv_", maxTI, false)}</tbody>
            </table>
        </div>

        <div class="pauta-card" style="margin-top:16px; overflow-x:auto;">
            <h4>👥 Detalhe de Trabalhos de Grupo</h4>
            <table class="pauta-table">
                <thead>${montarTheadSemDuplicacao(["Curso", "U.C.", "Ano"], "Trabalhos de Grupo", maxTG)}</thead>
                <tbody>${gerarLinhasIndividuaisHtml("Trabalhos de Grupo", "grp_", maxTG, false)}</tbody>
            </table>
        </div>

        <div class="pauta-card" style="margin-top:16px;">
            <h4>🕸️ Gráfico Comparativo de Desempenho</h4>
            <div style="height:340px; position:relative;">
                <canvas id="chart-docente-espelho-estudante"></canvas>
            </div>
        </div>
    `;

    container.style.display = 'block';

    const canvas = document.getElementById('chart-docente-espelho-estudante');
    if (canvas && typeof Chart !== 'undefined') {
        const ctx = canvas.getContext('2d');
        if (graficoEspelhoDocenteInstancia) graficoEspelhoDocenteInstancia.destroy();

        const paletaCores = [
            { bg: 'rgba(22, 163, 74, 0.2)', border: 'rgba(16, 185, 129, 1)' },
            { bg: 'rgba(37, 99, 235, 0.2)', border: 'rgba(37, 99, 235, 1)' },
            { bg: 'rgba(234, 179, 8, 0.2)', border: 'rgba(202, 138, 4, 1)' },
            { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(220, 38, 38, 1)' },
            { bg: 'rgba(168, 85, 247, 0.2)', border: 'rgba(147, 51, 234, 1)' }
        ];

        graficoEspelhoDocenteInstancia = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Presença', 'Trab. Ind.', 'Trab. Grupo', '1º Teste', '2º Teste', 'Exame', 'Nota Prof.'],
                datasets: registosEstudante.map((reg, index) => {
                    const cor = paletaCores[index % paletaCores.length];
                    return {
                        label: `${reg.cadeira || 'Geral'} (${formatarNomeCurso(reg.curso)} · ${reg.ano || '2025-2026'})`,
                        data: [
                            parseNota(reg.presenca) || 0,
                            parseNota(reg.trabInd) || 0,
                            parseNota(reg.trabGrp) || 0,
                            parseNota(reg.teste1) || 0,
                            parseNota(reg.teste2) || 0,
                            parseNota(reg.exame) || 0,
                            parseNota(reg.notaProf) || 0
                        ],
                        backgroundColor: cor.bg,
                        borderColor: cor.border,
                        borderWidth: 2
                    };
                })
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { r: { beginAtZero: true, max: 20 } }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', garantirOpcaoConsultaIndividualNoMenu);

// Gancho não-invasivo para atualizar a U.C. ao abrir ou alterar Percentagens
document.addEventListener("DOMContentLoaded", () => {
    const acaoSelect = document.getElementById('docente-acao-select');
    const cursoSelect = document.getElementById('docente-curso-global');
    const anoSelect = document.getElementById('docente-ano-global');

    const sincronizarUCPerc = () => {
        if (acaoSelect && acaoSelect.value === "percentagens") {
            setTimeout(atualizarSelectUCPonderacaoPauta3, 0);
        }
    };

    if (acaoSelect) acaoSelect.addEventListener('change', sincronizarUCPerc);
    if (cursoSelect) cursoSelect.addEventListener('change', sincronizarUCPerc);
    if (anoSelect) anoSelect.addEventListener('change', sincronizarUCPerc);
});