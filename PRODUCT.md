# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Todas as meninas e mulheres interessadas em ciência e tecnologia, do ensino médio a quem já é formada (níveis em `app/catalogos.py`: ensino médio, técnico, graduação, pós, já formada). Elas fazem duas coisas: publicar o próprio trabalho para ganhar visibilidade e navegar pelo trabalho de outras para se inspirar e achar um caminho.

## Product Purpose

Dar visibilidade, pertencimento e caminho de carreira a mulheres e meninas na ciência. Sucesso é uma usuária publicar algo concreto que fez, ser vista por isso e achar a próxima oportunidade (evento, vaga, projeto parecido com o dela).

## Positioning

Um lugar só para o trabalho científico de mulheres e meninas, de todos os níveis lado a lado: um TCC de pós ao lado de um projeto de feira do ensino médio. Todo projeto precisa mostrar algo concreto (arquivo ou link). As identidades autodeclaradas (mulheres negras, trans, indígenas, com deficiência, LGBTQIA+) servem de filtro só quando a usuária escolhe torná-las públicas.

## Operating Context

- Feito em um hackathon por uma equipe de 5 pessoas. Cada pessoa cuida de uma frente com o próprio blueprint Flask (Pessoa 1: mural; Pessoa 2: login com Google e perfil; Pessoa 3: campos extras dos tipos da Parte B).
- Frentes: **Mural** (feito), **Eventos**, **Vagas** e **Passaporte** (já no menu, ainda sem implementação).
- **Passaporte:** a usuária ganha um carimbo a cada evento de que participa.
- Destaques da semana são escolhidos por admin (até 5 por semana ISO).

## Capabilities and Constraints

- Stack: Flask + SQLAlchemy, SQLite em desenvolvimento e MySQL em produção, templates Jinja, CSS puro, TypeScript compilado para `app/static/js/` (os `.js` compilados vão para o git).
- Oito tipos de projeto (`app/mural/tipos.py`): monografia/TCC, pôster em congresso, iniciação científica, extensão, software, projeto social, trabalho de disciplina, protótipo. Cada tipo define os próprios campos e o material obrigatório.
- Moderação pela comunidade: com 3 denúncias o projeto sai do mural.
- Identidades são privadas por padrão (`publica = 0`) e nunca podem aparecer sem consentimento.
- Linguagem: português do Brasil, no feminino ("usuária", "logada", "formada").
- Em aberto: como Eventos e Vagas funcionam, e de onde vêm os dados deles.

## Brand Commitments

- Nome: **Ciência Delas**.
- Voz: direta, calorosa, no feminino, chamando para a ação ("Publique o seu e inspire a próxima").

## Evidence on Hand

- Dados de exemplo gerados por `flask --app run seed-mural` (16 projetos fictícios). Não existem depoimentos, usuárias reais, números de impacto nem parcerias; não inventar.

## Product Principles

1. **Trabalho concreto acima de perfil.** O que aparece é o que a usuária fez, sempre com material para provar.
2. **Todos os níveis cabem.** Um projeto de feira do ensino médio tem o mesmo lugar que uma dissertação.
3. **Identidade é escolha dela.** Nada sobre identidade aparece sem consentimento explícito.
4. **Ver leva a agir.** Cada projeto, evento ou vaga aponta para um próximo passo possível.

## Accessibility & Inclusion

O público inclui mulheres com deficiência. A base já usa Atkinson Hyperlegible, link de "pular para o conteúdo" e `aria-current` no menu; manter esse cuidado em todas as frentes.
