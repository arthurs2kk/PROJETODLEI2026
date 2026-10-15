import { auth, db, ref, onValue, update, serverTimestamp } from '../firebase.js';

function caminho(cityId, relatoId) {
  if (!/^\d{7}$/.test(String(cityId)) || !relatoId || /[.#$\[\]\/]/.test(relatoId)) {
    throw new Error('Relato sem município válido para a lista de prioridades.');
  }
  return `prioridadesMunicipais/${cityId}/${relatoId}`;
}

export function ouvirPrioridades(admin, receber, falhar) {
  const superadmin = admin.papel === 'superadmin';
  if (!superadmin && !/^\d{7}$/.test(String(admin.cityId))) throw new Error('Município não identificado.');
  const base = superadmin ? 'prioridadesMunicipais' : `prioridadesMunicipais/${admin.cityId}`;
  return onValue(ref(db, base), snapshot => {
    const cidades = superadmin ? snapshot.val() || {} : { [admin.cityId]: snapshot.val() || {} };
    const prioridades = {};
    for (const [cityId, itens] of Object.entries(cidades)) {
      for (const [id, item] of Object.entries(itens)) prioridades[`${cityId}/${id}`] = item;
    }
    receber(prioridades);
  }, falhar);
}

export async function salvarPrioridade(relato, prioridade, ordem = Date.now()) {
  if (!auth.currentUser) throw new Error('Entre novamente para organizar as prioridades.');
  const destino = caminho(relato.cityId, relato.id);
  await update(ref(db), {
    [destino]: prioridade ? {
      ...prioridade,
      ordem
    } : {
      adicionadoPor: auth.currentUser.uid,
      adicionadoEm: serverTimestamp(),
      ordem
    }
  });
}

export async function removerPrioridade(relato) {
  await update(ref(db), { [caminho(relato.cityId, relato.id)]: null });
}

export async function definirOrdemPrioridades(relatos) {
  const alteracoes = Object.fromEntries(relatos.map((relato, indice) => [
    `${caminho(relato.cityId, relato.id)}/ordem`, (indice + 1) * 1024
  ]));
  await update(ref(db), alteracoes);
}
