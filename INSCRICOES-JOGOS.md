# Inscrições integradas ao Controle

Aplicar `supabase/migrations/007_registration_roster.sql` após as migrações 001 a 006.

1. Abra seu projeto no Supabase e entre em **SQL Editor**.
2. Crie uma consulta, cole todo o arquivo 007 e clique em **Run**.
3. Atualize o site. No painel, consulte **Jogos com inscrição aberta** e escolha **Inscrever-se**.
4. Envie os contatos. Em outra conta, abra o Controle da operação: o jogador deve aparecer como pendente.
5. Escolha o time e aprove. O jogador entra pela lista **Minhas inscrições** e recebe o time aprovado.

A inscrição continua exigindo aprovação: não confirma automaticamente uma equipe. O cadastro agora alimenta o Controle mesmo quando o organizador está offline. Atualizações antigas do estado não podem apagar esses cadastros. Inscrições rejeitadas ficam no histórico; o jogador pode reenviar enquanto o cadastro estiver aberto. Alteração de cadastro aprovado exige o organizador.

A lista pública para contas autenticadas mostra somente nome e código de jogos abertos; dados de contato continuam sujeitos às políticas de acesso existentes. A migração preserva as inscrições existentes e os limites de três operações e uma partida em andamento.

Validação local usa contas e banco simulados. A aplicação da migração e o teste com duas contas reais continuam necessários.


## Reservas com limite opcional e equipe de organização

Aplicar `supabase/migrations/008_reserved_registration.sql` após as migrações 001 a 007, antes de publicar esta versão.

No painel, abra **Inscrições e reservas** do jogo. Configure o máximo de participantes (vazio significa sem limite), habilite ou desabilite a escolha de time e clique em **Salvar configuração**. A abertura e o fechamento das inscrições também são salvos nesse botão.

Inscrições pendentes e aprovadas reservam uma vaga; recusadas liberam a vaga. Uma conta só pode reservar uma vaga por operação. A edição de uma reserva pendente continua permitida quando o jogo está lotado. O banco serializa reservas no registro da operação e impede reduzir o limite abaixo das vagas já reservadas. A reserva não substitui a aprovação para entrar em campo.

Quando a escolha estiver habilitada, o jogador informa o time desejado ou deixa a definição ao organizador. O time é confirmado na aprovação. A regra existente de manter agremiações juntas continua podendo determinar o time final.

O dono adiciona ou remove organizadores pelo e-mail de uma conta já cadastrada no app. Cada organizador entra na própria conta e usa o código do jogo no painel, em **Organizar inscrições deste jogo**. Pode consultar contatos, configurar as inscrições e aprovar ou recusar jogadores. O Controle da partida e a gestão da equipe de organizadores permanecem restritos ao dono.

Validação pendente em banco real: duas contas concorrendo pela última vaga; edição de reserva com jogo cheio; recusado libera vaga; bloqueio de alteração do limite abaixo das reservas; jogador sem permissão não acessa organizadores; organizador removido perde acesso; escolha de time desabilitada rejeita envio manipulado.

Atualização 06/10/2026: migração 008 aplicada no Supabase. Teste transacional `tests/reserved-registration.sql` passou e reverteu os dados sintéticos. Testes de interface passaram em 114 telas. Concorrência real entre aparelhos ainda requer teste.


## Tela do organizador e importação das forças (06/10/2026)

Migração 009 aplicada ao Supabase. No painel, abra **Inscrições e reservas** do jogo para acessar a tela de pré-inscrição. O quadro divide os jogadores entre **Sem força**, as duas forças nomeadas e **Recusados**. Os totais abrangem o jogo inteiro; a busca e a paginação afetam as fichas mostradas.

Em cada ficha, selecione a força e clique em **Salvar força**. Marque **Mover a agremiação inteira** para distribuir juntos todos os inscritos ativos da mesma agremiação. A formação é salva no banco sem aprovar a participação nem substituir a força já importada. Os nomes das forças ficam na seção **Nomes das forças**.

Ao abrir o Controle da mesma operação, as inscrições são carregadas automaticamente em **Pré-cadastro / Equipes**. Os jogadores distribuídos nas forças são aprovados; os que estão sem força aparecem como pendentes. **Atualizar inscrições e forças** permite buscar alterações recentes sem fechar o painel. Recusados não entram na lista. A carga preserva as configurações e pode ser repetida sem duplicar jogadores. Ajustes feitos no Controle também atualizam a formação do organizador e permanecem ao reabrir. A importação é bloqueada depois do início da partida.

Validação transacional do banco passou (`tests/force-planning.sql`), com dados sintéticos revertidos. Inclui planejamento separado da formação oficial, distribuição por agremiação, nomes, permissões, importação, reimportação, retirada e bloqueio após o início.


## Fluxo reorganizado: inscrições antes da configuração

No painel, informe somente o **Nome do evento** e clique em **Abrir inscrições antecipadas**. O sistema abre as inscrições e leva diretamente à tela do organizador, com link para compartilhar. Não abre o Controle nem define modo ou cronômetros nesse momento.

A sequência passa a ser: **ficha única de inscrição → organização das forças → Controle com listas prontas → configuração → início da partida**. O organizador recebe as fichas, organiza as forças e depois usa **Continuar para configuração do jogo**. O Controle carrega os jogadores automaticamente antes de exibir a preparação. Depois são definidos cenário, campo, dispositivos e duração.

O terminal do jogador usa **Abrir ficha de inscrição** ou **Consultar minha inscrição** para abrir a mesma ficha da inscrição antecipada, com o código da operação preenchido. Dados já salvos aparecem nessa ficha. Jogadores aprovados continuam acessando diretamente seu terminal e sua força, sem novo cadastro. Vagas limitadas ou ilimitadas, escolha opcional de time e validação dos dados continuam na ficha única.

Migração 010 sincroniza aprovações e forças e preserva aprovações anteriores feitas diretamente no Controle. Validação: teste de carga automática antes da exibição, bloqueio em partida ativa, preservação em falha de conexão e teste transacional de reabertura após alteração de força no Controle.

Para eventos existentes, o botão **Inscrições e reservas** aparece antes de **Configurar jogo**. Os limites de vagas e a escolha de time continuam em **Configurações das inscrições**. O teste de criação no Supabase confirmou abertura e link funcionando sem parâmetros de jogo, com dados de teste revertidos.
