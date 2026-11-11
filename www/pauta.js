// ================= SCRIPT COMPLETO E INTEGRADO (pauta.js) =================

let pautaEstado = {
    utilizadorAtual: null,
    estudantes: [],
    planilhasColunasPorCadeira: {},
    percentagens: {}
};

// Obter colunas da planilha isoladas por Curso e Cadeira (U.C.)
function obterColunasCadeira(curso, cadeira, categoria) {
    const cursoKey = curso || "Geral";
    const cadeiraKey = cadeira || "Geral";
    const cid = `${cursoKey}___${cadeiraKey}`;
    
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
    const chave = `${curso}_${ano}_${cadeira || 'geral'}`;
    if (pautaEstado.percentagens && pautaEstado.percentagens[chave]) {
        return pautaEstado.percentagens[chave];
    }
    return { presenca: 0, testes: 0, trabInd: 0, trabGrp: 0 };
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

// CÁLCULO DA MÉDIA DE TRABALHOS (Individuais ou de Grupo) por U.C. e Curso
function calcularMediaTrabalhos(est, categoria) {
    const curso = est.curso || "Geral";
    const cadeira = est.cadeira || "Geral";
    const colunas = obterColunasCadeira(curso, cadeira, categoria);
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

// CÁLCULO DE PRESENÇAS BASEADO EM P e F por U.C. e Curso
function calcularNotaPresenca(est) {
    const curso = est.curso || "Geral";
    const cadeira = est.cadeira || "Geral";
    const colunas = obterColunasCadeira(curso, cadeira, "Presenças");
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
function calcularSituacaoEstudante(est) {
    const mediaTrabInd = calcularMediaTrabalhos(est, "Trabalhos Individuais");
    const mediaTrabGrp = calcularMediaTrabalhos(est, "Trabalhos de Grupo");
    const notaPresencaCalc = calcularNotaPresenca(est);

    const camposNotas = ['teste1', 'teste2', 'exame', 'notaProf'];
    const temAlgumaNota = camposNotas.some(campo => parseNota(est[campo]) !== null) || mediaTrabInd !== null || mediaTrabGrp !== null || notaPresencaCalc !== null;

    if (!temAlgumaNota) {
        return { texto: "Pendente", valor: "-" };
    }

    const curso = est.curso;
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

// Carregar dados da nuvem ao iniciar
async function inicializarSistemaPauta() {
    try {
        const resposta = await fetch('https://api-cienciasexactas.vercel.app/api/pauta');
        if (resposta.ok) {
            const dados = await resposta.json();
            if (dados && dados.estudantes && dados.estudantes.length > 0) {
                pautaEstado.estudantes = dados.estudantes;
                pautaEstado.planilhasColunasPorCadeira = dados.planilhasColunasPorCadeira || dados.planilhasColunas || {};
                pautaEstado.percentagens = dados.percentagens || {};
                configurarEventosAutopreenchimento();
                return;
            }
        }
    } catch (erro) {
        console.warn("Aviso ao carregar da API:", erro);
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
}

// Sincronização com a nuvem
async function salvarNaNuvem() {
    try {
        localStorage.setItem('pautaEstadoGlobal', JSON.stringify({
            estudantes: pautaEstado.estudantes,
            planilhasColunasPorCadeira: pautaEstado.planilhasColunasPorCadeira,
            percentagens: pautaEstado.percentagens
        }));
    } catch (e) {
        console.error("Erro ao salvar localmente:", e);
    }

    try {
        await fetch('https://api-cienciasexactas.vercel.app/api/pauta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estudantes: pautaEstado.estudantes,
                planilhasColunasPorCadeira: pautaEstado.planilhasColunasPorCadeira,
                percentagens: pautaEstado.percentagens
            })
        });
    } catch (erro) {
        console.error("Erro ao sincronizar com a nuvem:", erro);
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

    if ((idInput.toLowerCase() === "docente" || idInput.toLowerCase() === "prof") && senhaInput === "123") {
        pautaEstado.utilizadorAtual = { id: idInput, tipo: "docente", nome: "Professor Titular", curso: "biologia" };
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
    mudarSecaoDocenteDinamica();
    recarregarDadosDocente();
}

// VALIDAÇÃO E GESTÃO DINÂMICA DAS SUBSEÇÕES DO DOCENTE
function mudarSecaoDocenteDinamica() {
    const acao = document.getElementById('docente-acao-select').value;
    const cursoSel = document.getElementById('docente-curso-global').value;
    const anoSel = document.getElementById('docente-ano-global').value;

    if (acao && (!cursoSel || !anoSel || cursoSel === "" || anoSel === "")) {
        alert("⚠️ Por favor, selecione primeiro o 'Curso' e o 'Ano Lectivo' no painel superior antes de prosseguir.");
        document.getElementById('docente-acao-select').value = "";
        return;
    }

    document.getElementById('subseccao-criar-estudante').classList.add('pauta-hidden');
    document.getElementById('subseccao-actualizar').classList.add('pauta-hidden');
    document.getElementById('subseccao-planilha').classList.add('pauta-hidden');
    document.getElementById('subseccao-percentagens').classList.add('pauta-hidden');
    document.getElementById('subseccao-visualizar').classList.add('pauta-hidden');

    if (acao === "visualizar") {
        document.getElementById('subseccao-visualizar').classList.remove('pauta-hidden');
        recarregarDadosDocente();
    } else if (acao === "criar-estudante") {
        document.getElementById('subseccao-criar-estudante').classList.remove('pauta-hidden');
    } else if (acao === "actualizar") {
        document.getElementById('subseccao-actualizar').classList.remove('pauta-hidden');
        carregarSelectEstudantesAtualizar();
    } else if (acao === "planilha") {
        document.getElementById('subseccao-planilha').classList.remove('pauta-hidden');
        inicializarGestaoPlanilhas();
    } else if (acao === "percentagens") {
        document.getElementById('subseccao-percentagens').classList.remove('pauta-hidden');
        carregarCamposPercentagensAtuais();
    }
}

// ================= GESTÃO DE COLUNAS POR U.C. (Cadeira) E CURSO =================
function inicializarGestaoPlanilhas() {
    atualizarSelectCadeirasGestaoPlanilhas();
    carregarSelectPlanilhas();
}

function atualizarSelectCadeirasGestaoPlanilhas() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const estudantesCurso = pautaEstado.estudantes.filter(e => e.curso === cursoSel);
    const cadeirasUnicas = [...new Set(estudantesCurso.map(e => e.cadeira || "Geral").filter(Boolean))];

    let selectCadeira = document.getElementById('select-cadeira-planilha-ativa');
    if (!selectCadeira) {
        const secaoPlanilha = document.getElementById('subseccao-planilha');
        if (!secaoPlanilha) return;
        const container = document.createElement('div');
        container.className = 'pauta-form-group';
        container.style.marginBottom = '15px';
        container.innerHTML = `
            <label>Selecione a Unidade Curricular (Cadeira):</label>
            <select id="select-cadeira-planilha-ativa" class="pauta-input" onchange="carregarColunasDaPlanilha()"></select>
        `;
        secaoPlanilha.insertBefore(container, secaoPlanilha.firstChild);
        selectCadeira = document.getElementById('select-cadeira-planilha-ativa');
    }

    selectCadeira.innerHTML = "";
    if (cadeirasUnicas.length === 0) {
        selectCadeira.innerHTML = `<option value="Geral">Geral (Nenhuma cadeira registada)</option>`;
    } else {
        cadeirasUnicas.forEach(c => {
            selectCadeira.innerHTML += `<option value="${c}">${c}</option>`;
        });
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
    const selectCadeiraElem = document.getElementById('select-cadeira-planilha-ativa');
    const cadeiraSel = selectCadeiraElem ? selectCadeiraElem.value : "Geral";
    const nomePlanilha = document.getElementById('select-planilha-ativa').value;
    const selectColuna = document.getElementById('select-coluna-ativa');
    if (!selectColuna) return;

    selectColuna.innerHTML = '<option value="" selected disabled>-- Selecione uma coluna --</option>';

    if (nomePlanilha) {
        const colunas = obterColunasCadeira(cursoSel, cadeiraSel, nomePlanilha);
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
    const selectCadeiraElem = document.getElementById('select-cadeira-planilha-ativa');
    const cadeiraSel = selectCadeiraElem ? selectCadeiraElem.value : "Geral";
    const nomePlanilha = document.getElementById('select-planilha-ativa').value;
    const nomeColuna = document.getElementById('gp-nome-coluna').value.trim();

    if (!cursoSel) {
        alert("Por favor, selecione um curso globalmente primeiro.");
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

    const cid = `${cursoSel}___${cadeiraSel}`;
    if (!pautaEstado.planilhasColunasPorCadeira[cid]) {
        pautaEstado.planilhasColunasPorCadeira[cid] = {
            "Presenças": [],
            "Trabalhos Individuais": [],
            "Trabalhos de Grupo": []
        };
    }

    if (pautaEstado.planilhasColunasPorCadeira[cid][nomePlanilha].includes(nomeColuna)) {
        alert("Esta coluna já existe nesta categoria para este curso e Unidade Curricular.");
        return;
    }

    pautaEstado.planilhasColunasPorCadeira[cid][nomePlanilha].push(nomeColuna);
    await salvarNaNuvem();
    alert(`Coluna "${nomeColuna}" adicionada a "${nomePlanilha}" (${cadeiraSel} - ${cursoSel}) com sucesso!`);
    document.getElementById('gp-nome-coluna').value = "";
    carregarColunasDaPlanilha();
    recarregarDadosDocente();
}

async function atualizarNomeColuna() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const selectCadeiraElem = document.getElementById('select-cadeira-planilha-ativa');
    const cadeiraSel = selectCadeiraElem ? selectCadeiraElem.value : "Geral";
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

    const cid = `${cursoSel}___${cadeiraSel}`;
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
    const selectCadeiraElem = document.getElementById('select-cadeira-planilha-ativa');
    const cadeiraSel = selectCadeiraElem ? selectCadeiraElem.value : "Geral";
    const nomePlanilha = document.getElementById('select-planilha-ativa').value;
    const colunaSel = document.getElementById('select-coluna-ativa').value;

    if (!nomePlanilha || !colunaSel) {
        alert("Selecione a categoria e a coluna que deseja eliminar.");
        return;
    }

    if (confirm(`Tem a certeza que deseja eliminar a coluna "${colunaSel}"?`)) {
        const cid = `${cursoSel}___${cadeiraSel}`;
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

    const estExemplo = pautaEstado.estudantes.find(e => e.curso === cursoSel);
    const cadeiraSel = estExemplo ? (estExemplo.cadeira || "geral") : "geral";
    const chave = `${cursoSel}_${anoSel}_${cadeiraSel}`;

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

    const estExemplo = pautaEstado.estudantes.find(e => e.curso === cursoSel);
    const cadeiraSel = estExemplo ? (estExemplo.cadeira || "geral") : "geral";
    const chave = `${cursoSel}_${anoSel}_${cadeiraSel}`;

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

// RECARREGAR DADOS DOCENTE E TABELAS INDIVIDUAIS
function recarregarDadosDocente() {
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

    const filtrados = pautaEstado.estudantes.filter(e => e.curso === cursoSel && (e.ano === anoSel || !e.ano));

    let todasColsPresenca = [];
    let todasColsTrabInd = [];
    let todasColsTrabGrp = [];

    filtrados.forEach(e => {
        obterColunasCadeira(e.curso, e.cadeira, "Presenças").forEach(c => { if (!todasColsPresenca.includes(c)) todasColsPresenca.push(c); });
        obterColunasCadeira(e.curso, e.cadeira, "Trabalhos Individuais").forEach(c => { if (!todasColsTrabInd.includes(c)) todasColsTrabInd.push(c); });
        obterColunasCadeira(e.curso, e.cadeira, "Trabalhos de Grupo").forEach(c => { if (!todasColsTrabGrp.includes(c)) todasColsTrabGrp.push(c); });
    });

    if (theadPresenca) {
        let htmlL1 = `<tr><th rowspan="2">ID</th><th rowspan="2">Nome</th><th rowspan="2">U.C.</th><th colspan="${todasColsPresenca.length || 1}" style="text-align:center;">Presenças</th></tr>`;
        let htmlL2 = `<tr>`;
        if (todasColsPresenca.length > 0) {
            todasColsPresenca.forEach(c => htmlL2 += `<th>${c}</th>`);
        } else {
            htmlL2 += `<th>Geral</th>`;
        }
        htmlL2 += `</tr>`;
        theadPresenca.innerHTML = htmlL1 + htmlL2;
    }

    if (theadTrabInd) {
        let htmlL1 = `<tr><th rowspan="2">ID</th><th rowspan="2">Nome</th><th rowspan="2">U.C.</th><th colspan="${todasColsTrabInd.length || 1}" style="text-align:center;">Trabalhos Individuais</th></tr>`;
        let htmlL2 = `<tr>`;
        if (todasColsTrabInd.length > 0) {
            todasColsTrabInd.forEach(c => htmlL2 += `<th>${c}</th>`);
        } else {
            htmlL2 += `<th>Geral</th>`;
        }
        htmlL2 += `</tr>`;
        theadTrabInd.innerHTML = htmlL1 + htmlL2;
    }

    if (theadTrabGrp) {
        let htmlL1 = `<tr><th rowspan="2">ID</th><th rowspan="2">Nome</th><th rowspan="2">U.C.</th><th colspan="${todasColsTrabGrp.length || 1}" style="text-align:center;">Trabalhos de Grupo</th></tr>`;
        let htmlL2 = `<tr>`;
        if (todasColsTrabGrp.length > 0) {
            todasColsTrabGrp.forEach(c => htmlL2 += `<th>${c}</th>`);
        } else {
            htmlL2 += `<th>Geral</th>`;
        }
        htmlL2 += `</tr>`;
        theadTrabGrp.innerHTML = htmlL1 + htmlL2;
    }

    if (tbodyResumo) tbodyResumo.innerHTML = "";
    if (tbodyPresenca) tbodyPresenca.innerHTML = "";
    if (tbodyTrabInd) tbodyTrabInd.innerHTML = "";
    if (tbodyTrabGrp) tbodyTrabGrp.innerHTML = "";
    if (selectApagar) selectApagar.innerHTML = "";

    filtrados.forEach((est) => {
        est.trabInd = calcularMediaTrabalhos(est, "Trabalhos Individuais");
        est.trabGrp = calcularMediaTrabalhos(est, "Trabalhos de Grupo");

        const notaPresCalc = calcularNotaPresenca(est);
        if (notaPresCalc !== null) est.presenca = notaPresCalc;

        const avaliacao = calcularSituacaoEstudante(est);
        est.situacao = avaliacao.texto;

        if (tbodyResumo) {
            tbodyResumo.innerHTML += `<tr>
                <td>${est.id}</td><td>${est.nome}</td><td>${est.curso}</td><td>${est.cadeira || '-'}</td><td>${est.estatuto}</td><td>${est.ano || anoSel}</td>
                <td>${formatarNota(est.presenca)}</td><td>${formatarNota(est.trabInd)}</td><td>${formatarNota(est.trabGrp)}</td>
                <td>${formatarNota(est.teste1)}</td><td>${formatarNota(est.teste2)}</td><td>${formatarNota(est.exame)}</td><td>${formatarNota(est.notaProf)}</td><td><strong>${est.situacao}</strong></td>
            </tr>`;
        }

        const colsCadeiraPres = obterColunasCadeira(est.curso, est.cadeira, "Presenças");
        const colsCadeiraTI = obterColunasCadeira(est.curso, est.cadeira, "Trabalhos Individuais");
        const colsCadeiraTG = obterColunasCadeira(est.curso, est.cadeira, "Trabalhos de Grupo");

        // 1. Presenças
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

            tbodyPresenca.innerHTML += linhaDatasP + rowPresenca;
        }

        // 2. Trabalhos Individuais
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

            tbodyTrabInd.innerHTML += linhaDatasTI + rowTrabInd;
        }

        // 3. Trabalhos de Grupo
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

            tbodyTrabGrp.innerHTML += linhaDatasTG + rowTrabGrp;
        }

        if (selectApagar) {
            selectApagar.innerHTML += `<option value="${est.id}">${est.id} - ${est.nome} (${est.cadeira || 'Geral'})</option>`;
        }
    });

    renderizarGraficoTurma(filtrados);
}

// CONFIGURAR AUTO-PREENCHIMENTO INTELIGENTE E BLOQUEIO DE ID/NOME
function configurarEventosAutopreenchimento() {
    const inputId = document.getElementById('ce-id');
    const inputNome = document.getElementById('ce-nome');
    const inputSenha = document.getElementById('ce-senha');

    if (!inputId || !inputNome || !inputSenha) return;

    inputId.addEventListener('input', () => {
        const idVal = inputId.value.trim();
        const existente = pautaEstado.estudantes.find(e => e.id === idVal);
        if (existente) {
            inputNome.value = existente.nome;
            inputSenha.value = existente.senha;
            inputNome.readOnly = true;
            inputSenha.readOnly = true;
        } else {
            inputNome.readOnly = false;
            inputSenha.readOnly = false;
        }
    });

    inputNome.addEventListener('input', () => {
        const nomeVal = inputNome.value.trim().toLowerCase();
        const existente = pautaEstado.estudantes.find(e => e.nome.toLowerCase() === nomeVal);
        if (existente) {
            inputId.value = existente.id;
            inputSenha.value = existente.senha;
            inputId.readOnly = true;
            inputSenha.readOnly = true;
        } else {
            inputId.readOnly = false;
            inputSenha.readOnly = false;
        }
    });
}

// REGISTAR ESTUDANTE
async function registarNovoEstudante() {
    const curso = document.getElementById('docente-curso-global').value;
    const ano = document.getElementById('docente-ano-global').value;

    if (!curso || !ano || curso === "" || ano === "") {
        alert("⚠️ Por favor, selecione primeiro o 'Curso' e o 'Ano Lectivo' no painel superior.");
        return;
    }

    const id = document.getElementById('ce-id').value.trim();
    const senha = document.getElementById('ce-senha').value.trim();
    const nome = document.getElementById('ce-nome').value.trim();
    const cadeira = document.getElementById('ce-cadeira').value.trim();
    const estatuto = document.getElementById('ce-estatuto').value;

    if (!id || !senha || !nome) {
        alert("Preencha os campos obrigatórios: ID, Senha e Nome.");
        return;
    }

    const conflitoId = pautaEstado.estudantes.find(e => e.id === id && e.nome.toLowerCase() !== nome.toLowerCase());
    const conflitoNome = pautaEstado.estudantes.find(e => e.nome.toLowerCase() === nome.toLowerCase() && e.id !== id);

    if (conflitoId) {
        alert(`⚠️ O ID "${id}" já pertence a outro estudante (${conflitoId.nome}).`);
        return;
    }
    if (conflitoNome) {
        alert(`⚠️ O Nome "${nome}" já está associado ao ID (${conflitoNome.id}).`);
        return;
    }

    const duplicadoExato = pautaEstado.estudantes.some(e =>
        e.id === id && e.curso === curso && (e.cadeira || '') === (cadeira || '') && (e.ano || '') === (ano || '')
    );

    if (duplicadoExato) {
        alert("⚠️ Este estudante já se encontra registado nesta mesma Unidade Curricular, Curso e Ano Letivo.");
        return;
    }

    const existenteGlobal = pautaEstado.estudantes.find(e => e.id === id);
    const nomeOficial = existenteGlobal ? existenteGlobal.nome : nome;
    const senhaOficial = existenteGlobal ? existenteGlobal.senha : senha;

    pautaEstado.estudantes.push({
        id, senha: senhaOficial, nome: nomeOficial, cadeira, estatuto, curso, ano,
        presenca: "", trabInd: "", trabGrp: "", teste1: "", teste2: "", exame: "", notaProf: "", subNotas: {}, situacao: "Pendente"
    });

    await salvarNaNuvem();
    alert("✅ Estudante registado com sucesso!");

    document.getElementById('ce-id').value = "";
    document.getElementById('ce-senha').value = "";
    document.getElementById('ce-nome').value = "";
    document.getElementById('ce-cadeira').value = "";

    document.getElementById('ce-nome').readOnly = false;
    document.getElementById('ce-senha').readOnly = false;
    document.getElementById('ce-id').readOnly = false;

    recarregarDadosDocente();
}

async function executarApagarEstudante() {
    const idApagar = document.getElementById('select-apagar-estudante').value;
    if (!idApagar) return;

    if (confirm("Tem certeza que deseja apagar este registo de estudante?")) {
        pautaEstado.estudantes = pautaEstado.estudantes.filter(e => e.id !== idApagar);
        await salvarNaNuvem();
        alert("Registo apagado.");
        recarregarDadosDocente();
    }
}

// ================= GESTÃO DA SECÇÃO DE ATUALIZAÇÃO =================
function carregarSelectEstudantesAtualizar() {
    const cursoSel = document.getElementById('docente-curso-global').value;
    const filtrados = pautaEstado.estudantes.filter(e => e.curso === cursoSel);
    const selectEst = document.getElementById('act-estudante-id');

    if (!selectEst) return;
    selectEst.innerHTML = "";

    const idsUnicos = [...new Set(filtrados.map(e => e.id))];
    idsUnicos.forEach(id => {
        const estRef = filtrados.find(e => e.id === id);
        selectEst.innerHTML += `<option value="${id}">${id} - ${estRef.nome}</option>`;
    });

    atualizarSelectCadeirasAtualizacao();
    controlarCamposAtualizacao();
}

function atualizarSelectCadeirasAtualizacao() {
    const idEst = document.getElementById('act-estudante-id').value;
    const cursoSel = document.getElementById('docente-curso-global').value;
    const registosEst = pautaEstado.estudantes.filter(e => e.id === idEst && e.curso === cursoSel);

    let containerCadeira = document.getElementById('grupo-select-cadeira-act');
    if (!containerCadeira) {
        const secaoAtualizar = document.getElementById('subseccao-actualizar');
        if (!secaoAtualizar) return;
        containerCadeira = document.createElement('div');
        containerCadeira.id = 'grupo-select-cadeira-act';
        containerCadeira.className = 'pauta-form-group';
        containerCadeira.style.marginTop = '15px';
        containerCadeira.innerHTML = `
            <label>Cadeira (U. C.) a Atualizar:</label>
            <select id="act-cadeira-alvo" class="pauta-input" onchange="preencherCamposDadosGerais(); atualizarValorInputNota();"></select>
        `;
        const primeiroGrupo = secaoAtualizar.querySelector('.pauta-form-group');
        if (primeiroGrupo) {
            primeiroGrupo.parentNode.insertBefore(containerCadeira, primeiroGrupo.nextSibling);
        } else {
            secaoAtualizar.appendChild(containerCadeira);
        }
    }

    const selectCadeiraAlvo = document.getElementById('act-cadeira-alvo');
    if (selectCadeiraAlvo) {
        selectCadeiraAlvo.innerHTML = "";
        registosEst.forEach(reg => {
            const nomeCid = reg.cadeira || 'Geral';
            selectCadeiraAlvo.innerHTML += `<option value="${nomeCid}">${nomeCid} (${reg.ano || 'Geral'})</option>`;
        });
    }
}

function obterRegistoAtualSelecionado() {
    const idEst = document.getElementById('act-estudante-id').value;
    const cursoSel = document.getElementById('docente-curso-global').value;
    const selectCadeiraAlvo = document.getElementById('act-cadeira-alvo');
    const cadeiraSel = selectCadeiraAlvo ? selectCadeiraAlvo.value : "";

    const registos = pautaEstado.estudantes.filter(e => e.id === idEst && e.curso === cursoSel);
    if (registos.length === 0) return null;

    let reg = registos.find(e => (e.cadeira || 'Geral') === cadeiraSel);
    return reg || registos[0];
}

function controlarCamposAtualizacao() {
    atualizarSelectCadeirasAtualizacao();
    const tipoSecao = document.getElementById('act-secao-tipo').value;
    const grupoSubNota = document.getElementById('grupo-sub-nota');
    const grupoSubColuna = document.getElementById('grupo-sub-coluna');
    const containerDadosGerais = document.getElementById('grupo-dados-gerais') || criarContainerDadosGerais();
    const wrapperValorInput = document.getElementById('act-novo-valor').closest('.pauta-form-group, div') || document.getElementById('act-novo-valor').parentNode;

    if (tipoSecao === "dados") {
        if (grupoSubNota) grupoSubNota.style.display = "none";
        if (grupoSubColuna) grupoSubColuna.style.display = "none";
        if (wrapperValorInput) wrapperValorInput.style.display = "none";
        containerDadosGerais.style.display = "block";
        preencherCamposDadosGerais();
    } else if (tipoSecao === "notas") {
        containerDadosGerais.style.display = "none";
        if (wrapperValorInput) wrapperValorInput.style.display = "block";
        if (grupoSubNota) grupoSubNota.style.display = "block";
        atualizarOpcoesNotaAtualizacao();
    }
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
    `;

    secaoAtualizar.appendChild(div);
    return div;
}

function preencherCamposDadosGerais() {
    const est = obterRegistoAtualSelecionado();
    if (!est) return;

    if (document.getElementById('act-dg-nome')) {
        document.getElementById('act-dg-nome').value = est.nome || "";
        document.getElementById('act-dg-curso').value = est.curso || "";
        document.getElementById('act-dg-cadeira').value = est.cadeira || "";
        document.getElementById('act-dg-estatuto').value = est.estatuto || "";
        document.getElementById('act-dg-ano').value = est.ano || "";
    }
}

function atualizarOpcoesNotaAtualizacao() {
    const tipoNota = document.getElementById('act-nota-tipo').value;
    const grupoSubColuna = document.getElementById('grupo-sub-coluna');
    const selectSub = document.getElementById('act-subcoluna-select');
    const est = obterRegistoAtualSelecionado();

    const requerSubColuna = (tipoNota === "TrabalhosIndividuais" || tipoNota === "TrabalhoGrupo" || tipoNota === "Presenca");

    if (requerSubColuna && grupoSubColuna) {
        grupoSubColuna.style.display = "block";

        if (selectSub) {
            selectSub.innerHTML = "";
            let nomeCategoria = tipoNota === "Presenca" ? "Presenças" : (tipoNota === "TrabalhosIndividuais" ? "Trabalhos Individuais" : "Trabalhos de Grupo");
            let colunas = obterColunasCadeira(est ? est.curso : "Geral", est ? est.cadeira : "Geral", nomeCategoria);

            if (colunas.length === 0) {
                selectSub.innerHTML = `<option value="" disabled selected>-- Nenhuma coluna criada para esta U.C. neste curso --</option>`;
            } else {
                colunas.forEach(col => {
                    selectSub.innerHTML += `<option value="${col}">${col}</option>`;
                });
            }
        }
    } else {
        if (grupoSubColuna) grupoSubColuna.style.display = "none";
    }

    atualizarValorInputNota();
}

function atualizarValorInputNota() {
    const tipoSecao = document.getElementById('act-secao-tipo').value;
    const inputVal = document.getElementById('act-novo-valor');
    const est = obterRegistoAtualSelecionado();
    if (!est) return;

    if (tipoSecao === "dados") {
        preencherCamposDadosGerais();
    } else {
        const tipoNota = document.getElementById('act-nota-tipo').value;
        const selectSub = document.getElementById('act-subcoluna-select');
        const subCol = selectSub ? selectSub.value : "";

        if (!est.subNotas) est.subNotas = {};

        if (tipoNota === "Presenca" && subCol) {
            inputVal.value = est.subNotas["pres_" + subCol] !== undefined ? est.subNotas["pres_" + subCol] : "";
        } else if (tipoNota === "TrabalhosIndividuais" && subCol) {
            inputVal.value = est.subNotas["indiv_" + subCol] !== undefined ? est.subNotas["indiv_" + subCol] : "";
        } else if (tipoNota === "TrabalhoGrupo" && subCol) {
            inputVal.value = est.subNotas["grp_" + subCol] !== undefined ? est.subNotas["grp_" + subCol] : "";
        } else {
            const chaveNota = tipoNota === "Teste1" ? "teste1" :
                tipoNota === "Teste2" ? "teste2" :
                    tipoNota === "Exame" ? "exame" : "notaProf";
            inputVal.value = (est[chaveNota] !== undefined && est[chaveNota] !== null) ? est[chaveNota] : "";
        }
    }
}

async function executarAtualizacaoEstudante() {
    const idEst = document.getElementById('act-estudante-id').value;
    const tipoSecao = document.getElementById('act-secao-tipo').value;
    const est = obterRegistoAtualSelecionado();
    if (!est) return;

    if (tipoSecao === "dados") {
        const novoNome = document.getElementById('act-dg-nome').value.trim();
        const novoCurso = document.getElementById('act-dg-curso').value;
        const novaCadeira = document.getElementById('act-dg-cadeira').value.trim();
        const novoEstatuto = document.getElementById('act-dg-estatuto').value;
        const novoAno = document.getElementById('act-dg-ano').value;

        if (!novoNome) {
            alert("O nome não pode estar vazio.");
            return;
        }

        pautaEstado.estudantes.forEach(e => {
            if (e.id === idEst) {
                e.nome = novoNome;
            }
        });

        est.curso = novoCurso;
        est.cadeira = novaCadeira;
        est.estatuto = novoEstatuto;
        est.ano = novoAno;
    } else {
        const novoValor = document.getElementById('act-novo-valor').value.trim();
        const tipoNota = document.getElementById('act-nota-tipo').value;
        const selectSub = document.getElementById('act-subcoluna-select');
        const subCol = selectSub ? selectSub.value : "";

        if (!est.subNotas) est.subNotas = {};

        if (tipoNota === "Presenca") {
            if (!subCol) { alert("Selecione a subcoluna de presença."); return; }
            est.subNotas["pres_" + subCol] = novoValor.toUpperCase();
        } else if (tipoNota === "TrabalhosIndividuais") {
            if (!subCol) { alert("Selecione a subcoluna de trabalho individual."); return; }
            est.subNotas["indiv_" + subCol] = novoValor;
        } else if (tipoNota === "TrabalhoGrupo") {
            if (!subCol) { alert("Selecione a subcoluna de trabalho de grupo."); return; }
            est.subNotas["grp_" + subCol] = novoValor;
        } else {
            if (tipoNota === "Teste1") est.teste1 = novoValor;
            if (tipoNota === "Teste2") est.teste2 = novoValor;
            if (tipoNota === "Exame") est.exame = novoValor;
            if (tipoNota === "NotaProfessor") est.notaProf = novoValor;
        }
    }

    await salvarNaNuvem();
    alert("Atualizado com sucesso!");
    recarregarDadosDocente();
}

// ================= PAINEL ESTUDANTE =================
function entrarPainelEstudante(estudante) {
    document.getElementById('pauta-login-section').classList.add('pauta-hidden');
    document.getElementById('vista-docente').classList.add('pauta-hidden');
    document.getElementById('vista-estudante').classList.remove('pauta-hidden');

    const registosEstudante = pautaEstado.estudantes.filter(e => e.id === estudante.id);
    const primeiroRegisto = registosEstudante[0] || estudante;

    document.getElementById('est-lbl-nome').textContent = primeiroRegisto.nome;

    const cursosFormatados = registosEstudante.map(e => `${e.curso || 'Geral'} - ${e.cadeira || 'Geral'} (${e.ano || '2025/2026'})`).join(' | ');

    const elemCurso = document.getElementById('est-lbl-curso');
    if (elemCurso) {
        elemCurso.textContent = cursosFormatados;
        elemCurso.style.display = 'inline-block';
        elemCurso.style.maxWidth = '100%';
        elemCurso.style.wordBreak = 'break-word';
        elemCurso.style.overflowWrap = 'break-word';
    }

    document.getElementById('est-lbl-id').textContent = primeiroRegisto.id;

    const theadEstResumo = document.getElementById('thead-estudante-resumo') || document.querySelector('#tabela-estudante-resumo').parentElement.querySelector('thead');
    if (theadEstResumo) {
        theadEstResumo.innerHTML = `<tr>
            <th>ID</th><th>Curso</th><th>U.C.</th><th>Estatuto</th><th>Ano Letivo</th>
            <th>Presença</th><th>Trab. Ind.</th><th>Trab. Grupo</th>
            <th>1º Teste</th><th>2º Teste</th><th>Exame</th><th>Nota Prof.</th><th>Situação</th>
        </tr>`;
    }

    const tbodyEstResumo = document.getElementById('tabela-estudante-resumo');
    const tbodyEstPresenca = document.getElementById('tabela-estudante-presenca');
    const tbodyEstTrabInd = document.getElementById('tabela-estudante-trabind');
    const tbodyEstTrabGrp = document.getElementById('tabela-estudante-trabgrp');

    if (tbodyEstResumo) tbodyEstResumo.innerHTML = "";
    if (tbodyEstPresenca) tbodyEstPresenca.innerHTML = "";
    if (tbodyEstTrabInd) tbodyEstTrabInd.innerHTML = "";
    if (tbodyEstTrabGrp) tbodyEstTrabGrp.innerHTML = "";

    let todasColsPresenca = [];
    let todasColsTrabInd = [];
    let todasColsTrabGrp = [];

    registosEstudante.forEach(reg => {
        obterColunasCadeira(reg.curso, reg.cadeira, "Presenças").forEach(c => { if (!todasColsPresenca.includes(c)) todasColsPresenca.push(c); });
        obterColunasCadeira(reg.curso, reg.cadeira, "Trabalhos Individuais").forEach(c => { if (!todasColsTrabInd.includes(c)) todasColsTrabInd.push(c); });
        obterColunasCadeira(reg.curso, reg.cadeira, "Trabalhos de Grupo").forEach(c => { if (!todasColsTrabGrp.includes(c)) todasColsTrabGrp.push(c); });
    });

    const theadEstPresenca = document.getElementById('thead-estudante-presenca');
    if (theadEstPresenca) {
        let htmlL1 = `<tr><th rowspan="2">ID</th><th rowspan="2">U.C.</th><th colspan="${todasColsPresenca.length || 1}" style="text-align:center;">Presenças</th></tr>`;
        let htmlL2 = `<tr>`;
        if (todasColsPresenca.length > 0) {
            todasColsPresenca.forEach(c => htmlL2 += `<th>${c}</th>`);
        } else {
            htmlL2 += `<th>Geral</th>`;
        }
        htmlL2 += `</tr>`;
        theadEstPresenca.innerHTML = htmlL1 + htmlL2;
    }

    const theadEstTrabInd = document.getElementById('thead-estudante-trabind');
    if (theadEstTrabInd) {
        let htmlL1 = `<tr><th rowspan="2">ID</th><th rowspan="2">U.C.</th><th colspan="${todasColsTrabInd.length || 1}" style="text-align:center;">Trabalhos Individuais</th></tr>`;
        let htmlL2 = `<tr>`;
        if (todasColsTrabInd.length > 0) {
            todasColsTrabInd.forEach(c => htmlL2 += `<th>${c}</th>`);
        } else {
            htmlL2 += `<th>Geral</th>`;
        }
        htmlL2 += `</tr>`;
        theadEstTrabInd.innerHTML = htmlL1 + htmlL2;
    }

    const theadEstTrabGrp = document.getElementById('thead-estudante-trabgrp');
    if (theadEstTrabGrp) {
        let htmlL1 = `<tr><th rowspan="2">ID</th><th rowspan="2">U.C.</th><th colspan="${todasColsTrabGrp.length || 1}" style="text-align:center;">Trabalhos de Grupo</th></tr>`;
        let htmlL2 = `<tr>`;
        if (todasColsTrabGrp.length > 0) {
            todasColsTrabGrp.forEach(c => htmlL2 += `<th>${c}</th>`);
        } else {
            htmlL2 += `<th>Geral</th>`;
        }
        htmlL2 += `</tr>`;
        theadEstTrabGrp.innerHTML = htmlL1 + htmlL2;
    }

    registosEstudante.forEach(reg => {
        reg.trabInd = calcularMediaTrabalhos(reg, "Trabalhos Individuais");
        reg.trabGrp = calcularMediaTrabalhos(reg, "Trabalhos de Grupo");
        const notaPresCalc = calcularNotaPresenca(reg);
        if (notaPresCalc !== null) reg.presenca = notaPresCalc;

        const avaliacao = calcularSituacaoEstudante(reg);
        reg.situacao = avaliacao.texto;

        if (tbodyEstResumo) {
            tbodyEstResumo.innerHTML += `<tr>
                <td>${reg.id}</td><td>${reg.curso || '-'}</td><td>${reg.cadeira || '-'}</td><td>${reg.estatuto}</td><td>${reg.ano || '2025-2026'}</td>
                <td>${formatarNota(reg.presenca)}</td><td>${formatarNota(reg.trabInd)}</td><td>${formatarNota(reg.trabGrp)}</td>
                <td>${formatarNota(reg.teste1)}</td><td>${formatarNota(reg.teste2)}</td><td>${formatarNota(reg.exame)}</td><td>${formatarNota(reg.notaProf)}</td><td><strong>${reg.situacao}</strong></td>
            </tr>`;
        }

        const colsCadeiraPres = obterColunasCadeira(reg.curso, reg.cadeira, "Presenças");
        const colsCadeiraTI = obterColunasCadeira(reg.curso, reg.cadeira, "Trabalhos Individuais");
        const colsCadeiraTG = obterColunasCadeira(reg.curso, reg.cadeira, "Trabalhos de Grupo");

        if (tbodyEstPresenca) {
            let linhaDatasP = `<tr style="background-color: #f8fafc; font-weight: bold; color: #1e293b;">
                <td colspan="2" style="border-right: none;"></td>`;
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

            let rowP = `<tr><td>${reg.id}</td><td>${reg.cadeira || 'Geral'}</td>`;
            if (todasColsPresenca.length > 0) {
                todasColsPresenca.forEach(colGlobal => {
                    if (colsCadeiraPres.includes(colGlobal)) {
                        const chaveKey = "pres_" + colGlobal;
                        const val = (reg.subNotas && reg.subNotas[chaveKey] !== undefined) ? reg.subNotas[chaveKey] : "---";
                        rowP += `<td style="text-align: center;">${formatarNota(val)}</td>`;
                    } else {
                        rowP += `<td style="text-align: center; color: #cbd5e1;">-</td>`;
                    }
                });
            } else {
                rowP += `<td style="text-align: center;">${formatarNota(reg.presenca)}</td>`;
            }
            rowP += `</tr>`;

            tbodyEstPresenca.innerHTML += linhaDatasP + rowP;
        }

        if (tbodyEstTrabInd) {
            let linhaDatasTI = `<tr style="background-color: #f8fafc; font-weight: bold; color: #1e293b;">
                <td colspan="2" style="border-right: none;"></td>`;
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

            let rowTI = `<tr><td>${reg.id}</td><td>${reg.cadeira || 'Geral'}</td>`;
            if (todasColsTrabInd.length > 0) {
                todasColsTrabInd.forEach(colGlobal => {
                    if (colsCadeiraTI.includes(colGlobal)) {
                        const chaveKey = "indiv_" + colGlobal;
                        const val = (reg.subNotas && reg.subNotas[chaveKey] !== undefined) ? reg.subNotas[chaveKey] : "---";
                        rowTI += `<td style="text-align: center;">${formatarNota(val)}</td>`;
                    } else {
                        rowTI += `<td style="text-align: center; color: #cbd5e1;">-</td>`;
                    }
                });
            } else {
                rowTI += `<td style="text-align: center;">---</td>`;
            }
            rowTI += `</tr>`;

            tbodyEstTrabInd.innerHTML += linhaDatasTI + rowTI;
        }

        if (tbodyEstTrabGrp) {
            let linhaDatasTG = `<tr style="background-color: #f8fafc; font-weight: bold; color: #1e293b;">
                <td colspan="2" style="border-right: none;"></td>`;
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

            let rowTG = `<tr><td>${reg.id}</td><td>${reg.cadeira || 'Geral'}</td>`;
            if (todasColsTrabGrp.length > 0) {
                todasColsTrabGrp.forEach(colGlobal => {
                    if (colsCadeiraTG.includes(colGlobal)) {
                        const chaveKey = "grp_" + colGlobal;
                        const val = (reg.subNotas && reg.subNotas[chaveKey] !== undefined) ? reg.subNotas[chaveKey] : "---";
                        rowTG += `<td style="text-align: center;">${formatarNota(val)}</td>`;
                    } else {
                        rowTG += `<td style="text-align: center; color: #cbd5e1;">-</td>`;
                    }
                });
            } else {
                rowTG += `<td style="text-align: center;">---</td>`;
            }
            rowTG += `</tr>`;

            tbodyEstTrabGrp.innerHTML += linhaDatasTG + rowTG;
        }
    });

    renderizarGraficoEstudante(registosEstudante);
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
        const nomeCurso = reg.curso || '';

        return {
            label: `${nomeCadeira} (${nomeCurso})`,
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
    const selectCurso = document.getElementById('docente-curso-global');
    const selectAno = document.getElementById('docente-ano-global');
    const selectNotaTipo = document.getElementById('act-nota-tipo');
    const selectSecaoTipo = document.getElementById('act-secao-tipo');
    const selectEstudanteId = document.getElementById('act-estudante-id');

    if (selectCurso) {
        selectCurso.addEventListener('change', () => {
            if (document.getElementById('docente-acao-select').value === "percentagens") {
                carregarCamposPercentagensAtuais();
            }
            if (document.getElementById('docente-acao-select').value === "planilha") {
                atualizarSelectCadeirasGestaoPlanilhas();
            }
            recarregarDadosDocente();
        });
    }

    if (selectAno) {
        selectAno.addEventListener('change', () => {
            if (document.getElementById('docente-acao-select').value === "percentagens") {
                carregarCamposPercentagensAtuais();
            }
            recarregarDadosDocente();
        });
    }

    if (selectNotaTipo) {
        selectNotaTipo.addEventListener('change', atualizarOpcoesNotaAtualizacao);
    }

    if (selectSecaoTipo) {
        selectSecaoTipo.addEventListener('change', controlarCamposAtualizacao);
    }

    if (selectEstudanteId) {
        selectEstudanteId.addEventListener('change', () => {
            atualizarSelectCadeirasAtualizacao();
            if (document.getElementById('act-secao-tipo').value === "dados") {
                preencherCamposDadosGerais();
            } else {
                atualizarValorInputNota();
            }
        });
    }
});