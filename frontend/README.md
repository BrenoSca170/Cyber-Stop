Bem-vindo ao Projeto Stop Online Frontend!
Obrigado pelo seu interesse em contribuir! Este documento serve como um guia para garantir que todos possam colaborar de forma eficiente e segura, mantendo a qualidade do nosso código.

📖 Sobre o Projeto
Este projeto é a parte frontend do jogo "Stop Online". Ele é responsável por toda a interface com a qual o usuário interage, desde as telas de jogo até o perfil e a loja.

Tecnologias Utilizadas
JavaScript (ES6+): A linguagem de programação principal para toda a lógica do frontend.

React.js: A biblioteca principal para construir a interface de usuário de forma componentizada e reativa.

Vite: A ferramenta de build e servidor de desenvolvimento que tornou a criação do nosso projeto extremamente rápida.

Tailwind CSS: O framework de CSS "utility-first" que usamos para estilizar todos os componentes de forma rápida e consistente.

React Router (react-router-dom): A biblioteca responsável por gerenciar a navegação e as múltiplas telas da aplicação (Jogo, Perfil, Loja, etc.), criando uma SPA (Single Page Application).

Axios: O cliente HTTP que usamos para fazer as requisições (chamadas de API) do frontend para o backend.

Framer Motion: A biblioteca que utilizamos para criar animações fluidas, como a "cortina" da tela de TimeUpOverlay.

Lucide React: A biblioteca de ícones SVG que usamos para adicionar ícones como o relógio, a carteira e a loja.

🚀 Começando
Siga os passos abaixo para configurar o ambiente de desenvolvimento na sua máquina.

Pré-requisitos
Antes de começar, certifique-se de que você tem o seguinte software instalado:

Git: Essencial para controle de versão. Link para download.

Node.js: Necessário para gerenciar as dependências do projeto. Link para download.

Instalação
Faça um Clone do Repositório:

git clone [https://github.com/brenosca170/stop-online-frontend.git](https://github.com/brenosca170/stop-online-frontend.git)

Acesse a Pasta do Projeto:

cd stop-online-frontend

Instale as Dependências:
Execute os seguintes comandos para instalar as dependências de funcionalidade e de desenvolvimento.

# Para as funcionalidades do site
npm install react-icons react-tilt classnames

# Para o Tailwind CSS (dependências de desenvolvimento)
npm install -D tailwindcss postcss autoprefixer

🤝 Como Contribuir
Para manter o projeto organizado e o código principal (main) sempre estável, adotamos um fluxo de trabalho baseado em Branches e Pull Requests.

⚠️ Regra de Ouro: NUNCA envie código diretamente para a branch main. Todas as alterações devem ser propostas através de um Pull Request.

Fluxo de Trabalho Passo a Passo
Sincronize sua Branch main Local:
Antes de criar uma nova branch, sempre garanta que sua main local está atualizada com a do repositório remoto.

git checkout main
git pull origin main

Crie uma Nova Branch:
Crie uma branch a partir da main para trabalhar na sua nova funcionalidade ou correção. Use um nome descritivo.

Padrão de Nomes: <tipo>/<descricao-curta>

feature/: Para novas funcionalidades (ex: feature/formulario-contato).

fix/: Para correção de bugs (ex: fix/menu-mobile-quebrado).

docs/: Para alterações na documentação.

# Exemplo de criação de uma nova branch para uma funcionalidade
git checkout -b feature/adicionar-secao-projetos

Faça suas Alterações e Commits:
Trabalhe no código dentro da sua nova branch. Faça commits pequenos e com mensagens claras, explicando o que foi feito.

# Adicione os arquivos que você alterou
git add .

# Crie o commit com uma mensagem descritiva
git commit -m "feat: adiciona estrutura HTML da seção de projetos"

Envie sua Branch para o GitHub:
Quando terminar o trabalho (ou quiser salvar seu progresso na nuvem), envie sua branch para o repositório remoto.

git push origin feature/adicionar-secao-projetos

Abra um Pull Request (PR):

Acesse a página do repositório no GitHub.

O GitHub irá detectar sua nova branch e mostrará um botão para "Compare & pull request". Clique nele.

Base: main | Compare: sua-branch

Escreva um título claro e uma descrição detalhada do que foi feito no Pull Request. Se for uma alteração visual, inclua screenshots.

Clique em "Create pull request".

Revisão de Código:
Um dos donos ou mantenedores do projeto irá revisar seu código. Podem ser solicitadas alterações. Faça os ajustes necessários na sua branch e envie-os com git push. O Pull Request será atualizado automaticamente.

Merge:
Após a aprovação, seu código será integrado (merged) à branch main. Parabéns e obrigado pela sua contribuição!

✍️ Autores
Breno - Dono do Repositório - @brenosca170
