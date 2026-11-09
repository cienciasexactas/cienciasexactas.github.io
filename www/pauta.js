// ================= SCRIPT COMPLETO E INTEGRADO (pauta.js) =================

let pautaEstado = {
    utilizadorAtual: null,
    estudantes: [],
    planilhasColunas: {
        "Presenças": [],
        "Trabalhos Individuais": [],
        "Trabalhos de Grupo": []
    },
    percentagens: {}
};

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

// CÁLCULO DA MÉDIA DE TRABALHOS (Individuais ou de Grupo) com chaves independentes
function calcularMediaTrabalhos(est, categoria) {
    const colunas = pautaEstado.planilhasColunas[categoria] || [];
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

// CÁLCULO DE PRESENÇAS BASEADO EM P e F -> (P / (P + F)) * 20
function calcularNotaPresenca(est) {
    const colunas = pautaEstado.planilhasColunas["Presenças"] || [];
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
                pautaEstado.planilhasColunas = dados.planilhasColunas || pautaEstado.planilhasColunas;
                pautaEstado.percentagens = dados.percentagens || {};
                return;
            }
        }
    } catch (erro) {
        console.warn("Aviso ao carregar da API:", erro);
    }

    // Fallback de segurança para garantir portabilidade entre computadores
    const localSalvo = localStorage.getItem('pautaEstadoGlobal');
    if (localSalvo) {
        try {
            const dadosLocais = JSON.parse(localSalvo);
            pautaEstado.estudantes = dadosLocais.estudantes || [];
            pautaEstado.planilhasColunas = dadosLocais.planilhasColunas || pautaEstado.planilhasColunas;
            pautaEstado.percentagens = dadosLocais.percentagens || {};
        } catch (e) {
            console.error("Erro ao ler dados locais:", e);
        }
    }
}

