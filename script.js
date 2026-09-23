const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUhYAMLxTCQCda-UC3miYvm6FnslYgxozIcC0532lU_Jwt2Xp7OnOJkjdvh2r3gyaKj7l2zm965_g4/pub?gid=1540801849&single=true&output=csv';
let graficoPizza = null;

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

// Define o início e fim do mês atual por padrão ao carregar
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

  // Atualiza título da tabela com o período
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

      let totalReceberPeriodo = 0;
      let totalRecebidoPeriodo = 0;
      let totalAtrasadoPeriodo = 0;
      let totalTabelaPeriodo = 0;

      const tbodyDia = document.getElementById('tb-dia');
      if (tbodyDia) tbodyDia.innerHTML = '';

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
        
        const valorOriginal = parseValorBR(getColuna('Valor'));
        const valorRecebido = parseValorBR(getColuna('Valor Recebido'));
        
        const dataVencimento = parseDataBR(vencimentoTexto);
        const dataUltimoRecebimento = parseDataBR(ultimoRecebimentoTexto);

        if (!dataVencimento) return;

        // Verifica se o vencimento está dentro do período selecionado
        const vencimentoNoPeriodo = dataVencimento >= dataInicio && dataVencimento <= dataFim;

        // 1. Totais do Período Selecionado
        if (vencimentoNoPeriodo) {
          if (status === 'recebido') {
            totalRecebidoPeriodo += (valorRecebido > 0 ? valorRecebido : valorOriginal);
          } else if (status === 'a receber' || status === 'atrasado') {
            totalReceberPeriodo += valorOriginal;
          }

          if (status === 'atrasado' || (dataVencimento < dataFim && status !== 'recebido')) {
            totalAtrasadoPeriodo += valorOriginal;
          }
        }

        // 2. Tabela: Pagamentos EFETUADOS dentro do período pesquisado
        const dataPagamento = dataUltimoRecebimento || (status === 'recebido' ? dataVencimento : null);
        const pagoNoPeriodo = dataPagamento && (dataPagamento >= dataInicio && dataPagamento <= dataFim);

        if (pagoNoPeriodo) {
          const valorExibicao = valorRecebido > 0 ? valorRecebido : valorOriginal;
          totalTabelaPeriodo += valorExibicao;

          if (tbodyDia) {
            tbodyDia.innerHTML += `
              <tr>
                <td><strong>${cliente}</strong> <span style="color: #27ae60; font-weight: bold;">(Recebido)</span></td>
                <td>${vencimentoTexto}</td>
                <td>${formatarMoeda(valorExibicao)}</td>
              </tr>`;
          }
        }
      });

      // Linha de total na tabela
      if (tbodyDia) {
        if (totalTabelaPeriodo > 0) {
          tbodyDia.innerHTML += `
            <tr style="background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #2c3e50;">
              <td colspan="2" style="text-align: right; font-size: 1.05em;">Total Recebido no Período:</td>
              <td style="color: #27ae60; font-size: 1.1em;">${formatarMoeda(totalTabelaPeriodo)}</td>
            </tr>`;
        } else {
          tbodyDia.innerHTML = `
            <tr>
              <td colspan="3" style="text-align: center; color: #777;">Nenhum recebimento registrado neste período.</td>
            </tr>`;
        }
      }

      // Atualiza os Cards
      document.getElementById('kpi-total-receber').innerText = formatarMoeda(totalReceberPeriodo);
      document.getElementById('kpi-total-recebido').innerText = formatarMoeda(totalRecebidoPeriodo);
      document.getElementById('kpi-total-atrasado').innerText = formatarMoeda(totalAtrasadoPeriodo);

      renderizarGraficoPizza(totalRecebidoPeriodo, totalReceberPeriodo, totalAtrasadoPeriodo);
    }
  });
}

function renderizarGraficoPizza(recebido, receber, atrasados) {
  const ctx = document.getElementById('graficoPizzaGeral').getContext('2d');

  if (graficoPizza) graficoPizza.destroy();

  graficoPizza = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Recebido (Período)', 'A Receber (Período)', 'Atrasados (Período)'],
      datasets: [{
        data: [recebido, receber, atrasados],
        backgroundColor: ['#2ecc71', '#3498db', '#e74c3c']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
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
