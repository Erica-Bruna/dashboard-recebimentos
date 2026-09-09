const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUhYAMLxTCQCda-UC3miYvm6FnslYgxozIcC0532lU_Jwt2Xp7OnOJkjdvh2r3gyaKj7l2zm965_g4/pub?gid=1540801849&single=true&output=csv';
let graficoPizza = null;

// Define a data atual no input ao abrir a página pela primeira vez
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
  return new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function carregarDashboard() {
  const inputData = document.getElementById('filtro-data');
  let dataConsulta = new Date();

  if (inputData && inputData.value) {
    const [anoSel, mesSel, diaSel] = inputData.value.split('-');
    dataConsulta = new Date(parseInt(anoSel, 10), parseInt(mesSel, 10) - 1, parseInt(diaSel, 10));
  }
  dataConsulta.setHours(0, 0, 0, 0);

  // Atualiza título da tabela com a data selecionada
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
        dataVencimento.setHours(0, 0, 0, 0);

        const mesmoMesEAno = (dataVencimento.getMonth() === mesConsulta && dataVencimento.getFullYear() === anoConsulta);

        // 1. Métricas do MÊS DA DATA SELECIONADA
        if (mesmoMesEAno) {
          if (status === 'recebido') {
            totalRecebidoMes += (valorRecebido > 0 ? valorRecebido : valorOriginal);
          } else if (status === 'a receber' || status === 'atrasado') {
            totalReceberMes += valorOriginal;
          }
        }

        // 2. Títulos da DATA SELECIONADA (Vencimento na data ou Pago na data)
        const venceNaData = dataVencimento.getTime() === dataConsulta.getTime();
        const pagoNaData = dataUltimoRecebimento && dataUltimoRecebimento.setHours(0,0,0,0) === dataConsulta.getTime();

        if (venceNaData || pagoNaData) {
          if (tbodyDia) {
            const ehPago = status === 'recebido' || pagoNaData;
            const badgeStatus = ehPago 
              ? '<span style="color: #27ae60; font-weight: bold;">(Recebido)</span>' 
              : '<span style="color: #e67e22; font-weight: bold;">(A Receber)</span>';

            const valorExibicao = (ehPago && valorRecebido > 0) ? valorRecebido : valorOriginal;

            tbodyDia.innerHTML += `
              <tr>
                <td><strong>${cliente}</strong> ${badgeStatus}</td>
                <td>${vencimentoTexto}</td>
                <td>${formatarMoeda(valorExibicao)}</td>
              </tr>`;
          }
        }

        // 3. Status 'Atrasado' ou vencidos em aberto em relação à data selecionada
        if (status === 'atrasado' || (dataVencimento < dataConsulta && status !== 'recebido')) {
          totalAtrasadoGeral += valorOriginal;
        }
      });

      // Atualização dos Cards
      document.getElementById('kpi-total-receber').innerText = formatarMoeda(totalReceberMes);
      document.getElementById('kpi-total-recebido').innerText = formatarMoeda(totalRecebidoMes);
      document.getElementById('kpi-total-atrasado').innerText = formatarMoeda(totalAtrasadoGeral);

      // Renderização do Gráfico de Pizza
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
