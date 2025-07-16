document.addEventListener('DOMContentLoaded', () => {
    let mapaVeiculos = {}, listaDeViagens = [], listaDeCustosGeral = [];

    // Referências aos elementos do DOM
    const formViagem = document.getElementById('form-viagem');
    const formCustoExtra = document.getElementById('form-custo-extra');
    const formCustoViagem = document.getElementById('form-custo-viagem');
    const corpoTabelaViagens = document.getElementById('corpo-tabela-viagens');
    const corpoTabelaCustosGeral = document.getElementById('corpo-tabela-custos-geral');
    const selectsDeVeiculo = {
        viagem: document.getElementById('viagem-veiculo-select'),
        custo: document.getElementById('custo-veiculo-select'),
        filtro: document.getElementById('filtro-veiculo-custo')
    };
    const selectFiltroTipo = document.getElementById('filtro-tipo-custo');
    const modal = document.getElementById('modal-custos-viagem');

    // Funções Utilitárias
    const formatarMoeda = (valor) => valor ? parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A';
    const alertUser = (msg) => alert(msg);

    // Funções de Atualização de UI
    const atualizarRelatorioCustosGeral = () => {
        const filtroVeiculoId = selectsDeVeiculo.filtro.value;
        const filtroTipo = selectFiltroTipo.value;

        let custosFiltrados = listaDeCustosGeral;

        if (filtroVeiculoId) {
            custosFiltrados = custosFiltrados.filter(c => c.deviceid == filtroVeiculoId);
        }
        if (filtroTipo) {
            custosFiltrados = custosFiltrados.filter(c => c.tipo === filtroTipo);
        }

        document.getElementById('total-lancamentos').textContent = custosFiltrados.length;
        document.getElementById('valor-total').textContent = formatarMoeda(custosFiltrados.reduce((acc, c) => acc + parseFloat(c.valor || 0), 0));

        corpoTabelaCustosGeral.innerHTML = '';
        if (custosFiltrados.length === 0) { corpoTabelaCustosGeral.innerHTML = '<tr><td colspan="5">Nenhum custo encontrado para este filtro.</td></tr>'; return; }

        custosFiltrados.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${mapaVeiculos[c.deviceid] || `ID: ${c.deviceid}`}</td><td><span style="background-color: #eee; padding: 2px 6px; border-radius: 4px;">${c.tipo}</span></td><td>${c.descricao}</td><td>${formatarMoeda(c.valor)}</td><td>${new Date(c.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>`;
            corpoTabelaCustosGeral.appendChild(tr);
        });
    };

    const atualizarRelatorioViagens = () => {
        corpoTabelaViagens.innerHTML = '';
        if (listaDeViagens.length === 0) { corpoTabelaViagens.innerHTML = '<tr><td colspan="5">Nenhuma viagem registrada.</td></tr>'; return; }
        listaDeViagens.sort((a, b) => b.id - a.id);
        listaDeViagens.forEach(v => {
            let precoPorLitro = 'N/A';
            if (v.valor_abastecimento > 0 && v.litros_abastecidos > 0) {
                precoPorLitro = formatarMoeda(v.valor_abastecimento / v.litros_abastecidos);
            }
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><b>${mapaVeiculos[v.deviceid] || `ID: ${v.deviceid}`}</b><br><small>${new Date(v.data_viagem).toLocaleDateString('pt-BR',{timeZone:'UTC'})}</small></td><td>${v.distancia_percorrida} km</td><td>${formatarMoeda(v.valor_abastecimento)}</td><td>${precoPorLitro}</td><td><button class="action-btn" data-id="${v.id}">Gerenciar Custos</button></td>`;
            corpoTabelaViagens.appendChild(tr);
        });
    };

    const carregarDadosIniciais = async () => {
        try {
            const [veiculosRes, viagensRes, custosGeralRes] = await Promise.all([
                fetch('/api/veiculos'), fetch('/api/viagens'), fetch('/api/relatorio-custos-geral')
            ]);
            if (!veiculosRes.ok || !viagensRes.ok || !custosGeralRes.ok) throw new Error('Falha na comunicação com o servidor.');

            const veiculos = await veiculosRes.json();
            listaDeViagens = await viagensRes.json();
            listaDeCustosGeral = await custosGeralRes.json();

            mapaVeiculos = {};
            Object.values(selectsDeVeiculo).forEach(sel => sel.innerHTML = '');
            selectsDeVeiculo.filtro.innerHTML = '<option value="">-- Todos os Veículos --</option>';
            selectsDeVeiculo.viagem.innerHTML = '<option value="">-- Selecione --</option>';
            selectsDeVeiculo.custo.innerHTML = '<option value="">-- Selecione --</option>';

            veiculos.forEach(v => {
                const option = document.createElement('option');
                option.value = v.id;
                option.textContent = v.name;
                mapaVeiculos[v.id] = v.name;
                Object.values(selectsDeVeiculo).forEach(sel => sel.appendChild(option.cloneNode(true)));
            });

            atualizarRelatorioViagens();
            atualizarRelatorioCustosGeral();
        } catch (error) { alertUser(`ERRO AO CARREGAR A PÁGINA: ${error.message}`); }
    };

    // Event Listeners
    selectsDeVeiculo.filtro.addEventListener('change', atualizarRelatorioCustosGeral);
    selectFiltroTipo.addEventListener('change', atualizarRelatorioCustosGeral);

    modal.querySelector('.close-btn').onclick = () => { modal.style.display = "none"; };

    corpoTabelaViagens.addEventListener('click', async (e) => {
        if (e.target.classList.contains('action-btn')) {
            const viagemId = e.target.dataset.id;
            document.getElementById('modal-viagem-id').value = viagemId;
            const viagem = listaDeViagens.find(v => v.id == viagemId);
            document.getElementById('modal-titulo').textContent = `Custos da Viagem: ${viagem.nome_veiculo}`;

            const response = await fetch(`/api/viagens/${viagemId}/custos`);
            const custos = await response.json();
            const listaEl = document.getElementById('lista-custos-viagem');
            listaEl.innerHTML = '';
            if (custos.length > 0) {
                custos.forEach(c => { const li = document.createElement('li'); li.textContent = `${c.descricao}: ${formatarMoeda(c.valor)}`; listaEl.appendChild(li); });
            } else {
                listaEl.innerHTML = '<li>Nenhum custo registrado para esta viagem.</li>';
            }
            modal.style.display = 'block';
        }
    });

    formCustoViagem.addEventListener('submit', async (e) => {
         e.preventDefault();
         const custo = { descricao: e.target.querySelector('#modal-descricao').value, valor: e.target.querySelector('#modal-valor').value };
         const viagemId = e.target.querySelector('#modal-viagem-id').value;
         const response = await fetch(`/api/viagens/${viagemId}/custos`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(custo) });
         if(response.ok) {
             alertUser('Custo da viagem adicionado!');
             e.target.reset();
             await carregarDadosIniciais();
             modal.style.display = "none";
         } else { alertUser('Erro ao adicionar custo.'); }
    });

    formViagem.addEventListener('submit', async (e) => {
        e.preventDefault();
        const viagem = {
            deviceid: selectsDeVeiculo.viagem.value,
            nome_veiculo: mapaVeiculos[selectsDeVeiculo.viagem.value],
            hodometro_inicial: document.getElementById('hodometro-inicial').value,
            hodometro_final: document.getElementById('hodometro-final').value,
            litros_abastecidos: document.getElementById('litros-abastecidos').value,
            valor_abastecimento: document.getElementById('valor-abastecimento').value,
        };
        const response = await fetch('/api/viagens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(viagem) });
        if(response.ok) {
            alertUser('Viagem registrada!');
            formViagem.reset();
            await carregarDadosIniciais();
        } else { alertUser('Erro ao registrar viagem.'); }
    });

    formCustoExtra.addEventListener('submit', async (e) => {
        e.preventDefault();
        const custo = {
            deviceid: selectsDeVeiculo.custo.value,
            descricao: document.getElementById('custo-descricao').value,
            valor: document.getElementById('custo-valor').value
        };
        const response = await fetch('/api/custos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(custo) });
        if(response.ok) {
            alertUser('Custo extra salvo com sucesso!');
            formCustoExtra.reset();
            await carregarDadosIniciais();
        } else { alertUser('Erro ao salvar custo extra.'); }
    });

    carregarDadosIniciais();
});