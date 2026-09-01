// Script para adicionar o footer com link configurável
document.addEventListener('DOMContentLoaded', function() {
  const footerLinks = document.querySelectorAll('.footer-author-link');
  footerLinks.forEach(link => {
    link.href = CONFIG.githubAuthor;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
});
