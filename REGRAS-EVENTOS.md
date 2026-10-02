# Regras de eventos

Aplicar `supabase/migrations/006_event_limits_waitlist.sql` depois das migrações 001 a 005, antes de publicar os arquivos desta entrega.

- Cada organizador mantém até três partidas não arquivadas. Partidas encerradas continuam ocupando uma vaga até serem arquivadas.
- Apenas uma partida do organizador pode estar em andamento. O banco verifica também o campo `state.running` e serializa as operações por organizador.
- Partidas novas abrem a lista de espera automaticamente. Iniciar a partida fecha essa lista.
- Inscrição antecipada registra interesse e contatos; não aprova presença nem escolhe equipe. O jogador entra efetivamente na partida por código, sujeito à aprovação no Controle.
- Um jogador pode entrar em listas de espera de vários eventos e continuar participando de outras partidas pelo painel.
- Partidas e inscrições antigas são preservadas. Aprovações anteriores já presentes no estado da partida não são removidas automaticamente.
- A consulta de inscritos permanece restrita ao próprio jogador e ao organizador pelas políticas existentes. A função `my_waitlist_events` retorna somente eventos da conta autenticada.

Os testes locais do portal e as verificações de sintaxe passaram. A migração ainda precisa ser aplicada e os limites precisam ser validados no Supabase, inclusive com duas sessões tentando iniciar partidas simultaneamente. O acesso automático ao painel Supabase foi negado pelo controle do navegador.
