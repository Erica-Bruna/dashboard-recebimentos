const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUhYAMLxTCQCda-UC3miYvm6FnslYgxozIcC0532lU_Jwt2Xp7OnOJkjdvh2r3gyaKj7l2zm965_g4/pub?gid=1540801849&single=true&output=csv';
let graficoPizza = null;
let todosDadosGlobais = [];

function parseValorBR(valorTexto) {
  if (!valorTexto) return 0;
  if (typeof valorTexto === 'number') return valorTexto;
  const limpo = valorTexto.toString().replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(limpo) || 0;
}

function parseDataBR(dataTexto) {
  if (!dataTexto) return null;
  const partes = dataTexto.trim().split('/');
  if (partes.length !== 3) return null;
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1;
  const ano = parseInt(partes[2], 10);
  return new Date(ano, mes, dia, 12, 0, 0);
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

window.addEventListener('DOMContentLoaded', () => {
  const inputInicio = document.getElementById('filtro-data-inicio');
  const inputFim = document.getElementById('filtro-data-fim');
  
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const formatarDataInput = (d) => {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  if (inputInicio && !inputInicio.value) inputInicio.value = formatarDataInput(primeiroDia);
  if (inputFim && !inputFim.value) inputFim.value = formatarDataInput(ultimoDia);

  carregarDashboard();
});

function carregarDashboard() {
  const inputInicio = document.getElementById('filtro-data-inicio');
  const inputFim = document.getElementById('filtro-data-fim');

  let dataInicio = new Date();
  let dataFim = new Date();

  if (inputInicio && inputInicio.value) {
    const [a, m, d] = inputInicio.value.split('-');
    dataInicio = new Date(parseInt(a, 10), parseInt(m, 10) - 1, parseInt(d, 10), 0, 0, 0);
  }

  if (inputFim && inputFim.value) {
    const [a, m, d] = inputFim.value.split('-');
    dataFim = new Date(parseInt(a, 10), parseInt(m, 10) - 1, parseInt(d, 10), 23, 59, 59);
  }

  const tituloTabela = document.getElementById('titulo-tabela-dia');
  if (tituloTabela) {
    tituloTabela.innerText = `Recebimentos de ${dataInicio.toLocaleDateString('pt-BR')} até ${dataFim.toLocaleDateString('pt-BR')}`;
  }

  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      const dados = results.data;
      if (!dados || dados.length === 0) return;

      todosDadosGlobais = dados;
      processarEExibirTabela(dados, dataInicio, dataFim, null);
    }
  });
}

