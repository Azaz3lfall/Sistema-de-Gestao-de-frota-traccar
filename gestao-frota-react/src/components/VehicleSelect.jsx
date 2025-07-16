function VehicleSelect({ label, vehicles, value, onChange }) {
    return (
      <div>
        <label>{label}</label>
        <select value={value} onChange={onChange} required>
          <option value="">-- Selecione um Veículo --</option>
          
          {vehicles.map(vehicle => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.name}
            </option>
          ))}
        </select>
      </div>
    );
  }
  
  export default VehicleSelect;