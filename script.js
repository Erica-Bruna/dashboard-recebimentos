const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUhYAMLxTCQCda-UC3miYvm6FnslYgxozIcC0532lU_Jwt2Xp7OnOJkjdvh2r3gyaKj7l2zm965_g4/pub?gid=1540801849&single=true&output=csv';

// Função para converter dinheiro brasileiro (ex: "33.658,79" ou 33658.79) em número
function parseValorBR(valorTexto) {
  if (!valorTexto) return 0;
  if (typeof valorTexto === 'number') return valorTexto;
  
  // Remove pontos de milhar e troca vírgula decimal por ponto
  const limpo = valorTexto.toString().replace(/\./g, '').replace(',', '.').trim();
  return parseFloat(limpo) || 0;
}

// Função para converter "DD/MM/YYYY" em Objeto Date do JavaScript
function parseDataBR(dataTexto) {
  if (!dataTexto) return null;
  const partes = dataTexto.trim().split('/');
  if (partes.length !== 3) return null;
  
  const dia = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1; // Mês no JS começa em 0
  const ano = parseInt(partes[2], 10);
  
  return new Date(ano, mes, dia);
}

// Formatar número para moeda R$
function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function carregarDashboard() { const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataFormatada = hoje.toLocaleDateString('pt-BR');
  const elemData = document.getElementById('data-hoje');
  if (elemData) {
    elemData.innerText = `📅 Hoje: ${dataFormatada}`;
  } 
  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
      const dados = results.data;
      
      // Data de hoje sem horas (zerada) para comparação justa
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      let totalGeral = 0;
      let totalRecebido = 0;
      let totalAbertoAtrasado = 0;

      const tbodyDia = document.getElementById('tb-dia');
      const tbodyAtraso = document.getElementById('tb-atraso');

      tbodyDia.innerHTML = '';
      tbodyAtraso.innerHTML = '';

      dados.forEach(item => {
        const cliente = item['Cliente'] || '';
        const vencimentoTexto = item['Vencimento'] || '';
        const status = (item['Status'] || '').trim().toLowerCase();
        
        const valorOriginal = parseValorBR(item['Valor']);
        const valorRecebido = parseValorBR(item['Valor Recebido']);
        const dataVencimento = parseDataBR(vencimentoTexto);

        totalGeral += valorOriginal;

        if (status === 'recebido') {
          totalRecebido += (valorRecebido > 0 ? valorRecebido : valorOriginal);
        } else {
          // Para pendentes (A Receber / Atrasado)
          totalAbertoAtrasado += valorOriginal;

          if (dataVencimento) {
            dataVencimento.setHours(0, 0, 0, 0);

            // Recebimentos do dia (Vencimento é HOJE)
            if (dataVencimento.getTime() === hoje.getTime()) {
              tbodyDia.innerHTML += `
                <tr>
                  <td>${cliente}</td>
                  <td>${vencimentoTexto}</td>
                  <td>${formatarMoeda(valorOriginal)}</td>
                </tr>`;
            }

            // Parcelas em Atraso (Vencimento ANTERIOR a HOJE ou marcado como "atrasado")
            if (dataVencimento < hoje || status === 'atrasado') {
              tbodyAtraso.innerHTML += `
                <tr>
                  <td>${cliente}</td>
                  <td>${vencimentoTexto}</td>
                  <td class="text-red">${formatarMoeda(valorOriginal)}</td>
                </tr>`;
            }
          }
        }
      });

      // Atualiza os cards no topo
      document.getElementById('kpi-total-receber').innerText = formatarMoeda(totalGeral);
      document.getElementById('kpi-total-recebido').innerText = formatarMoeda(totalRecebido);
      document.getElementById('kpi-total-atrasado').innerText = formatarMoeda(totalAbertoAtrasado);
    }
  });
}

carregarDashboard();
