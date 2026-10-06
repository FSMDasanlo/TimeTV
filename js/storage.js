import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

export const MIEMBROS = [
  { id: 'papa', nombre: 'Papá' },
  { id: 'mama', nombre: 'Mamá' },
  { id: 'dani', nombre: 'Dani' },
  { id: 'sandra', nombre: 'Sandra' },
  { id: 'lorena', nombre: 'Lorena' }
];

const firebaseConfig = {
  apiKey: 'AIzaSyBiHScfiaUps3AgigsCX6LVSm8nkvLivoI',
  authDomain: 'timetv-control-de-tiempo-tv.firebaseapp.com',
  projectId: 'timetv-control-de-tiempo-tv',
  storageBucket: 'timetv-control-de-tiempo-tv.firebasestorage.app',
  messagingSenderId: '1008888073153',
  appId: '1:1008888073153:web:672fc3a87204c592a03d40'
};

const db = getFirestore(initializeApp(firebaseConfig));
const colSesiones = collection(db, 'sesiones');
const docActiva = doc(db, 'estado', 'activa');

// Caché local alimentada por Firestore en tiempo real
let sesiones = [];
let activa = null;
let limites = {};
const oyentes = [];
const avisar = () => oyentes.forEach(f => f());

onSnapshot(colSesiones, snap => {
  sesiones = snap.docs.map(d => ({ id: Number(d.id), ...d.data() }));
  avisar();
});
onSnapshot(docActiva, snap => {
  activa = snap.exists() ? snap.data() : null;
  avisar();
});

onSnapshot(doc(db, 'estado', 'limites'), snap => {
  limites = snap.exists() ? snap.data() : {};
  avisar();
});

// Migra una sola vez los datos antiguos de localStorage
(async function migrar() {
  const viejas = JSON.parse(localStorage.getItem('timetv.sesiones') || '[]');
  if (!viejas.length) return;
  const batch = writeBatch(db);
  viejas.forEach(s => batch.set(doc(colSesiones, String(s.id)),
    { miembro: s.miembro, inicio: s.inicio, fin: s.fin }));
  await batch.commit();
  localStorage.removeItem('timetv.sesiones');
  localStorage.removeItem('timetv.activa');
})();

export const Storage = {
  alCambiar(f) { oyentes.push(f); },
  sesiones() { return sesiones.slice(); },
  activa() { return activa; },
  // Minutos diarios por persona; 0 o ausente = sin límite
  limites() { return { ...limites }; },
  guardarLimite(id, minutos) {
    return setDoc(doc(db, 'estado', 'limites'), { [id]: minutos }, { merge: true });
  },

  async parar() {
    const a = activa;
    if (!a) return;
    const fin = Date.now();
    const batch = writeBatch(db);
    if (fin - a.inicio >= 1000) {
      batch.set(doc(colSesiones, String(fin)), { miembro: a.miembro, inicio: a.inicio, fin });
    }
    batch.delete(docActiva);
    await batch.commit();
  },
  async iniciar(miembro) {
    await this.parar();
    await setDoc(docActiva, { miembro, inicio: Date.now() });
  },
  borrar(id) {
    return deleteDoc(doc(colSesiones, String(id)));
  }
};