// O que foi adicionado:
async function salvarNaNuvem() {
    // Guarda localmente para persistência imediata
    try {
        localStorage.setItem('pautaEstadoGlobal', JSON.stringify({
            estudantes: pautaEstado.estudantes,
            planilhasColunas: pautaEstado.planilhasColunas,
            percentagens: pautaEstado.percentagens
        }));
    } catch (e) {
        console.error("Erro ao salvar localmente:", e);
    }

    // Envia para o servidor na nuvem
    try {
        await fetch('https://api-cienciasexactas.vercel.app/api/pauta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                estudantes: pautaEstado.estudantes,
                planilhasColunas: pautaEstado.planilhasColunas,
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

// ================= GESTÃO DE COLUNAS POR PLANILHA FIXA =================
function inicializarGestaoPlanilhas() {
    if (!pautaEstado.planilhasColunas) {
        pautaEstado.planilhasColunas = {
            "Presenças": [],
            "Trabalhos Individuais": [],
            "Trabalhos de Grupo": []
        };
    }
    carregarSelectPlanilhas();
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
    const nomePlanilha = document.getElementById('select-planilha-ativa').value;
    const selectColuna = document.getElementById('select-coluna-ativa');
    if (!selectColuna) return;

    selectColuna.innerHTML = '<option value="" selected disabled>-- Selecione uma coluna --</option>';

    if (nomePlanilha && pautaEstado.planilhasColunas[nomePlanilha]) {
        pautaEstado.planilhasColunas[nomePlanilha].forEach(coluna => {
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
    const nomePlanilha = document.getElementById('select-planilha-ativa').value;
    const nomeColuna = document.getElementById('gp-nome-coluna').value.trim();

    if (!nomePlanilha) {
        alert("Por favor, selecione primeiro uma categoria (ex: Presenças).");
        return;
    }
    if (!nomeColuna) {
        alert("Insira o nome da coluna (ex: Aula 1).");
        return;
    }

    if (!pautaEstado.planilhasColunas[nomePlanilha]) {
        pautaEstado.planilhasColunas[nomePlanilha] = [];
    }

    if (pautaEstado.planilhasColunas[nomePlanilha].includes(nomeColuna)) {
        alert("Esta coluna já existe nesta categoria.");
        return;
    }

    pautaEstado.planilhasColunas[nomePlanilha].push(nomeColuna);
    await salvarNaNuvem();
    alert(`Coluna "${nomeColuna}" adicionada a "${nomePlanilha}" com sucesso!`);
    document.getElementById('gp-nome-coluna').value = "";
    carregarColunasDaPlanilha();
    recarregarDadosDocente();
}

async function atualizarNomeColuna() {
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

    const index = pautaEstado.planilhasColunas[nomePlanilha].indexOf(colunaAntiga);
    if (index !== -1) {
        pautaEstado.planilhasColunas[nomePlanilha][index] = novoNomeColuna;
        await salvarNaNuvem();
        alert("Nome da coluna atualizado com sucesso!");
        document.getElementById('gp-nome-coluna').value = "";
        carregarColunasDaPlanilha();
        recarregarDadosDocente();
    }
}

async function eliminarColunaDaPlanilha() {
    const nomePlanilha = document.getElementById('select-planilha-ativa').value;
    const colunaSel = document.getElementById('select-coluna-ativa').value;

    if (!nomePlanilha || !colunaSel) {
        alert("Selecione a categoria e a coluna que deseja eliminar.");
        return;
    }

    if (confirm(`Tem a certeza que deseja eliminar a coluna "${colunaSel}"?`)) {
        pautaEstado.planilhasColunas[nomePlanilha] = pautaEstado.planilhasColunas[nomePlanilha].filter(c => c !== colunaSel);
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

    const colsPresenca = pautaEstado.planilhasColunas["Presenças"] || [];
    const colsTrabInd = pautaEstado.planilhasColunas["Trabalhos Individuais"] || [];
    const colsTrabGrp = pautaEstado.planilhasColunas["Trabalhos de Grupo"] || [];

    // --- 1. CABEÇALHO PRESENÇAS ---
    if (theadPresenca) {
        let htmlLinha1 = `<tr><th rowspan="2">ID</th><th rowspan="2">Nome</th><th colspan="${colsPresenca.length || 1}" style="text-align:center;">Presenças</th></tr>`;
        let htmlLinha2 = `<tr>`;
        if (colsPresenca.length > 0) {
            colsPresenca.forEach(c => htmlLinha2 += `<th>${c}</th>`);
        } else {
            htmlLinha2 += `<th>Presença Geral</th>`;
        }
        htmlLinha2 += `</tr>`;
        theadPresenca.innerHTML = htmlLinha1 + htmlLinha2;
    }

    // --- 2. CABEÇALHO TRABALHOS INDIVIDUAIS ---
    if (theadTrabInd) {
        let htmlLinha1 = `<tr><th rowspan="2">ID</th><th rowspan="2">Nome</th><th colspan="${colsTrabInd.length || 1}" style="text-align:center;">Trabalhos Individuais</th></tr>`;
        let htmlLinha2 = `<tr>`;
        if (colsTrabInd.length > 0) {
            colsTrabInd.forEach(c => htmlLinha2 += `<th>${c}</th>`);
        } else {
            htmlLinha2 += `<th>Trabalho Ind.</th>`;
        }
        htmlLinha2 += `</tr>`;
        theadTrabInd.innerHTML = htmlLinha1 + htmlLinha2;
    }

    // --- 3. CABEÇALHO TRABALHOS DE GRUPO ---
    if (theadTrabGrp) {
        let htmlLinha1 = `<tr><th rowspan="2">ID</th><th rowspan="2">Nome</th><th colspan="${colsTrabGrp.length || 1}" style="text-align:center;">Trabalhos de Grupo</th></tr>`;
        let htmlLinha2 = `<tr>`;
        if (colsTrabGrp.length > 0) {
            colsTrabGrp.forEach(c => htmlLinha2 += `<th>${c}</th>`);
        } else {
            htmlLinha2 += `<th>Trabalho Grupo</th>`;
        }
        htmlLinha2 += `</tr>`;
        theadTrabGrp.innerHTML = htmlLinha1 + htmlLinha2;
    }

    const filtrados = pautaEstado.estudantes.filter(e => e.curso === cursoSel && (e.ano === anoSel || !e.ano));

    if (tbodyResumo) tbodyResumo.innerHTML = "";
    if (tbodyPresenca) tbodyPresenca.innerHTML = "";
    if (tbodyTrabInd) tbodyTrabInd.innerHTML = "";
    if (tbodyTrabGrp) tbodyTrabGrp.innerHTML = "";
    if (selectApagar) selectApagar.innerHTML = "";

    filtrados.forEach(est => {
        est.trabInd = calcularMediaTrabalhos(est, "Trabalhos Individuais");
        est.trabGrp = calcularMediaTrabalhos(est, "Trabalhos de Grupo");

        const notaPresCalc = calcularNotaPresenca(est);
        if (notaPresCalc !== null) est.presenca = notaPresCalc;

        const avaliacao = calcularSituacaoEstudante(est);
        est.situacao = avaliacao.texto;

        // Tabela Resumo Geral
        if (tbodyResumo) {
            tbodyResumo.innerHTML += `<tr>
                <td>${est.id}</td><td>${est.nome}</td><td>${est.curso}</td><td>${est.cadeira || '-'}</td><td>${est.estatuto}</td><td>${est.ano || anoSel}</td>
                <td>${formatarNota(est.presenca)}</td><td>${formatarNota(est.trabInd)}</td><td>${formatarNota(est.trabGrp)}</td>
                <td>${formatarNota(est.teste1)}</td><td>${formatarNota(est.teste2)}</td><td>${formatarNota(est.exame)}</td><td>${formatarNota(est.notaProf)}</td><td><strong>${est.situacao}</strong></td>
            </tr>`;
        }

        // Tabela Presenças Individual
        let rowPresenca = `<td>${est.id}</td><td>${est.nome}</td>`;
        if (colsPresenca.length > 0) {
            colsPresenca.forEach(col => {
                const chaveKey = "pres_" + col;
                const val = (est.subNotas && est.subNotas[chaveKey] !== undefined) ? est.subNotas[chaveKey] : "---";
                rowPresenca += `<td>${formatarNota(val)}</td>`;
            });
        } else {
            rowPresenca += `<td>${formatarNota(est.presenca)}</td>`;
        }
        if (tbodyPresenca) tbodyPresenca.innerHTML += `<tr>${rowPresenca}</tr>`;

        // Tabela Trabalhos Individuais
        let rowTrabInd = `<td>${est.id}</td><td>${est.nome}</td>`;
        if (colsTrabInd.length > 0) {
            colsTrabInd.forEach(col => {
                const chaveKey = "indiv_" + col;
                const val = (est.subNotas && est.subNotas[chaveKey] !== undefined) ? est.subNotas[chaveKey] : "---";
                rowTrabInd += `<td>${formatarNota(val)}</td>`;
            });
        } else {
            rowTrabInd += `<td>---</td>`;
        }
        if (tbodyTrabInd) tbodyTrabInd.innerHTML += `<tr>${rowTrabInd}</tr>`;

        // Tabela Trabalhos de Grupo
        let rowTrabGrp = `<td>${est.id}</td><td>${est.nome}</td>`;
        if (colsTrabGrp.length > 0) {
            colsTrabGrp.forEach(col => {
                const chaveKey = "grp_" + col;
                const val = (est.subNotas && est.subNotas[chaveKey] !== undefined) ? est.subNotas[chaveKey] : "---";
                rowTrabGrp += `<td>${formatarNota(val)}</td>`;
            });
        } else {
            rowTrabGrp += `<td>---</td>`;
        }
        if (tbodyTrabGrp) tbodyTrabGrp.innerHTML += `<tr>${rowTrabGrp}</tr>`;

        if (selectApagar) {
            selectApagar.innerHTML += `<option value="${est.id}">${est.id} - ${est.nome}</option>`;
        }
    });

    renderizarGraficoTurma(filtrados);
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

    if (pautaEstado.estudantes.some(e => e.id === id)) {
        alert("Já existe um estudante com este ID.");
        return;
    }

    pautaEstado.estudantes.push({
        id, senha, nome, cadeira, estatuto, curso, ano,
        presenca: "", trabInd: "", trabGrp: "", teste1: "", teste2: "", exame: "", notaProf: "", subNotas: {}, situacao: "Pendente"
    });

    await salvarNaNuvem();
    alert("Estudante registado com sucesso!");

    document.getElementById('ce-id').value = "";
    document.getElementById('ce-senha').value = "";
    document.getElementById('ce-nome').value = "";
    document.getElementById('ce-cadeira').value = "";

    recarregarDadosDocente();
}

async function executarApagarEstudante() {
    const idApagar = document.getElementById('select-apagar-estudante').value;
    if (!idApagar) return;

    if (confirm("Tem certeza que deseja apagar este estudante?")) {
        pautaEstado.estudantes = pautaEstado.estudantes.filter(e => e.id !== idApagar);
        await salvarNaNuvem();
        alert("Estudante apagado.");
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
    filtrados.forEach(est => {
        selectEst.innerHTML += `<option value="${est.id}">${est.id} - ${est.nome}</option>`;
    });

    controlarCamposAtualizacao();
}

function controlarCamposAtualizacao() {
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
    // Procura o container principal da sub-secção
    const secaoAtualizar = document.getElementById('subseccao-actualizar');
    if (!secaoAtualizar) return null;

    // Evita duplicar o container caso já exista
    let div = document.getElementById('grupo-dados-gerais');
    if (div) div.remove();

    div = document.createElement('div');
    div.id = 'grupo-dados-gerais';
    // Usar a mesma classe de grelha que o resto do formulário
    div.className = 'pauta-grid-3col';
    div.style.marginTop = '20px';

    div.innerHTML = `
    <div class="pauta-form-row">
        <div class="pauta-form-group">
            <label>Nome:</label>
            <input type="text" id="act-dg-nome" class="pauta-input" placeholder="Nome Completo">
        </div>
        <div class="pauta-form-group">
            <label>Curso(s):</label>
            <input type="text" id="act-dg-curso" class="pauta-input" placeholder="Ex: Biologia - Química">
        </div>
        <div class="pauta-form-group">
            <label>Unidade Curricular:</label>
            <input type="text" id="act-dg-cadeira" class="pauta-input" placeholder="Cadeira">
        </div>
        <div class="pauta-form-group">
            <label>Estatuto:</label>
            <input type="text" id="act-dg-estatuto" class="pauta-input" placeholder="Estatuto">
        </div>
        <div class="pauta-form-group">
            <label>Ano Letivo:</label>
            <input type="text" id="act-dg-ano" class="pauta-input" placeholder="Ano Letivo">
        </div>
    </div>
    `;

    secaoAtualizar.appendChild(div);
    return div;
}

function preencherCamposDadosGerais() {
    const idEst = document.getElementById('act-estudante-id').value;
    const est = pautaEstado.estudantes.find(e => e.id === idEst);
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

    // Verifica se a nota selecionada requer sub-coluna (Presenças ou Trabalhos)
    const requerSubColuna = (tipoNota === "TrabalhosIndividuais" || tipoNota === "TrabalhoGrupo" || tipoNota === "Presenca");

    if (requerSubColuna && grupoSubColuna) {
        grupoSubColuna.style.display = "block";

        if (selectSub) {
            selectSub.innerHTML = "";
            let nomeCategoria = tipoNota === "Presenca" ? "Presenças" : (tipoNota === "TrabalhosIndividuais" ? "Trabalhos Individuais" : "Trabalhos de Grupo");
            let colunas = pautaEstado.planilhasColunas[nomeCategoria] || [];

            if (colunas.length === 0) {
                selectSub.innerHTML = `<option value="" disabled selected>-- Nenhuma coluna criada --</option>`;
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
    const idEst = document.getElementById('act-estudante-id').value;
    const tipoSecao = document.getElementById('act-secao-tipo').value;
    const inputVal = document.getElementById('act-novo-valor');
    const est = pautaEstado.estudantes.find(e => e.id === idEst);
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
    const est = pautaEstado.estudantes.find(e => e.id === idEst);
    if (!est) return;

    if (tipoSecao === "dados") {
        est.nome = document.getElementById('act-dg-nome').value.trim();
        est.curso = document.getElementById('act-dg-curso').value.trim();
        est.cadeira = document.getElementById('act-dg-cadeira').value.trim();
        est.estatuto = document.getElementById('act-dg-estatuto').value.trim();
        est.ano = document.getElementById('act-dg-ano').value.trim();
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

    estudante.trabInd = calcularMediaTrabalhos(estudante, "Trabalhos Individuais");
    estudante.trabGrp = calcularMediaTrabalhos(estudante, "Trabalhos de Grupo");
    const notaPresCalc = calcularNotaPresenca(estudante);
    if (notaPresCalc !== null) estudante.presenca = notaPresCalc;

    const avaliacao = calcularSituacaoEstudante(estudante);
    estudante.situacao = avaliacao.texto;

    document.getElementById('est-lbl-nome').textContent = estudante.nome;

    // Mapear cursos e anos letivos associados a este ID de estudante
    const registosEstudante = pautaEstado.estudantes.filter(e => e.id === estudante.id);
    const cursosFormatados = registosEstudante.map(e => `${e.curso || 'Geral'} (${e.ano || '2025/2026'})`).join(' - ');

    const elemCurso = document.getElementById('est-lbl-curso');
    if (elemCurso) {
        elemCurso.textContent = cursosFormatados;
        elemCurso.style.display = 'inline-block';
        elemCurso.style.maxWidth = '100%';
        elemCurso.style.wordBreak = 'break-word';
        elemCurso.style.overflowWrap = 'break-word';
    }

    document.getElementById('est-lbl-id').textContent = estudante.id;

    // 1. Tabela Resumo Global do Estudante (sem colunas de Nome e Curso)
    const theadEstResumo = document.getElementById('thead-estudante-resumo') || document.querySelector('#tabela-estudante-resumo').parentElement.querySelector('thead');
    if (theadEstResumo) {
        theadEstResumo.innerHTML = `<tr>
            <th>ID</th><th>U.C.</th><th>Estatuto</th><th>Ano Letivo</th>
            <th>Presença</th><th>Trab. Ind.</th><th>Trab. Grupo</th>
            <th>1º Teste</th><th>2º Teste</th><th>Exame</th><th>Nota Prof.</th><th>Situação</th>
        </tr>`;
    }

    document.getElementById('tabela-estudante-resumo').innerHTML = `<tr>
        <td>${estudante.id}</td><td>${estudante.cadeira || '-'}</td><td>${estudante.estatuto}</td><td>${estudante.ano || '2025-2026'}</td>
        <td>${formatarNota(estudante.presenca)}</td><td>${formatarNota(estudante.trabInd)}</td><td>${formatarNota(estudante.trabGrp)}</td>
        <td>${formatarNota(estudante.teste1)}</td><td>${formatarNota(estudante.teste2)}</td><td>${formatarNota(estudante.exame)}</td><td>${formatarNota(estudante.notaProf)}</td><td><strong>${estudante.situacao}</strong></td>
    </tr>`;

    const colsPresenca = pautaEstado.planilhasColunas["Presenças"] || [];
    const colsTrabInd = pautaEstado.planilhasColunas["Trabalhos Individuais"] || [];
    const colsTrabGrp = pautaEstado.planilhasColunas["Trabalhos de Grupo"] || [];

    // Tabela Presenças (Apenas ID e U.C. fixos)
    const theadEstPresenca = document.getElementById('thead-estudante-presenca');
    const tbodyEstPresenca = document.getElementById('tabela-estudante-presenca');
    if (theadEstPresenca) {
        let htmlL1 = `<tr><th rowspan="2">ID</th><th rowspan="2">U.C.</th><th colspan="${colsPresenca.length || 1}" style="text-align:center;">Presenças</th></tr>`;
        let htmlL2 = `<tr>`;
        if (colsPresenca.length > 0) {
            colsPresenca.forEach(c => htmlL2 += `<th>${c}</th>`);
        } else {
            htmlL2 += `<th>Presença Geral</th>`;
        }
        htmlL2 += `</tr>`;
        theadEstPresenca.innerHTML = htmlL1 + htmlL2;
    }
    if (tbodyEstPresenca) {
        let rowP = `<td>${estudante.id}</td><td>${estudante.cadeira || '-'}</td>`;
        if (colsPresenca.length > 0) {
            colsPresenca.forEach(col => {
                const chaveKey = "pres_" + col;
                const val = (estudante.subNotas && estudante.subNotas[chaveKey] !== undefined) ? estudante.subNotas[chaveKey] : "---";
                rowP += `<td>${formatarNota(val)}</td>`;
            });
        } else {
            rowP += `<td>${formatarNota(estudante.presenca)}</td>`;
        }
        tbodyEstPresenca.innerHTML = `<tr>${rowP}</tr>`;
    }

    // Tabela Trabalhos Individuais (Apenas ID e U.C. fixos)
    const theadEstTrabInd = document.getElementById('thead-estudante-trabind');
    const tbodyEstTrabInd = document.getElementById('tabela-estudante-trabind');
    if (theadEstTrabInd) {
        let htmlL1 = `<tr><th rowspan="2">ID</th><th rowspan="2">U.C.</th><th colspan="${colsTrabInd.length || 1}" style="text-align:center;">Trabalhos Individuais</th></tr>`;
        let htmlL2 = `<tr>`;
        if (colsTrabInd.length > 0) {
            colsTrabInd.forEach(c => htmlL2 += `<th>${c}</th>`);
        } else {
            htmlL2 += `<th>Trabalho Ind.</th>`;
        }
        htmlL2 += `</tr>`;
        theadEstTrabInd.innerHTML = htmlL1 + htmlL2;
    }
    if (tbodyEstTrabInd) {
        let rowTI = `<td>${estudante.id}</td><td>${estudante.cadeira || '-'}</td>`;
        if (colsTrabInd.length > 0) {
            colsTrabInd.forEach(col => {
                const chaveKey = "indiv_" + col;
                const val = (estudante.subNotas && estudante.subNotas[chaveKey] !== undefined) ? estudante.subNotas[chaveKey] : "---";
                rowTI += `<td>${formatarNota(val)}</td>`;
            });
        } else {
            rowTI += `<td>---</td>`;
        }
        tbodyEstTrabInd.innerHTML = `<tr>${rowTI}</tr>`;
    }

    // Tabela Trabalhos de Grupo (Apenas ID e U.C. fixos)
    const theadEstTrabGrp = document.getElementById('thead-estudante-trabgrp');
    const tbodyEstTrabGrp = document.getElementById('tabela-estudante-trabgrp');
    if (theadEstTrabGrp) {
        let htmlL1 = `<tr><th rowspan="2">ID</th><th rowspan="2">U.C.</th><th colspan="${colsTrabGrp.length || 1}" style="text-align:center;">Trabalhos de Grupo</th></tr>`;
        let htmlL2 = `<tr>`;
        if (colsTrabGrp.length > 0) {
            colsTrabGrp.forEach(c => htmlL2 += `<th>${c}</th>`);
        } else {
            htmlL2 += `<th>Trabalho Grupo</th>`;
        }
        htmlL2 += `</tr>`;
        theadEstTrabGrp.innerHTML = htmlL1 + htmlL2;
    }
    if (tbodyEstTrabGrp) {
        let rowTG = `<td>${estudante.id}</td><td>${estudante.cadeira || '-'}</td>`;
        if (colsTrabGrp.length > 0) {
            colsTrabGrp.forEach(col => {
                const chaveKey = "grp_" + col;
                const val = (estudante.subNotas && estudante.subNotas[chaveKey] !== undefined) ? estudante.subNotas[chaveKey] : "---";
                rowTG += `<td>${formatarNota(val)}</td>`;
            });
        } else {
            rowTG += `<td>---</td>`;
        }
        tbodyEstTrabGrp.innerHTML = `<tr>${rowTG}</tr>`;
    }

    renderizarGraficoEstudante(estudante);
}

// GRÁFICOS (Chart.js) - Leitura direta da propriedade numérica .valor de calcularSituacaoEstudante(e)
function renderizarGraficoTurma(estudantes) {
    const ctx = document.getElementById('chart-docente-turma').getContext('2d');
    if (graficoTurmaInstancia) graficoTurmaInstancia.destroy();

    const dadosNotas = estudantes.map(e => {
        const aval = calcularSituacaoEstudante(e);

        // 1. Tentar obter diretamente a propriedade numérica retornada
        if (aval && typeof aval.valor === 'number' && !isNaN(aval.valor)) {
            return aval.valor;
        }

        // 2. Tentar extrair valor numérico de dentro da string de texto, ex: "Aprovado(a) (11)"
        if (aval && aval.texto) {
            const match = aval.texto.match(/\((\d+(\.\d+)?)\)/);
            if (match) {
                const num = parseFloat(match[1]);
                if (!isNaN(num)) return num;
            }
        }

        // 3. Fallback para nota de exame ou 0
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

function renderizarGraficoEstudante(estudante) {
    const ctx = document.getElementById('chart-estudante-notas').getContext('2d');
    if (graficoEstudanteInstancia) graficoEstudanteInstancia.destroy();

    graficoEstudanteInstancia = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Presença', 'Trab. Ind.', 'Trab. Grupo', '1º Teste', '2º Teste', 'Exame', 'Nota Prof.'],
            datasets: [{
                label: estudante.nome,
                data: [
                    parseNota(estudante.presenca) || 0,
                    parseNota(estudante.trabInd) || 0,
                    parseNota(estudante.trabGrp) || 0,
                    parseNota(estudante.teste1) || 0,
                    parseNota(estudante.teste2) || 0,
                    parseNota(estudante.exame) || 0,
                    parseNota(estudante.notaProf) || 0
                ],
                backgroundColor: 'rgba(22, 163, 74, 0.2)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { beginAtZero: true, max: 20 } } }
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
            if (document.getElementById('act-secao-tipo').value === "dados") {
                preencherCamposDadosGerais();
            } else {
                atualizarValorInputNota();
            }
        });
    }
});
