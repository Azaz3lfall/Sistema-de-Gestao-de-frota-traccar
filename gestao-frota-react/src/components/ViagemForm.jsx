import { useState } from 'react';
import VehicleSelect from './VehicleSelect';


function ViagemForm({ vehicles }) {
  
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [hodometroInicial, setHodometroInicial] = useState('');
  const [hodometroFinal, setHodometroFinal] = useState('');
  const [litros, setLitros] = useState('');
  const [valor, setValor] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault(); 
    const viagemData = {
      deviceid: selectedVehicle,
      hodometro_inicial: hodometroInicial,
      hodometro_final: hodometroFinal,
      litros_abastecidos: litros,
      valor_abastecimento: valor,
    };
    console.log('Dados da Viagem a serem enviados:', viagemData);
    alert('Viagem registrada no console! (O próximo passo é enviar para a API)');
    
  };

  return (
    <div className="container">
      <h2>Registrar Nova Viagem</h2>
      <form onSubmit={handleSubmit}>
        {}
        <VehicleSelect
          label="Veículo:"
          vehicles={vehicles}
          value={selectedVehicle}
          onChange={(e) => setSelectedVehicle(e.target.value)}
        />

        <div>
          <label>Hodômetro Inicial (km):</label>
          <input
            type="number"
            value={hodometroInicial}
            onChange={(e) => setHodometroInicial(e.target.value)}
            required
          />
        </div>

        <div>
          <label>Hodômetro Final (km):</label>
          <input
            type="number"
            value={hodometroFinal}
            onChange={(e) => setHodometroFinal(e.target.value)}
            required
          />
        </div>

        {}

        <button type="submit">Registrar Viagem</button>
      </form>
    </div>
  );
}

export default ViagemForm;