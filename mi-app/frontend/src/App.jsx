import { useState } from "react";
import { subirImagen, eliminarImagen } from "./services/imagenes";

export default function App() {
  const [imagen, setImagen] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function handleChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCargando(true);
    try {
      setImagen(await subirImagen(file));
    } catch (err) {
      alert(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function handleEliminar() {
    await eliminarImagen(imagen.public_id);
    setImagen(null);
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Subir imagen a Cloudinary</h1>
      <input type="file" accept="image/*" onChange={handleChange} />
      {cargando && <p>Subiendo...</p>}
      {imagen && (
        <div>
          <img
            src={imagen.url.replace("/upload/", "/upload/f_auto,q_auto,w_400/")}
            alt="Subida"
          />
          <p>{imagen.url}</p>
          <button onClick={handleEliminar}>Eliminar</button>
        </div>
      )}
    </div>
  );
}