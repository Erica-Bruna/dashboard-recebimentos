const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUhYAMLxTCQCda-UC3miYvm6FnslYgxozIcC0532lU_Jwt2Xp7OnOJkjdvh2r3gyaKj7l2zm965_g4/pub?gid=1540801849&single=true&output=csv';
let graficoPizza = null;

// Função auxiliar para comparar duas datas ignorando fuso horário
function mesmaData(d1, d2) {
  if (!d1 || !d2) return false;
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

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
  return new Date(ano, mes, dia, 12, 0, 0); // Evita desvio de fuso horário
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

window.addEventListener('DOMContentLoaded', () => {
  const inputData = document.getElementById('filtro-data');
  if (inputData && !inputData.value) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    inputData.value = `${ano}-${mes}-${dia}`;
  }
  carregarDashboard();
});

function carregarDashboard() {
  const inputData = document.getElementById('filtro-data');
  let dataConsulta = new Date();

  if (inputData && inputData.value) {
    const [anoSel, mesSel, diaSel] = inputData.value.split('-');
    dataConsulta = new Date(parseInt(anoSel, 10), parseInt(mesSel, 10) - 1, parseInt(diaSel, 10), 12, 0, 0);
  }

  const tituloTabela = document.getElementById('titulo-tabela-dia');
  if (tituloTabela) {
    tituloTabela.innerText = `Recebimentos em ${dataConsulta.toLocaleDateString('pt-BR')}`;
  }

  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      const dados = results.data;
      if (!dados || dados.length === 0) return;

      const mesConsulta = dataConsulta.getMonth();
      const anoConsulta = dataConsulta.getFullYear();

      let totalReceberMes = 0;
      let totalRecebidoMes = 0;
      let totalAtrasadoGeral = 0;
      let totalDiaPesquisado = 0;

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

        const mesmoMesEAno = (dataVencimento.getMonth() === mesConsulta && dataVencimento.getFullYear() === anoConsulta);

        // 1. Totais do Mês Selecionado
        if (mesmoMesEAno) {
          if (status === 'recebido') {
            totalRecebidoMes += (valorRecebido > 0 ? valorRecebido : valorOriginal);
          } else if (status === 'a receber' || status === 'atrasado') {
            totalReceberMes += valorOriginal;
          }
        }

        // 2. Tabela: Pagamentos EFETUADOS na data pesquisada
        const pagoNaData = mesmaData(dataUltimoRecebimento, dataConsulta) || 
                           (status === 'recebido' && mesmaData(dataVencimento, dataConsulta) && !dataUltimoRecebimento);

        if (pagoNaData) {
          const valorExibicao = valorRecebido > 0 ? valorRecebido : valorOriginal;
          totalDiaPesquisado += valorExibicao;

          if (tbodyDia) {
            tbodyDia.innerHTML += `
              <tr>
                <td><strong>${cliente}</strong> <span style="color: #27ae60; font-weight: bold;">(Recebido)</span></td>
                <td>${vencimentoTexto}</td>
                <td>${formatarMoeda(valorExibicao)}</td>
              </tr>`;
          }
        }

        // 3. Totais em Atraso Geral
        if (status === 'atrasado' || (dataVencimento < dataConsulta && status !== 'recebido')) {
          totalAtrasadoGeral += valorOriginal;
        }
      });

      // Adiciona a linha de total na última linha da tabela
      if (tbodyDia) {
        if (totalDiaPesquisado > 0) {
          tbodyDia.innerHTML += `
            <tr style="background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #2c3e50;">
              <td colspan="2" style="text-align: right; font-size: 1.05em;">Total Recebido no Dia:</td>
              <td style="color: #27ae60; font-size: 1.1em;">${formatarMoeda(totalDiaPesquisado)}</td>
            </tr>`;
        } else {
          tbodyDia.innerHTML = `
            <tr>
              <td colspan="3" style="text-align: center; color: #777;">Nenhum recebimento registrado nesta data.</td>
            </tr>`;
        }
      }

      // Atualiza os Cards da tela
      document.getElementById('kpi-total-receber').innerText = formatarMoeda(totalReceberMes);
      document.getElementById('kpi-total-recebido').innerText = formatarMoeda(totalRecebidoMes);
      document.getElementById('kpi-total-atrasado').innerText = formatarMoeda(totalAtrasadoGeral);

      renderizarGraficoPizza(totalRecebidoMes, totalReceberMes, totalAtrasadoGeral);
    }
  });
}

function renderizarGraficoPizza(recebidoMes, receberMes, atrasadosGeral) {
  const ctx = document.getElementById('graficoPizzaGeral').getContext('2d');

  if (graficoPizza) graficoPizza.destroy();

  graficoPizza = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Recebido (Mês)', 'A Receber (Mês)', 'Atrasados (Geral)'],
      datasets: [{
        data: [recebidoMes, receberMes, atrasadosGeral],
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
