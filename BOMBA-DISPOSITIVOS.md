# Cadastro e uso dos aparelhos de bomba

1. No painel, crie o evento e abra **Configurar jogo**. Configure as bombas da operação no Controle.
2. Em cada tablet, celular ou notebook, entre na conta, informe o mesmo código do evento e escolha **Bomba**.
3. Na tela do aparelho, informe nome e tipo e clique em **Solicitar cadastro**. O envio é confirmado pelo banco antes de mostrar a solicitação como salva.
4. No Controle, abra **Pré-cadastro / Equipes**, seção **Dispositivos de bomba**. Escolha uma bomba na lista e clique em **Aprovar**. Cada bomba aceita um aparelho aprovado. Uma conta pode conectar vários aparelhos.
5. O aparelho aprovado abre a interface e aguarda o início do jogo. Durante a partida, só opera a bomba à qual está vinculado e a etapa ativa. O Controle mantém a contagem e confirma arme, desarme e progressão da sequência.

Cadastro, troca de vínculo e remoção são realizados antes de iniciar. **Atualizar solicitação** corrige uma ficha pendente. Reenviar o cadastro preserva uma aprovação existente. Uma bomba removida da configuração não libera o aparelho: ele volta a aguardar um vínculo válido.

O modo de demonstração fica disponível somente fora de uma operação online. Um aparelho não aprovado não pode liberar teclado, confirmar etapas ou transmitir GPS operacional. As ações de notebook e terminal também dependem da aprovação e da partida ativa. Uma bomba já neutralizada mostra seu próprio resultado enquanto a próxima aguarda outro aparelho.

## Revisão técnica

As migrações 011 e 012 adicionam cadastro persistente, aprovação exclusiva do proprietário, vínculo válido e único por bomba, presença dos aparelhos e suporte a múltiplos dispositivos de bomba por conta. Uma atualização antiga do estado não apaga cadastros nem aprovações. Cadastros anteriores são preservados; aparelhos legados já aprovados podem registrar sua identidade ao reconectar, inclusive numa partida em andamento, sem receber uma nova aprovação.

A sincronização preserva parâmetros do Controle, protege a lista de dispositivos, mantém a fila de ações e aceita as transições válidas de arme, desarme, envio de dados e captura/revalidação de terminal. O desarme não depende dos indicadores locais que são reiniciados ao avançar para a próxima bomba.

Validação: teste transacional no Supabase com reversão dos dados; testes de duração, sequência, término, notebook, terminal e fila de envio; fluxo em dois navegadores com backend simulado. As imagens de teste ficam em `work/revisao-bombas`.
