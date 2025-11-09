// /src/lib/avatarList.js

// (CORRIGIDO) Exporta 'avatarList' (como o Header.jsx espera)
// e usa um array de objetos (com 'nome' e 'src')
export const avatarList = [
  {
    nome: 'vitaooriginal', // Use o nome exato que está salvo no banco de dados
    src: '/avatars/vitaooriginal.jpg'
  },
  {
    nome: 'vitaocomcabelo', // Use o nome exato que está salvo no banco de dados
    src: '/avatars/vitaocomcabelo.jpg'
  },
  {
    nome: 'vitaocabeludasso', // Use o nome exato que está salvo no banco de dados
    src: '/avatars/vitaocabeludasso.png'
  }
];

// (ATUALIZADO) O avatar padrão agora é o primeiro objeto da lista
export const DEFAULT_AVATAR = avatarList[0];