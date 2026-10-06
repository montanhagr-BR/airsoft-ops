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

No Controle da mesma operação, em **Pré-cadastro / Equipes**, clique em **Importar pré-inscrições**. A importação confirma as forças preparadas e aprova esses jogadores. Quem estiver sem força fica pendente; retirar um jogador de uma força e reimportar retira sua aprovação anterior. Recusados não são importados. A importação preserva as configurações da partida e pode ser repetida sem duplicar jogadores. Somente o dono da sala no Controle pode importar, antes de iniciar a partida.

Validação transacional do banco passou (`tests/force-planning.sql`), com dados sintéticos revertidos. Inclui planejamento separado da formação oficial, distribuição por agremiação, nomes, permissões, importação, reimportação, retirada e bloqueio após o início.
