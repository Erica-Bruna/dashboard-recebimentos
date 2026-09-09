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
  return new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function carregarDashboard() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const elemData = document.getElementById('data-hoje');
  if (elemData) elemData.innerText = `📅 Hoje: ${hoje.toLocaleDateString('pt-BR')}`;

  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      const dados = results.data;
      if (!dados || dados.length === 0) return;

      const mesAtual = hoje.getMonth();
      const anoAtual = hoje.getFullYear();

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

        const mesmoMesEAno = (dataVencimento.getMonth() === mesAtual && dataVencimento.getFullYear() === anoAtual);

        // 1. Métricas do MÊS ATUAL
        if (mesmoMesEAno) {
          if (status === 'recebido') {
            totalRecebidoMes += (valorRecebido > 0 ? valorRecebido : valorOriginal);
          } else if (status === 'a receber' || status === 'atrasado') {
            totalReceberMes += valorOriginal;
          }
        }

        // 2. Títulos do DIA (Vencimento HOJE ou Pago HOJE)
        const venceHoje = dataVencimento.getTime() === hoje.getTime();
        const pagoHoje = dataUltimoRecebimento && dataUltimoRecebimento.setHours(0,0,0,0) === hoje.getTime();

        if (venceHoje || pagoHoje) {
          if (tbodyDia) {
            const ehPago = status === 'recebido' || pagoHoje;
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

        // 3. Status 'Atrasado' ou vencidos em aberto (Histórico Geral)
        if (status === 'atrasado' || (dataVencimento < hoje && status !== 'recebido')) {
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

carregarDashboard();
