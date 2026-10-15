// Feedback de conexão durante a verificação, sem alterar a autorização de acesso.
export function mostrarFalhaVerificacao() {
  const tela = document.getElementById('verificando');
  tela.setAttribute('role', 'alert');
  tela.querySelector('p').textContent = 'Não foi possível verificar seu acesso. Confira a conexão e tente novamente.';
  const icone = tela.querySelector('i');
  icone.className = 'ti ti-alert-triangle';
  icone.style.animation = 'none';
  if (tela.querySelector('button')) return;
  const tentar = document.createElement('button');
  tentar.type = 'button';
  tentar.className = 'btn-gestao';
  tentar.textContent = 'Tentar novamente';
  tentar.addEventListener('click', () => window.location.reload());
  tela.append(tentar);
}
