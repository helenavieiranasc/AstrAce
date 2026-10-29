<p align="center">
  <img src="docs/logo-astrace-readme.png" alt="AstrAce" width="460">
</p>

<p align="center"><b>"Ciência feita por meninas e mulheres!"</b></p>

Plataforma web que dá visibilidade, pertencimento e caminho de carreira a meninas e mulheres na ciência. O AstrAce reúne em um só lugar um mural de projetos, agenda de eventos, vagas afirmativas, notícias científicas e um passaporte de carimbos, tudo com cara de mural de cortiça e pensado para ser acessível.

🌐 **Site no ar:** https://helenavieira.pythonanywhere.com

Projeto desenvolvido para o **Hackathon Ciência Delas**.

![Página inicial do AstrAce](docs/prints/01-inicio.jpg)

## 🛠️ Funcionalidades

- [x] **Mural de projetos:** pesquisas, apps, pôsteres e ideias de meninas e mulheres, com filtros, estrelas e destaque da semana.
- [x] **Eventos:** agenda com filtros. Eventos que valem carimbo geram um QR code para o check-in.
- [x] **Vagas afirmativas:** bolsas, estágios e programas para o próximo passo na carreira.
- [x] **Notícias:** descobertas e conquistas atuais de mulheres na ciência.
- [x] **Passaporte 3D:** um carimbo de boas-vindas e um para cada evento de que a pessoa participa.
- [x] **Certificados:** depois do evento, quem fez o check-in emite o certificado de participação.
- [x] **Carta para o futuro:** uma carta para a cientista que você vai ser, selada em um envelope 3D até a data escolhida.
- [x] **Mapa de Inspiração:** cientistas da história e as mulheres e projetos do AstrAce, por cidade.
- [x] **Quiz "Que cientista você seria?"**
- [x] **Perfil:** publicações, carta e certificados da pessoa.
- [x] **Painel da equipe:** cadastro de eventos, vagas e notícias e revisão de denúncias.
- [x] **Login com Google**, sem senha própria.
- [x] **Acessibilidade:** menu com contraste, tamanho do texto, fonte para dislexia, leitura em voz alta e mais.

## 📸 Um passeio pelo site

### Mural de projetos
![Mural de projetos](docs/prints/02-mural.jpg)

### Eventos e vagas
![Agenda de eventos](docs/prints/03-eventos.jpg)
![Vagas e programas afirmativos](docs/prints/04-vagas.jpg)

### Notícias
![Notícias científicas](docs/prints/05-noticias.jpg)

### Passaporte e certificados
Cada evento de que a pessoa participa rende um carimbo no passaporte.

![Passaporte 3D aberto](docs/prints/06-passaporte.jpg)

### Carta para o futuro
A carta fica selada e só abre na data escolhida.

![Envelope da carta para o futuro](docs/prints/07-carta.jpg)

### Mapa de Inspiração e quiz
![Mapa de Inspiração](docs/prints/08-mapa.jpg)
![Quiz Que cientista você seria?](docs/prints/09-quiz.jpg)

### Perfil
![Perfil com carta e certificados](docs/prints/10-perfil.jpg)

### Painel da equipe
![Painel da equipe com o calendário](docs/prints/11-painel.jpg)

### Acessibilidade
![Menu de acessibilidade](docs/prints/12-acessibilidade.jpg)

## 💻 Tecnologias

- **Python e Flask:** servidor e regras de negócio
- **SQLAlchemy com SQLite** (MySQL opcional)
- **HTML, CSS e TypeScript:** interface web
- **Three.js:** passaporte, carta e outros elementos em 3D
- **Google OAuth:** login
- **pytest:** testes automatizados
- **PythonAnywhere:** hospedagem gratuita

## ☁️ Hospedagem

O site roda no **PythonAnywhere** (plano gratuito), com o banco e os arquivos enviados no mesmo lugar. Para atualizar: `git pull` no console do servidor e **Reload** na aba Web. No plano gratuito é preciso renovar o site uma vez por mês.

## 🙏 Créditos

- Widget de acessibilidade adaptado de [junanobi/accessibility-widget](https://github.com/junanobi/accessibility-widget) (licença MIT).

## 👥 Equipe

- [Helena Vieira](https://github.com/helenavieiranasc)
- [Maria Clara Pastor](https://github.com/mariaclarapastorsilva)
- [Camila Ribeiro](https://github.com/camilaribeirox)
- [Caio Grilo](https://github.com/grilocaio)
- [Kawan Mesquita](https://github.com/kawanmt)
