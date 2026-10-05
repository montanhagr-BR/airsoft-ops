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
