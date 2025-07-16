import { useState, useEffect } from 'react';
import ViagemForm from './components/ViagemForm';  
import './App.css';


const TRACCAR_URL = 'http://tracker.rastreadorautoram.com.br/'; 

function App() {
  const [veiculos, setVeiculos] = useState([]);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        
        const credentials = btoa('evangelista1908@gmail.com:autoram1908');

        const response = await fetch(`${TRACCAR_URL}/api/devices`, {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
          }
        });

        // Verifica se a resposta da requisição foi bem-sucedida (status 2xx)
        if (!response.ok) {
          throw new Error(`Erro na API Traccar: ${response.statusText} (Status: ${response.status})`);
        }

        const data = await response.json();
        
        // A API do Traccar retorna um array de objetos. 
        // O nome do veículo geralmente está na propriedade 'name'.
        setVeiculos(data);

      } catch (error) {
        console.error("Erro ao buscar dados do Traccar:", error);
      }
    };

    fetchData();
  }, []); 

  return (
    <div className="App">
      <div className="container">
        <h1>Dashboard de Gestão de Frota (Versão React)</h1>
      </div>
      
      {

      }
      <ViagemForm vehicles={veiculos} />
      
    </div>
  );
}

export default App;