function processarEExibirTabela(dados, dataInicio, dataFim, filtroCategoria) {
  let totalReceberPeriodo = 0;
  let totalRecebidoCaixa = 0;
  let totalAtrasadoPeriodo = 0;

  const tbodyDia = document.getElementById('tb-dia');
  if (tbodyDia) tbodyDia.innerHTML = '';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let linhasParaExibir = [];

  dados.forEach(item => {
    const chaves = Object.keys(item);
    const getColuna = (nome) => {
      const chave = chaves.find(k => k.trim().toLowerCase() === nome.toLowerCase());
      return chave ? item[chave] : '';
    };

    const cliente = getColuna('Cliente') || getColuna('Razão Social') || 'Cliente Não Identificado';
    const vencimentoTexto = getColuna('Vencimento');
    const ultimoRecebimentoTexto = getColuna('Último Recebimento');
    const status = getColuna('Status').toString().trim().toLowerCase();
    const notaFiscal = getColuna('Nota Fiscal') || getColuna('NF') || getColuna('Nº NF') || '-';

    const valorOriginal = parseValorBR(getColuna('Valor'));
    const valorRecebido = parseValorBR(getColuna('Valor Recebido'));
    
    const dataVencimento = parseDataBR(vencimentoTexto);
    const dataUltimoRecebimento = parseDataBR(ultimoRecebimentoTexto);

    if (!dataVencimento) return;

    const vencimentoNoPeriodo = dataVencimento >= dataInicio && dataVencimento <= dataFim;
    const dataPagamento = dataUltimoRecebimento || (status === 'recebido' ? dataVencimento : null);
    
    // Verifica se já foi efetivamente pago
    const jaFoiPago = (status === 'recebido' || (dataUltimoRecebimento !== null && !isNaN(dataUltimoRecebimento)));

    // 1. Cálculo dos totais para os KPIs (Cartões)
    if (vencimentoNoPeriodo && !jaFoiPago) {
      if (status === 'atrasado' || dataVencimento < hoje) {
        totalAtrasadoPeriodo += valorOriginal;
      } else {
        totalReceberPeriodo += valorOriginal;
      }
    }

    const pagoNoPeriodo = dataPagamento && (dataPagamento >= dataInicio && dataPagamento <= dataFim);
    if (pagoNoPeriodo) {
      const valorExibicaoLinha = valorRecebido > 0 ? valorRecebido : valorOriginal;
      totalRecebidoCaixa += valorExibicaoLinha;
    }

    // 2. Classificação individual para exibição na tabela
    let categoriaLinha = null;
    let valorLinhaExibicao = valorOriginal;

    if (pagoNoPeriodo) {
      categoriaLinha = 'Recebido';
      valorLinhaExibicao = valorRecebido > 0 ? valorRecebido : valorOriginal;
    } else if (vencimentoNoPeriodo && !jaFoiPago) {
      // IMPORTANTE: Só classifica como atrasado ou a receber se NÃO tiver sido pago
      if (status === 'atrasado' || dataVencimento < hoje) {
        categoriaLinha = 'Atrasados';
      } else {
        categoriaLinha = 'A Receber';
      }
    }

    // Se houver categoria válida e passar pelo filtro de clique no gráfico
    if (categoriaLinha) {
      let incluirNaTabela = true;
      if (filtroCategoria) {
        incluirNaTabela = (categoriaLinha === filtroCategoria);
      }

      if (incluirNaTabela) {
        let tagStatus = '';
        if (categoriaLinha === 'Recebido') {
          tagStatus = '<span style="color: #E85D17; font-weight: bold;">(Recebido)</span>';
        } else if (categoriaLinha === 'Atrasados') {
          tagStatus = '<span style="color: #e74c3c; font-weight: bold;">(Atrasado)</span>';
        } else {
          tagStatus = '<span style="color: #3498db; font-weight: bold;">(A Receber)</span>';
        }

        linhasParaExibir.push({
          html: `
            <tr>
              <td><strong>${cliente}</strong> ${tagStatus}</td>
              <td>${vencimentoTexto}</td>
              <td><span style="color: #A0A0A0;">${notaFiscal}</span></td>
              <td>${formatarMoeda(valorLinhaExibicao)}</td>
            </tr>`,
          valorSoma: valorLinhaExibicao
        });
      }
    }
  });

  // Insere as linhas na tabela HTML
  let somaFiltrada = 0;
  linhasParaExibir.forEach(l => {
    if (tbodyDia) tbodyDia.innerHTML += l.html;
    somaFiltrada += l.valorSoma;
  });

  if (tbodyDia) {
    if (linhasParaExibir.length > 0) {
      const textoRodape = filtroCategoria ? `Total (${filtroCategoria}):` : 'Total Recebido no Período:';
      const valorRodape = filtroCategoria === 'Recebido' || !filtroCategoria ? totalRecebidoCaixa : somaFiltrada;

      tbodyDia.innerHTML += `
        <tr style="background-color: #252525; font-weight: bold; border-top: 2px solid #E85D17;">
          <td colspan="3" style="text-align: right; font-size: 1.05em; color: #FFFFFF;">${textoRodape}</td>
          <td style="color: #E85D17; font-size: 1.1em;">${formatarMoeda(valorRodape)}</td>
        </tr>`;
    } else {
      tbodyDia.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: #A0A0A0;">Nenhum registro encontrado para esta seleção.</td>
        </tr>`;
    }
  }

  document.getElementById('kpi-total-receber').innerText = formatarMoeda(totalReceberPeriodo);
  document.getElementById('kpi-total-recebido').innerText = formatarMoeda(totalRecebidoCaixa);
  document.getElementById('kpi-total-atrasado').innerText = formatarMoeda(totalAtrasadoPeriodo);

  if (!filtroCategoria) {
    renderizarGraficoPizza(totalRecebidoCaixa, totalReceberPeriodo, totalAtrasadoPeriodo, dataInicio, dataFim);
  }
}

function renderizarGraficoPizza(recebido, receber, atrasados, dataInicio, dataFim) {
  const ctx = document.getElementById('graficoPizzaGeral').getContext('2d');

  if (graficoPizza) graficoPizza.destroy();

  graficoPizza = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Recebido', 'A Receber', 'Atrasados'],
      datasets: [{
        data: [recebido, receber, atrasados],
        backgroundColor: ['#E85D17', '#3498db', '#e74c3c'],
        borderColor: '#1A1A1A',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      onClick: (event, elements) => {
        if (elements.length > 0) {
          const indexClicado = elements[0].index;
          const labelClicado = graficoPizza.data.labels[indexClicado];
          
          const tituloTabela = document.getElementById('titulo-tabela-dia');
          if (tituloTabela) {
            tituloTabela.innerText = `Filtro: ${labelClicado} (${dataInicio.toLocaleDateString('pt-BR')} até ${dataFim.toLocaleDateString('pt-BR')})`;
          }

          processarEExibirTabela(todosDadosGlobais, dataInicio, dataFim, labelClicado);
        }
      },
      plugins: {
        legend: { 
          position: 'bottom',
          labels: { color: '#FFFFFF' }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const valor = context.raw || 0;
              return ` ${context.label}: ${formatarMoeda(valor)}`;
            }
          }
        }
      }
    }
  });
}
