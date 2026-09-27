# Plano de validação antes do uso pela família

Use somente dados fictícios durante esta validação. O diário registra informações; ele não substitui as orientações nem os meios de contato definidos pela equipe médica.

## 1. Verificação automática

Depois de instalar as dependências com `npm install`, execute:

```sh
npm test
```

O resultado esperado é nenhum teste com falha. A suíte verifica:

- cálculos e validação dos registros;
- restauração sem perda de refeições;
- navegação, paginação e filtros;
- bloqueio do modo demonstração;
- salvamento local e falha de armazenamento;
- cache público e abertura offline.

## 2. Dois celulares

- [ ] Abrir o mesmo diário nos dois aparelhos e confirmar o mesmo nome e os mesmos registros.
- [ ] No aparelho A, criar uma refeição fictícia e confirmar que ela aparece no B.
- [ ] No aparelho B, editar outra refeição do mesmo dia e confirmar que nenhuma das duas desaparece.
- [ ] Abrir a mesma refeição nos dois aparelhos, alterá-la primeiro no A e confirmar que o B mostra o aviso de conflito.
- [ ] Excluir um registro no A enquanto ele está aberto no B e confirmar que o B avisa sobre a mudança.
- [ ] Desligar a internet durante um salvamento e confirmar que o formulário continua aberto e preenchido.
- [ ] Ligar a internet e salvar novamente, verificando o resultado nos dois aparelhos.

## 3. Backup e restauração

- [ ] Criar dados fictícios em duas refeições do mesmo dia.
- [ ] Baixar a cópia de segurança e guardá-la fora do aparelho.
- [ ] Adicionar uma terceira refeição depois do backup.
- [ ] Restaurar a cópia e confirmar que as três refeições continuam presentes.
- [ ] Conferir nome, plano, medições extras, hipoglicemias e sensor.
- [ ] Tentar importar um arquivo JSON que não seja do diário e confirmar que ele é recusado.

## 4. Instalação e privacidade

- [ ] Instalar o site na tela inicial de um Android e de um iPhone, se ambos forem usados.
- [ ] Abrir uma vez com internet, ativar o modo avião e confirmar que a estrutura do site abre.
- [ ] Usar **Apagar todos os dados**, recarregar e confirmar que registros, nome e plano não voltam.
- [ ] Em aparelho compartilhado, confirmar que a família entende que o modo local não possui senha própria.

## 5. Conferência do material para consulta

- [ ] Preencher os três horários e confirmar sua presença no CSV.
- [ ] Abrir o CSV na planilha e conferir se as 13 colunas permanecem alinhadas.
- [ ] Gerar o PDF e conferir datas, nome, refeições, medições extras e sensor.
- [ ] Mostrar um exemplo fictício do PDF ou CSV à equipe médica e confirmar se o formato contém o que ela precisa acompanhar.

## 6. Banco e acesso (Supabase)

- [ ] Abrir o site sem estar logado e confirmar que nenhum registro aparece antes do login.
- [ ] Entrar com uma conta Google que não foi convidada e confirmar que nenhum diário aparece.
- [ ] Convidar um cuidador e um leitor. Confirmar que cada um vê o diário depois do login.
- [ ] Confirmar que o leitor não consegue salvar e que o cuidador não vê "Apagar todos os dados".
- [ ] Remover uma pessoa e confirmar que, ao recarregar, ela não vê mais o diário.
- [ ] Registrar num celular com o outro bloqueado. Desbloquear o outro e confirmar que o registro aparece.
- [ ] Restaurar a cópia de segurança da versão antiga (Claude), se houver, e conferir os dias.

## Critério de liberação

A primeira versão pode ser liberada quando todos os itens aplicáveis estiverem marcados, sem perda ou troca de registros. Nas primeiras semanas, mantenha backups frequentes em outro local.
