// ── Pro Povo — adminAuth.js ──
// Módulo central para resolver o status administrativo do usuário logado.
// Concentra a leitura de /admins/{uid} num só lugar, pra não duplicar essa
// lógica em AdmLogin.js, AdminPage.js e AdminGraficos.js.
//
// Formato novo de /admins/{uid} (isolamento por cidade):
//   {
//     papel: "superadmin" | "admin",
//     cityId: string | null,        // código do IBGE — null só pra superadmin
//     organizacaoId: string | null, // null só pra superadmin
//     ativo: boolean
//   }
//
// Formato legado (como o projeto funcionava antes desta mudança):
//   admins/{uid} === true
//
// Enquanto a conta não for migrada (troca manual no Console do Firebase, na
// Etapa 2 do plano), o formato antigo continua sendo aceito e tratado como
// superadmin — assim ninguém fica bloqueado do painel no meio da transição.

import { db, ref, get } from "./firebase.js";

// ── Busca os dados administrativos do uid. Retorna null se não for admin
// (ou se o admin estiver desativado). ──
export async function buscarAdmin(uid) {
  const snapshot = await get(ref(db, `admins/${uid}`));
  if (!snapshot.exists()) return null;

  const valor = snapshot.val();

  // Formato legado: admins/{uid} === true
  if (valor === true) {
    return { ativo: true, papel: 'superadmin', cityId: null, organizacaoId: null, legado: true };
  }

  // Formato novo: objeto
  if (typeof valor === 'object' && valor !== null) {
    if (valor.ativo !== true) return null; // admin existe mas está desativado

    return {
      ativo: true,
      papel: valor.papel || 'admin',
      cityId: valor.cityId || null,
      organizacaoId: valor.organizacaoId || null,
      legado: false
    };
  }

  return null;
}

// ── Atalho pra checar se um admin (já resolvido por buscarAdmin) é superadmin ──
export function ehSuperAdmin(admin) {
  return !!admin && admin.papel === 'superadmin';
}