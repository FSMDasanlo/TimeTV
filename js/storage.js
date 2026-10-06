const MIEMBROS = [
  { id: 'papa', nombre: 'Papá' },
  { id: 'mama', nombre: 'Mamá' },
  { id: 'dani', nombre: 'Dani' },
  { id: 'sandra', nombre: 'Sandra' },
  { id: 'lorena', nombre: 'Lorena' }
];

const Storage = {
  KEY_SESIONES: 'timetv.sesiones',
  KEY_ACTIVA: 'timetv.activa',

  sesiones() {
    return JSON.parse(localStorage.getItem(this.KEY_SESIONES) || '[]');
  },
  guardarSesiones(lista) {
    localStorage.setItem(this.KEY_SESIONES, JSON.stringify(lista));
  },
  // Sesión en curso: { miembro, inicio } o null
  activa() {
    return JSON.parse(localStorage.getItem(this.KEY_ACTIVA) || 'null');
  },
  iniciar(miembro) {
    this.parar();
    localStorage.setItem(this.KEY_ACTIVA, JSON.stringify({ miembro, inicio: Date.now() }));
  },
  parar() {
    const a = this.activa();
    if (!a) return;
    const fin = Date.now();
    if (fin - a.inicio >= 1000) {
      const lista = this.sesiones();
      lista.push({ id: fin, miembro: a.miembro, inicio: a.inicio, fin });
      this.guardarSesiones(lista);
    }
    localStorage.removeItem(this.KEY_ACTIVA);
  },
  borrar(id) {
    this.guardarSesiones(this.sesiones().filter(s => s.id !== id));
  }
};
