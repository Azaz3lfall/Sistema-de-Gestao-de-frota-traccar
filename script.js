// Espera o HTML carregar completamente antes de executar
document.addEventListener('DOMContentLoaded', async () => {
    console.log('--- INICIANDO SCRIPT.JS ---');
    
    // Pega a referência do elemento <select> no HTML
    const selectVeiculos = document.getElementById('teste-veiculos');
    
    try {
        console.log('Passo 1: Buscando dados de /api/veiculos...');
        const response = await fetch('/api/veiculos');
        console.log('Passo 2: Resposta do servidor recebida.', response);

        if (!response.ok) {
            throw new Error(`Erro de rede! Status: ${response.status}`);
        }

        const veiculos = await response.json();
        console.log('Passo 3: Dados JSON convertidos com sucesso. Veículos encontrados:', veiculos.length);

        selectVeiculos.innerHTML = ''; // Limpa o "Carregando..." do HTML
        if (veiculos.length === 0) {
            selectVeiculos.innerHTML = '<option>Nenhum veículo encontrado.</option>';
        }

        // Para cada veículo recebido, cria uma nova tag <option> e a insere no <select>
        veiculos.forEach(veiculo => {
            const option = document.createElement('option');
            option.value = veiculo.id;
            option.textContent = veiculo.name;
            selectVeiculos.appendChild(option);
        });

        console.log('Passo 4: Menu de veículos populado com sucesso!');
        alert('TESTE BEM-SUCEDIDO: Os veículos foram carregados!');

    } catch (error) {
        console.error('--- ERRO NO SCRIPT.JS ---:', error);
        alert(`FALHA NO TESTE! Verifique o console (F12) para ver o erro detalhado: ${error.message}`);
    }
});