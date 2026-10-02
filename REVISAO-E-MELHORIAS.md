# Revisao e proximas melhorias - 1 de outubro de 2026

## Implementado nesta entrega

- Inicio visual compartilhado por site e app; login solicitado ao acessar.
- Sessao de conta persistente pelo Supabase e armazenamento da WebView. A senha nao e gravada pelo aplicativo.
- Inscricao antecipada por link de operacao, com nome, agremiacao de origem, email, telefone e contato de emergencia.
- Organizador abre/fecha inscricoes, busca jogadores e pagina os resultados em grupos de 25.
- Aprovacao e escolha dos dois lados da partida antes do inicio. Quando configurado, companheiros de agremiacao permanecem juntos.
- Inscricoes aprovadas entram no estado da partida. O jogador usa a mesma conta para recuperar sua identificacao.
- A abertura dos modulos recupera o estado atual da sala antes de sincronizar.

## Ativacao

1. Executar `supabase/migrations/005_pre_registration.sql` no SQL Editor do Supabase.
2. Publicar a pasta `outputs` no Netlify.
3. Compilar e instalar novamente o Android. Os recursos web foram sincronizados com o projeto Android.
4. Entrar na conta, criar uma operacao e abrir **Inscricoes** na lista de operacoes.
5. Abrir inscricoes e copiar o link. Os jogadores entram na propria conta e enviam os dados.
6. Definir equipes e aprovar antes de iniciar. Ao acessar como Jogador com a mesma conta, a ficha aprovada e recuperada.

O link e uma pagina da operacao dentro do mesmo site. Nao e necessario criar outro dominio para cada jogo.
O cadastro permanece pendente ate a aprovacao. Fichas aprovadas precisam ser alteradas pelo organizador.

## Problemas identificados na revisao

### Prioridade alta: servidor como autoridade

`outputs/airsoft-cloud.js`, funcao `consumeEvent`, recebe um estado completo proposto por outro aparelho e o grava como estado oficial. A politica de insercao de eventos permite membros pendentes. Isso permite sobrescrever configuracoes, equipes e resultado e causa perda de atualizacoes quando dois jogadores agem juntos.

Substituir propostas de estado completo por comandos pequenos: solicitar arme, confirmar senha, enviar posicao, registrar presenca. O servidor deve validar papel, aprovacao, equipe, bomba e etapa; aplicar cada comando em transacao e gerar resultado e auditoria. E a primeira melhoria recomendada antes de ampliar o numero de jogadores.

### Prioridade alta: contatos restritos

O cadastro legado inclui emails e contatos de emergencia no estado da partida, que pode ser lido por membros da sala. A nova tabela de inscricoes restringe acesso ao proprio jogador e organizador e envia apenas nome, agremiacao e equipe para a partida. Migrar tambem as fichas do cadastro legado para dados privados.

### Prioridade alta: isolamento e reconexao

`outputs/airsoft-shared.js` usa uma chave local global para todas as salas. Ao entrar, agora se recupera o estado do servidor, mas rascunhos e preferencias do jogador ainda precisam ser separados por sala. Identificar cada sessao, validar conexao salva e apresentar estados conectado, reconectando e offline sem iniciar uma partida local por acidente.

### Mapas

`outputs/maps-config.js` ainda tem chave Google vazia. O mapa aereo nao esta configurado. Testar limites do campo, precisao GPS e areas ocultas em aparelhos reais. Areas ocultas devem ser filtradas no servidor, porque esconder visualmente uma area nao impede que o aparelho receba seus dados.

### Android e login Google

O app usa paginas locais em `https://airsoft.local`. O fluxo Google precisa ser integrado ao navegador do sistema e a um retorno para o aplicativo; nao basta manter OAuth dentro da WebView. Login por email utiliza a sessao persistente existente. Ainda e necessario testar retorno Google, renovacao de sessao e recuperacao de senha no aparelho.

## Opcoes visuais

1. Identidade Montanha na entrada; telas operacionais com fundo discreto, contraste maior e textura apenas nas bordas.
2. Navegacao fixa: Operacao, Equipes, Campo, Artefatos e Historico. Barra superior compacta com nome, conexao e sair.
3. No Controle, tabela de jogadores com filtros de agremiacao, equipe, aprovacao e sinal; aprovacao em lote com resumo antes de aplicar.
4. Na Bomba, cronometro dominante, etapa e teclado com tamanho fixo; alertas de arme e desarme sempre no mesmo local.
5. No Jogador, objetivo atual primeiro; mapa, equipe e mensagens em abas. Estados pendente, aprovado e offline visiveis sem popups repetidos.

## Opcoes de sistema

1. Organizador, auxiliar e jogador com permissoes verificadas no servidor.
2. Cadastro permanente do jogador e inscricoes por evento; importacao CSV e exportacao de lista para o organizador.
3. Balanceamento por quantidade, agremiacao e nivel declarado; opcao de manter ou separar agremiacoes.
4. Check-in no campo por QR, lista de ausentes e substituicoes antes da partida.
5. Comandos com identificador unico, fila de reconexao e historico de quem alterou cada configuracao.
6. Posicoes GPS em canal/tabela separados, intervalo adaptativo e indicacao de precisao; teste de carga antes de definir capacidade de pico.

## Opcoes de jogabilidade

1. Dominar areas por permanencia, com contagem contestada quando os dois lados ocupam a zona.
2. Bombas em sequencia com caminhos alternativos, escolha de objetivo e requisitos de desbloqueio.
3. Defesa simultanea: varias bombas ativas, pontos por tempo protegido e penalidade por explosao.
4. Extracao e escolta: rota, ponto de coleta e janela de resgate.
5. Respawn por base, tickets e intervalo; suspender ações durante zona segura.
6. Informacao limitada: objetivos e areas liberados por etapa; reconhecimento temporario para um lado.

Sugestao de ordem: autoridade do servidor, contatos privados, reconexao, check-in e balanceamento; depois novos modos de jogo.

Referencias tecnicas consultadas: [retorno de autenticacao em aplicativos](https://supabase.com/docs/guides/auth/native-mobile-deep-linking) e [limites e comportamento do Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## Limites da verificacao

Sintaxe e fluxos locais podem ser verificados sem alterar a nuvem. A migracao, autenticacao real, dois aparelhos simultaneos, GPS, Google Maps e APK precisam de validacao com os servicos e dispositivos configurados. Nao considerar capacidade para 10.000 usuarios confirmada sem teste de carga.
