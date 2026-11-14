const API = "http://localhost:3000/api/imagenes";

export async function subirImagen(file) {
  const formData = new FormData();
  formData.append("imagen", file);

  const res = await fetch(API, { method: "POST", body: formData });
  if (!res.ok) throw new Error("No se pudo subir la imagen");
  return res.json(); // { url, public_id }
}

export async function eliminarImagen(public_id) {
  const res = await fetch(API, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_id }),
  });
  if (!res.ok) throw new Error("No se pudo eliminar la imagen");
}
